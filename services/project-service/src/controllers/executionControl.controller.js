const executionControl = require('../services/executionControl.service');
const { isExecutionControlEnabled } = require('../services/executionControl/constants');
const { sendServiceError, sendErrorFromCatch } = require('../middleware/sendServiceError');

function orgId(req) {
  return req.user?.organizationId || req.userContext?.organizationId || req.headers['x-organization-id'];
}

function userId(req) {
  return req.user?.id || req.user?._id || req.userContext?.userId || req.headers['x-user-id'];
}

async function listIssues(req, res) {
  try {
    if (!isExecutionControlEnabled()) {
      return res.status(200).json({ success: true, data: [] });
    }
    const data = await executionControl.listIssues(req.params.projectId, {
      status: req.query.status,
      view: String(req.query.view || 'summary'),
    });
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return sendErrorFromCatch(res, err);
  }
}

async function getIssue(req, res) {
  try {
    const data = await executionControl.getIssue(req.params.issueId, {
      view: String(req.query.view || 'full'),
    });
    if (!data) return sendServiceError(res, 404, { errorCode: 'NOT_FOUND', message: 'Not found' });
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return sendErrorFromCatch(res, err);
  }
}

async function confirmRemaining(req, res) {
  try {
    const task = await executionControl.confirmTaskRemaining(req.params.taskId, {
      remainingHours: req.body?.remainingHours,
      userId: userId(req),
      organizationId: orgId(req),
    });
    return res.status(200).json({ success: true, data: task });
  } catch (err) {
    return sendErrorFromCatch(res, err);
  }
}

async function createIncident(req, res) {
  try {
    if (!req.body?.title) {
      return sendServiceError(res, 400, { errorCode: 'VALIDATION', message: 'title required' });
    }
    const data = await executionControl.createIncident({
      organizationId: orgId(req),
      projectId: req.params.projectId,
      title: req.body.title,
      description: req.body?.description,
      kind: req.body?.kind,
      startedAt: req.body?.startedAt,
      endedAt: req.body?.endedAt,
      capacityImpact: req.body?.capacityImpact,
      affectedUserIds: req.body?.affectedUserIds,
      affectedTaskIds: req.body?.affectedTaskIds,
      createdBy: userId(req),
    });
    return res.status(201).json({ success: true, data });
  } catch (err) {
    return sendErrorFromCatch(res, err);
  }
}

async function listRisks(req, res) {
  try {
    const ProjectRisk = require('../models/ProjectRisk');
    const data = await ProjectRisk.find({ projectId: req.params.projectId })
      .sort({ updatedAt: -1 })
      .limit(100)
      .lean();
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return sendErrorFromCatch(res, err);
  }
}

async function createRisk(req, res) {
  try {
    if (!req.body?.title) {
      return sendServiceError(res, 400, { errorCode: 'VALIDATION', message: 'title required' });
    }
    const data = await executionControl.createOrUpdateRisk({
      organizationId: orgId(req),
      projectId: req.params.projectId,
      ...req.body,
      createdBy: userId(req),
    });
    return res.status(201).json({ success: true, data });
  } catch (err) {
    return sendErrorFromCatch(res, err);
  }
}

async function confirmRiskOccurred(req, res) {
  try {
    const data = await executionControl.confirmRiskOccurred(req.params.riskId, {
      organizationId: orgId(req),
      userId: userId(req),
      note: req.body?.note,
    });
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return sendErrorFromCatch(res, err);
  }
}

async function decideProposal(req, res) {
  try {
    const data = await executionControl.decideProposal(req.params.proposalId, {
      decision: req.body?.decision,
      userId: userId(req),
      note: req.body?.note,
    });
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return sendErrorFromCatch(res, err);
  }
}

async function saveProposal(req, res) {
  try {
    const data = await executionControl.saveProposalForIssue(req.params.issueId, req.body || {});
    return res.status(201).json({ success: true, data });
  } catch (err) {
    return sendErrorFromCatch(res, err);
  }
}

async function runFollowUp(req, res) {
  try {
    const data = await executionControl.runFollowUp(req.params.issueId);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return sendErrorFromCatch(res, err);
  }
}

async function scanProject(req, res) {
  try {
    const Task = require('../models/Task');
    const Sprint = require('../models/Sprint');
    const tasks = await Task.find({
      projectId: req.params.projectId,
      organizationId: orgId(req),
      isActive: true,
    })
      .limit(500)
      .lean();
    const sprints = await Sprint.find({ projectId: req.params.projectId }).lean();
    const sprintById = new Map(sprints.map((s) => [String(s._id), s]));
    const results = [];
    for (const task of tasks) {
      const capacity = Number(req.body?.defaultCapacityToDue);
      const r = await executionControl.scanTask(task, {
        availableCapacityToDueHours: Number.isFinite(capacity) ? capacity : null,
        sprint: sprintById.get(String(task.sprintId)) || null,
        origin: 'scheduler',
        actorId: userId(req),
        quality: req.body?.qualityByTask?.[String(task._id)],
        cost: req.body?.costByTask?.[String(task._id)],
        capacityOverload: Boolean(req.body?.overloadUserIds?.includes?.(String(task.assigneeId))),
      });
      results.push({ taskId: String(task._id), ...r });
    }
    return res.status(200).json({ success: true, data: { scanned: results.length, results } });
  } catch (err) {
    return sendErrorFromCatch(res, err);
  }
}

async function migrateBaselines(req, res) {
  try {
    const data = await executionControl.migrateProjectBaselines(req.params.projectId, {
      trustedByTaskId: req.body?.trustedByTaskId || {},
    });
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return sendErrorFromCatch(res, err);
  }
}

module.exports = {
  listIssues,
  getIssue,
  confirmRemaining,
  createIncident,
  listRisks,
  createRisk,
  confirmRiskOccurred,
  decideProposal,
  saveProposal,
  runFollowUp,
  scanProject,
  migrateBaselines,
};
