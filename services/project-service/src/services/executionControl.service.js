/**
 * Execution Control domain orchestration (project-service).
 * LLM/graph lives in ai-project-planning-service — this service owns data + apply + HITL HTTP.
 */

const crypto = require('crypto');
const Task = require('../models/Task');
const Project = require('../models/Project');
const ExecutionIssue = require('../models/ExecutionIssue');
const ExecutionProposal = require('../models/ExecutionProposal');
const ExecutionErrorRecord = require('../models/ExecutionErrorRecord');
const ExecutionApplyAction = require('../models/ExecutionApplyAction');
const ProjectIncident = require('../models/ProjectIncident');
const ProjectRisk = require('../models/ProjectRisk');
const Sprint = require('../models/Sprint');

/** JWT/admin often thiếu organizationId — lấy từ project ownership. */
async function resolveProjectOrganizationId(projectId, organizationId) {
  const fromArg = organizationId != null ? String(organizationId).trim() : '';
  if (fromArg) return fromArg;
  const row = await Project.findById(projectId).select('organizationId').lean();
  const fromProject = row?.organizationId != null ? String(row.organizationId).trim() : '';
  if (!fromProject) {
    const err = new Error('organizationId required');
    err.statusCode = 400;
    err.errorCode = 'VALIDATION_REQUIRED';
    err.messageUser = 'Thiếu organizationId của dự án.';
    throw err;
  }
  return fromProject;
}
const {
  isExecutionControlEnabled,
  detectTaskSignals,
  buildConfirmedRemainingPatch,
  applyBaselineSnapshot,
  backfillBaselineFromTrustedSource,
  analyzeDependencyImpact,
  filterActionsByImpact,
  evaluateSprintGoalImpact,
  computeAvailableCapacityToDue,
  buildProposal,
  validateProposal,
  checkExpectedVersions,
  applyLockKey,
  evaluateFollowUpCriteria,
  decideIssueAfterFollowUp,
  enqueueOutboxEvent,
  shouldStartAnalyzeFromOrigin,
  classifyException,
  detectSprintGoalAtRisk,
  simulateSprintScopeOptions,
  filterOverloadedCandidates,
  computeCostVariance,
  diffRequirementKeys,
  buildScopeChangeCrDraft,
  buildHeuristicProposal,
} = require('./executionControl');

function fingerprintFor(kind, subjectIds = []) {
  const ids = [...subjectIds].map(String).sort().join(',');
  return crypto.createHash('sha1').update(`${kind}:${ids}`).digest('hex').slice(0, 40);
}

async function confirmTaskRemaining(taskId, { remainingHours, userId, organizationId }) {
  const patch = buildConfirmedRemainingPatch({ remainingHours, userId });
  const task = await Task.findOneAndUpdate(
    { _id: taskId, organizationId, isActive: true },
    { $set: { ...patch }, $inc: { entityVersion: 1 } },
    { new: true }
  ).lean();
  if (!task) {
    const err = new Error('Task not found');
    err.statusCode = 404;
    throw err;
  }
  await enqueueOutboxEvent({
    organizationId,
    projectId: task.projectId,
    eventType: 'task.remaining_confirmed',
    origin: 'board',
    payload: { taskId: String(task._id) },
  });
  return task;
}

async function syncDependsOnFromEdges({ projectId, organizationId, edges = [] }) {
  let updated = 0;
  for (const e of edges) {
    const pred = e.predecessorTaskId || e.predecessorId;
    const succ = e.successorTaskId || e.successorId;
    if (!pred || !succ) continue;
    const type = String(e.depType || e.type || 'FS').toUpperCase();
    const lagHours = Number(e.lagHours) || 0;
    const res = await Task.updateOne(
      { _id: succ, projectId, organizationId, isActive: true },
      {
        $pull: { dependsOn: { predecessorId: pred } },
      }
    );
    await Task.updateOne(
      { _id: succ, projectId, organizationId, isActive: true },
      {
        $push: {
          dependsOn: {
            predecessorId: pred,
            type: ['FS', 'SS', 'FF', 'SF'].includes(type) ? type : 'FS',
            lagHours,
            sourceVersion: String(e.sourceVersion || e.externalKey || ''),
            source: 'gate2_artifact',
          },
        },
        $inc: { entityVersion: 1 },
      }
    );
    if (res.matchedCount || res.n) updated += 1;
  }
  return { updated };
}

async function snapshotBaselineOnPromote(taskId, snap) {
  const task = await Task.findById(taskId).lean();
  if (!task) return null;
  const patch = applyBaselineSnapshot(task, snap);
  return Task.findByIdAndUpdate(taskId, { $set: patch }, { new: true }).lean();
}

async function openOrRefreshIssue({
  organizationId,
  projectId,
  kind,
  title,
  summary = '',
  subjectTaskIds = [],
  signals = [],
  evidence = [],
  needsData = false,
  goalImpact = null,
  impactStatus = 'UNKNOWN',
  rootIssueId = null,
  rootIncidentId = null,
  activatedFromRiskId = null,
  interventionLevel = 'open_issue',
  createdBy = null,
}) {
  const fp = fingerprintFor(kind, subjectTaskIds);
  const existing = await ExecutionIssue.findOne({
    projectId,
    fingerprint: fp,
    status: { $nin: ['resolved', 'cancelled'] },
  });
  if (existing) {
    existing.signals = [...new Set([...(existing.signals || []), ...signals])];
    existing.evidence = [...(existing.evidence || []), ...evidence].slice(-50);
    existing.needsData = Boolean(needsData) || existing.needsData;
    if (goalImpact) existing.goalImpact = goalImpact;
    if (impactStatus) existing.impactStatus = impactStatus;
    await existing.save();
    return existing.toObject();
  }
  const doc = await ExecutionIssue.create({
    organizationId,
    projectId,
    kind,
    title,
    summary,
    subjectTaskIds,
    signals,
    evidence,
    needsData,
    goalImpact: goalImpact || { goalImpactStatus: 'UNKNOWN', affectsSprintGoal: false },
    impactStatus,
    rootIssueId,
    rootIncidentId,
    activatedFromRiskId,
    interventionLevel,
    fingerprint: fp,
    createdBy,
    status: needsData ? 'needs_input' : 'open',
  });
  return doc.toObject();
}

/**
 * Scan one task and upsert issues (Wave 1 + extensions).
 */
async function scanTask(task, ctx = {}) {
  if (!isExecutionControlEnabled()) return { skipped: true };
  const detected = detectTaskSignals(task, ctx);
  const issues = [];

  const primaryKinds = detected.signals.filter((s) =>
    ['OVERDUE', 'AT_RISK', 'BLOCKED', 'QUALITY_FAIL', 'COST_OVERRUN', 'DEPENDENCY_CONFLICT', 'CAPACITY_OVERLOAD', 'UNASSIGNED', 'NEEDS_DATA', 'STALE_PROGRESS', 'DONE_NO_EVIDENCE'].includes(s)
  );

  // Prefer opening hard issues; NEEDS_DATA is additive on those or alone
  const hard = primaryKinds.filter((k) => !['NEEDS_DATA', 'STALE_PROGRESS'].includes(k));
  const kindsToOpen = hard.length ? hard : primaryKinds.slice(0, 1);

  const sprintGoal = evaluateSprintGoalImpact(task, ctx.sprint || {});
  const depImpact = analyzeDependencyImpact(
    (task.dependsOn || []).map((d) => ({
      predecessorId: String(d.predecessorId),
      successorId: String(task._id),
      type: d.type,
      lagHours: d.lagHours,
    })),
    String(task._id)
  );

  for (const kind of kindsToOpen) {
    const issue = await openOrRefreshIssue({
      organizationId: task.organizationId,
      projectId: task.projectId,
      kind,
      title: `${kind}: ${task.title || task._id}`.slice(0, 240),
      summary: detected.evidence.map((e) => e.type).join(', '),
      subjectTaskIds: [task._id],
      signals: detected.signals,
      evidence: detected.evidence,
      needsData: detected.needsData,
      goalImpact: sprintGoal,
      impactStatus: depImpact.impactStatus,
      createdBy: ctx.actorId || null,
    });
    issues.push(issue);
  }

  if (shouldStartAnalyzeFromOrigin(ctx.origin || 'scheduler')) {
    await enqueueOutboxEvent({
      organizationId: task.organizationId,
      projectId: task.projectId,
      eventType: 'execution.analyze_requested',
      origin: ctx.origin || 'scheduler',
      payload: {
        taskId: String(task._id),
        issueIds: issues.map((i) => String(i._id)),
      },
    });
  }

  // Wave 3 heuristic propose (auto_safe) — LLM graph can replace via S2S later
  if (ctx.autoPropose !== false && issues.length && !detected.needsData) {
    for (const issue of issues) {
      try {
        const draft = buildHeuristicProposal({
          issue,
          task,
          impact: depImpact,
        });
        await saveProposalForIssue(issue._id, draft);
      } catch {
        /* validation/NEEDS_REVIEW recorded on issue */
      }
    }
  }

  return { detected, issues, depImpact };
}

async function createIncident({
  organizationId,
  projectId,
  title,
  description,
  kind,
  startedAt,
  endedAt,
  capacityImpact,
  affectedUserIds,
  affectedTaskIds,
  createdBy,
}) {
  const org = await resolveProjectOrganizationId(projectId, organizationId);
  const incident = await ProjectIncident.create({
    organizationId: org,
    projectId,
    title,
    description: description || '',
    kind: kind || 'other',
    startedAt: startedAt || new Date(),
    endedAt: endedAt || null,
    capacityImpact: capacityImpact || {},
    affectedUserIds: affectedUserIds || [],
    affectedTaskIds: affectedTaskIds || [],
    createdBy,
  });

  const rootIssue = await openOrRefreshIssue({
    organizationId: org,
    projectId,
    kind: 'INCIDENT',
    title: `Incident: ${title}`.slice(0, 240),
    summary: description || '',
    subjectTaskIds: affectedTaskIds || [],
    signals: ['INCIDENT'],
    evidence: [{ type: 'INCIDENT', incidentId: String(incident._id) }],
    interventionLevel: 'propose',
    createdBy,
  });

  incident.rootIssueId = rootIssue._id;
  await incident.save();

  // Link symptom issues under root
  if ((affectedTaskIds || []).length) {
    await ExecutionIssue.updateMany(
      {
        projectId,
        subjectTaskIds: { $in: affectedTaskIds },
        kind: { $in: ['OVERDUE', 'AT_RISK', 'BLOCKED'] },
        status: { $nin: ['resolved', 'cancelled'] },
      },
      { $set: { rootIssueId: rootIssue._id, rootIncidentId: incident._id } }
    );
  }

  await enqueueOutboxEvent({
    organizationId: org,
    projectId,
    eventType: 'incident.created',
    origin: 'manual_incident',
    payload: { incidentId: String(incident._id), rootIssueId: String(rootIssue._id) },
  });

  return { incident: incident.toObject(), rootIssue };
}

async function createOrUpdateRisk(payload) {
  const {
    organizationId,
    projectId,
    title,
    description,
    ownerId,
    assessment,
    scopeRefs,
    triggers,
    preventionActions,
    contingency,
    nextReviewAt,
    createdBy,
    seedFromPlanningArtifactId,
  } = payload;
  const doc = await ProjectRisk.create({
    organizationId,
    projectId,
    title,
    description: description || '',
    ownerId: ownerId || null,
    assessment: assessment || {},
    scopeRefs: scopeRefs || {},
    triggers: triggers || [],
    preventionActions: preventionActions || [],
    contingency: contingency || {},
    nextReviewAt: nextReviewAt || null,
    createdBy: createdBy || null,
    seedFromPlanningArtifactId: seedFromPlanningArtifactId || null,
    status: 'watching',
  });
  return doc.toObject();
}

async function confirmRiskOccurred(riskId, { organizationId, userId, note = '' }) {
  const risk = await ProjectRisk.findOne({ _id: riskId, organizationId });
  if (!risk) {
    const err = new Error('Risk not found');
    err.statusCode = 404;
    throw err;
  }
  risk.status = 'occurred';
  for (const t of risk.triggers || []) {
    if (t.kind === 'confirm') {
      t.observed = true;
      t.observedAt = new Date();
    }
  }
  const issue = await openOrRefreshIssue({
    organizationId: risk.organizationId,
    projectId: risk.projectId,
    kind: 'RISK_OCCURRED',
    title: `Risk occurred: ${risk.title}`.slice(0, 240),
    summary: note || risk.description || '',
    subjectTaskIds: risk.scopeRefs?.taskIds || [],
    signals: ['RISK_OCCURRED'],
    evidence: [{ type: 'RISK_OCCURRED', riskId: String(risk._id) }],
    activatedFromRiskId: risk._id,
    interventionLevel: 'propose',
    createdBy: userId,
  });
  risk.activatedIssueId = issue._id;
  await risk.save();
  await enqueueOutboxEvent({
    organizationId: risk.organizationId,
    projectId: risk.projectId,
    eventType: 'risk.occurred',
    origin: 'risk_trigger',
    payload: {
      riskId: String(risk._id),
      issueId: String(issue._id),
      contingency: risk.contingency || {},
    },
  });
  return { risk: risk.toObject(), issue };
}

async function listIssues(projectId, { status, view = 'summary' } = {}) {
  const q = { projectId };
  if (status) q.status = status;
  const rows = await ExecutionIssue.find(q).sort({ updatedAt: -1 }).limit(200).lean();
  if (view === 'full') return rows;
  return rows.map((r) => ({
    _id: r._id,
    kind: r.kind,
    status: r.status,
    title: r.title,
    signals: r.signals,
    subjectTaskIds: r.subjectTaskIds,
    goalImpact: r.goalImpact,
    impactStatus: r.impactStatus,
    interventionLevel: r.interventionLevel,
    needsData: r.needsData,
    rootIssueId: r.rootIssueId,
    activatedFromRiskId: r.activatedFromRiskId,
    latestProposalId: r.latestProposalId,
    updatedAt: r.updatedAt,
  }));
}

async function getIssue(issueId, { view = 'full' } = {}) {
  const issue = await ExecutionIssue.findById(issueId).lean();
  if (!issue) return null;
  if (view !== 'full') return issue;
  const proposals = await ExecutionProposal.find({ issueId }).sort({ proposalRevision: -1 }).lean();
  const errors = await ExecutionErrorRecord.find({ issueId }).sort({ createdAt: -1 }).limit(20).lean();
  return { ...issue, proposals, errors };
}

async function saveProposalForIssue(issueId, proposalInput) {
  const issue = await ExecutionIssue.findById(issueId);
  if (!issue) {
    const err = new Error('Issue not found');
    err.statusCode = 404;
    throw err;
  }
  const last = await ExecutionProposal.findOne({ issueId }).sort({ proposalRevision: -1 }).lean();
  const revision = (last?.proposalRevision || 0) + 1;
  const proposal = buildProposal({ ...proposalInput, proposalRevision: revision, status: 'draft' });
  const v = validateProposal(proposal);
  if (!v.ok) {
    const classified = classifyException(
      { code: 'PROPOSAL_INVALID', message: v.errors.join(',') },
      { failedStep: 'validate', attemptCount: proposalInput.attemptCount || 0 }
    );
    await ExecutionErrorRecord.create({
      organizationId: issue.organizationId,
      projectId: issue.projectId,
      issueId: issue._id,
      ...classified.record,
    });
    if (classified.next === 'NEEDS_REVIEW') {
      issue.status = 'needs_review';
      await issue.save();
    }
    const err = new Error(`Invalid proposal: ${v.errors.join(', ')}`);
    err.statusCode = 400;
    err.classification = classified;
    throw err;
  }

  // Block actions needing full impact when PARTIAL/UNSUPPORTED
  const { allowed, blocked } = filterActionsByImpact(
    { impactStatus: issue.impactStatus },
    proposal.actions
  );
  if (blocked.length) {
    proposal.actions = allowed;
    proposal.assumptions = [
      ...(proposal.assumptions || []),
      {
        text: 'Some actions blocked due to incomplete dependency impact',
        status: 'UNVERIFIED',
        blocked,
      },
    ];
  }

  proposal.status = 'pending_approval';
  const doc = await ExecutionProposal.create({
    organizationId: issue.organizationId,
    projectId: issue.projectId,
    issueId: issue._id,
    ...proposal,
  });
  issue.latestProposalId = doc._id;
  issue.status = 'awaiting_approval';
  await issue.save();
  return doc.toObject();
}

/**
 * HTTP approve → domain decision → outbox resume (RULE-EC-07).
 */
async function decideProposal(proposalId, { decision, userId, note = '' }) {
  const proposal = await ExecutionProposal.findById(proposalId);
  if (!proposal) {
    const err = new Error('Proposal not found');
    err.statusCode = 404;
    throw err;
  }
  if (proposal.status === 'approved' || proposal.status === 'applied') {
    return { proposal: proposal.toObject(), idempotent: true };
  }
  if (proposal.status !== 'pending_approval' && proposal.status !== 'validated') {
    const err = new Error(`Cannot decide proposal in status ${proposal.status}`);
    err.statusCode = 409;
    throw err;
  }

  const dec = String(decision || '').toLowerCase();
  if (dec !== 'approved' && dec !== 'rejected') {
    const err = new Error('decision must be approved|rejected');
    err.statusCode = 400;
    throw err;
  }

  proposal.decision = {
    decision: dec,
    decidedBy: userId,
    decidedAt: new Date(),
    note: String(note || '').slice(0, 2000),
  };
  proposal.status = dec === 'approved' ? 'approved' : 'rejected';
  await proposal.save();

  const issue = await ExecutionIssue.findById(proposal.issueId);
  if (issue) {
    issue.status = dec === 'approved' ? 'applying' : 'open';
    await issue.save();
  }

  await enqueueOutboxEvent({
    organizationId: proposal.organizationId,
    projectId: proposal.projectId,
    eventType: dec === 'approved' ? 'proposal.approved' : 'proposal.rejected',
    origin: 'resume',
    payload: {
      proposalId: String(proposal._id),
      issueId: String(proposal.issueId),
      proposalRevision: proposal.proposalRevision,
      decision: dec,
    },
  });

  if (dec === 'approved') {
    // Apply immediately in-process (S2S graph may also resume); idempotent locks protect
    await applyApprovedProposal(proposal._id, { actorId: userId });
  }

  return { proposal: proposal.toObject(), idempotent: false };
}

async function mongoApplyStore(organizationId, projectId, proposalId, proposalRevision) {
  return {
    async get(lockKey) {
      const row = await ExecutionApplyAction.findOne({ lockKey }).lean();
      return row
        ? { status: row.status, result: row.result, error: row.error }
        : null;
    },
    async set(lockKey, value) {
      await ExecutionApplyAction.findOneAndUpdate(
        { lockKey },
        {
          $set: {
            lockKey,
            organizationId,
            projectId,
            proposalId,
            proposalRevision,
            actionId: String(lockKey.split(':').pop()),
            status: value.status,
            result: value.result || null,
            error: value.error || '',
          },
        },
        { upsert: true }
      );
    },
  };
}

async function executeTaskAction(action) {
  const taskId = action.entityId;
  const op = action.op;
  const payload = action.payload || {};

  if (action.entityType !== 'task') {
    return { skipped: true, reason: 'unsupported_entity' };
  }

  if (op === 'set_forecast') {
    const task = await Task.findByIdAndUpdate(
      taskId,
      {
        $set: {
          'forecast.finishDate': payload.finishDate || null,
          'forecast.remainingHours': payload.remainingHours ?? null,
          'forecast.riskLabel': payload.riskLabel || '',
          'forecast.computedAt': new Date(),
          'forecast.inputVersion': payload.inputVersion || '',
          'forecast.baselineVersion': payload.baselineVersion || 0,
          'forecast.completeness': payload.completeness || 'PARTIAL',
        },
        $inc: { entityVersion: 1 },
      },
      { new: true }
    ).lean();
    return { taskId, op, ok: Boolean(task) };
  }

  if (op === 'set_risk_label') {
    await Task.findByIdAndUpdate(taskId, {
      $set: { 'forecast.riskLabel': payload.riskLabel || 'AT_RISK' },
      $inc: { entityVersion: 1 },
    });
    return { taskId, op, ok: true };
  }

  if (op === 'patch_assignee' || op === 'patch_due' || op === 'patch_sprint') {
    // Requires approve path already; re-check versions by caller
    const $set = {};
    if (op === 'patch_assignee') $set.assigneeId = payload.assigneeId || null;
    if (op === 'patch_due') $set.dueDate = payload.dueDate || null;
    if (op === 'patch_sprint') $set.sprintId = payload.sprintId || null;
    const task = await Task.findByIdAndUpdate(
      taskId,
      { $set, $inc: { entityVersion: 1 } },
      { new: true }
    ).lean();
    return { taskId, op, ok: Boolean(task) };
  }

  if (op === 'add_blocker') {
    await Task.findByIdAndUpdate(taskId, {
      $push: {
        blockers: {
          kind: payload.kind || 'other',
          reason: payload.reason || '',
          ownerId: payload.ownerId || null,
          relatedTaskId: payload.relatedTaskId || null,
          since: new Date(),
        },
      },
      $inc: { entityVersion: 1 },
    });
    return { taskId, op, ok: true };
  }

  // Non-mutating recommendations — record only on approve (no board write)
  if (String(op || '').startsWith('recommend_')) {
    return {
      taskId,
      op,
      ok: true,
      recommendOnly: true,
      message: payload.message || '',
    };
  }

  return { skipped: true, reason: `unknown_op:${op}` };
}

async function applyApprovedProposal(proposalId, { actorId } = {}) {
  const proposal = await ExecutionProposal.findById(proposalId);
  if (!proposal) {
    const err = new Error('Proposal not found');
    err.statusCode = 404;
    throw err;
  }
  if (proposal.status !== 'approved' && proposal.status !== 'applying' && proposal.status !== 'reconciling') {
    if (proposal.status === 'applied') return { status: 'applied', idempotent: true };
    const err = new Error(`Proposal not approved (${proposal.status})`);
    err.statusCode = 409;
    throw err;
  }

  // Version check
  const versions = proposal.expectedVersions || {};
  for (const action of proposal.actions || []) {
    if (action.entityType === 'task' && versions[`task:${action.entityId}`] != null) {
      const task = await Task.findById(action.entityId).select('entityVersion').lean();
      const check = checkExpectedVersions(
        { entityVersion: versions[`task:${action.entityId}`] },
        { entityVersion: task?.entityVersion }
      );
      if (!check.ok) {
        proposal.status = 'invalidated';
        await proposal.save();
        await ExecutionIssue.findByIdAndUpdate(proposal.issueId, { status: 'needs_review' });
        const err = new Error('Version mismatch — proposal invalidated');
        err.statusCode = 409;
        err.code = 'VERSION_MISMATCH';
        throw err;
      }
    }
  }

  proposal.status = 'applying';
  await proposal.save();

  const store = await mongoApplyStore(
    proposal.organizationId,
    proposal.projectId,
    proposal._id,
    proposal.proposalRevision
  );

  const { applyActionBatch } = require('./executionControl/applyReconcile');
  const batch = await applyActionBatch({
    proposalId: String(proposal._id),
    proposalRevision: proposal.proposalRevision,
    actions: proposal.actions || [],
    execute: executeTaskAction,
    store,
    correlationId: String(proposal._id),
  });

  proposal.appliedActionIds = batch.appliedActionIds || [];
  proposal.failedActionIds = batch.failedActionIds || [];

  if (batch.status === 'reconciling') {
    proposal.status = 'reconciling';
    await proposal.save();
    await ExecutionIssue.findByIdAndUpdate(proposal.issueId, { status: 'reconciling' });
    return batch;
  }

  if (batch.status === 'partially_applied') {
    proposal.status = 'partially_applied';
    await proposal.save();
    await ExecutionIssue.findByIdAndUpdate(proposal.issueId, { status: 'needs_review' });
    await enqueueOutboxEvent({
      organizationId: proposal.organizationId,
      projectId: proposal.projectId,
      eventType: 'proposal.partially_applied',
      origin: 'system_apply',
      payload: { proposalId: String(proposal._id), ...batch },
    });
    return batch;
  }

  if (batch.status === 'apply_failed') {
    proposal.status = 'apply_failed';
    await proposal.save();
    return batch;
  }

  proposal.status = 'applied';
  await proposal.save();

  const followUpAt = new Date(Date.now() + 24 * 3600 * 1000);
  await ExecutionIssue.findByIdAndUpdate(proposal.issueId, {
    status: 'monitoring',
    followUpAt,
  });

  await enqueueOutboxEvent({
    organizationId: proposal.organizationId,
    projectId: proposal.projectId,
    eventType: 'proposal.applied',
    origin: 'system_apply',
    payload: {
      proposalId: String(proposal._id),
      issueId: String(proposal.issueId),
      actorId: actorId || null,
    },
  });

  return batch;
}

async function runFollowUp(issueId) {
  const issue = await ExecutionIssue.findById(issueId);
  if (!issue) return null;
  const proposal = issue.latestProposalId
    ? await ExecutionProposal.findById(issue.latestProposalId).lean()
    : null;
  const taskIds = issue.subjectTaskIds || [];
  const tasks = await Task.find({ _id: { $in: taskIds } }).lean();
  const task = tasks[0];
  const detected = task ? detectTaskSignals(task, {}) : { signals: [] };
  const actual = {
    remainingHours: task?.remainingHours,
    remainingSource: task?.remainingSource,
    openBlockers: (task?.blockers || []).filter((b) => !b.resolvedAt),
    signals: detected.signals,
    tcAllPass: undefined,
    riskResidual: undefined,
  };
  const evalResult = evaluateFollowUpCriteria(proposal?.followUpCriteria || [], actual);
  const decision = decideIssueAfterFollowUp({
    criteriaPassed: evalResult.passed,
    failCount: issue.followUpFailCount || 0,
    hardSignals: detected.signals.filter((s) =>
      ['OVERDUE', 'BLOCKED', 'AT_RISK', 'QUALITY_FAIL'].includes(s)
    ),
  });
  issue.followUpResults = evalResult.results;
  if (decision.issueStatus === 'monitoring') {
    issue.followUpFailCount = (issue.followUpFailCount || 0) + 1;
  }
  if (decision.issueStatus === 'resolved') {
    issue.resolvedAt = new Date();
  }
  issue.status = decision.issueStatus;
  await issue.save();
  return { issue: issue.toObject(), evalResult, decision };
}

async function migrateProjectBaselines(projectId, { trustedByTaskId = {} } = {}) {
  const tasks = await Task.find({ projectId, isActive: true }).lean();
  let snapshotted = 0;
  let missing = 0;
  for (const t of tasks) {
    const trusted = trustedByTaskId[String(t._id)] || null;
    const { status, patch } = backfillBaselineFromTrustedSource(t, trusted);
    if (Object.keys(patch).length) {
      await Task.updateOne({ _id: t._id }, { $set: patch });
    }
    if (status === 'snapshotted') snapshotted += 1;
    else missing += 1;
  }
  return { total: tasks.length, snapshotted, missing };
}

module.exports = {
  confirmTaskRemaining,
  syncDependsOnFromEdges,
  snapshotBaselineOnPromote,
  openOrRefreshIssue,
  scanTask,
  createIncident,
  createOrUpdateRisk,
  confirmRiskOccurred,
  listIssues,
  getIssue,
  saveProposalForIssue,
  decideProposal,
  applyApprovedProposal,
  runFollowUp,
  migrateProjectBaselines,
  detectSprintGoalAtRisk,
  simulateSprintScopeOptions,
  filterOverloadedCandidates,
  computeCostVariance,
  diffRequirementKeys,
  buildScopeChangeCrDraft,
  computeAvailableCapacityToDue,
  fingerprintFor,
};
