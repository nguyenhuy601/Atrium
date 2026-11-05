/**
 * Deterministic enriched proposal — situation + evidence numbers from tools only.
 * No LLM; no invented savings days / assignee picks without matching.
 */

const { buildProposal, newActionId } = require('./proposalContract');

function findEvidence(evidence = [], type) {
  return (evidence || []).find((e) => e && e.type === type) || null;
}

function iso(v) {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toISOString();
}

/**
 * Build structured situation + narrative from issue evidence / impact / task.
 * @returns {{ situation: object, summary: string, evidenceRefs: object[], assumptions: object[], preconditions: object[], recommendActions: object[] }}
 */
function buildSituationPack({ issue, task, impact } = {}) {
  const kind = String(issue?.kind || (issue?.signals || [])[0] || 'UNKNOWN');
  const evidence = Array.isArray(issue?.evidence) ? issue.evidence : [];
  const impactStatus = impact?.impactStatus || issue?.impactStatus || 'UNKNOWN';
  const successors = Array.isArray(impact?.affectedTaskIds) ? impact.affectedTaskIds.map(String) : [];
  const skippedEdges = Array.isArray(impact?.skippedEdges) ? impact.skippedEdges : [];
  const taskTitle = String(task?.title || task?._id || 'task');
  const taskId = task?._id ? String(task._id) : '';

  const atRisk = findEvidence(evidence, 'AT_RISK');
  const overdue = findEvidence(evidence, 'OVERDUE');
  const blocked = findEvidence(evidence, 'BLOCKED');
  const stale = findEvidence(evidence, 'STALE_PROGRESS');
  const needsData = findEvidence(evidence, 'NEEDS_DATA');
  const depConflict = findEvidence(evidence, 'DEPENDENCY_CONFLICT');
  const quality = findEvidence(evidence, 'QUALITY_FAIL');
  const cost = findEvidence(evidence, 'COST_OVERRUN');
  const unassigned = findEvidence(evidence, 'UNASSIGNED');
  const capacity = findEvidence(evidence, 'CAPACITY_OVERLOAD');

  const remainingHours =
    atRisk?.remainingHours != null
      ? Number(atRisk.remainingHours)
      : task?.remainingSource === 'confirmed'
        ? Number(task.remainingHours)
        : null;
  const availableCapacity =
    atRisk?.availableCapacityToDueHours != null
      ? Number(atRisk.availableCapacityToDueHours)
      : null;
  const gapHours =
    Number.isFinite(remainingHours) && Number.isFinite(availableCapacity)
      ? Math.max(0, remainingHours - availableCapacity)
      : null;

  const evidenceRefs = evidence.map((e, i) => {
    const base = {
      id: `ev:${e.type || i}`,
      type: String(e.type || 'UNKNOWN'),
    };
    if (e.type === 'AT_RISK') {
      return {
        ...base,
        remainingHours: e.remainingHours,
        availableCapacityToDueHours: e.availableCapacityToDueHours,
        remainingUpdatedAt: iso(e.remainingUpdatedAt),
        gapHours:
          Number.isFinite(Number(e.remainingHours)) &&
          Number.isFinite(Number(e.availableCapacityToDueHours))
            ? Math.max(0, Number(e.remainingHours) - Number(e.availableCapacityToDueHours))
            : null,
      };
    }
    if (e.type === 'OVERDUE') {
      return { ...base, dueDate: iso(e.dueDate), now: iso(e.now) };
    }
    if (e.type === 'BLOCKED') {
      return {
        ...base,
        blockers: Array.isArray(e.blockers) ? e.blockers : [],
      };
    }
    if (e.type === 'STALE_PROGRESS') {
      return {
        ...base,
        lastProgressAt: iso(e.lastProgressAt),
        staleDays: e.staleDays,
      };
    }
    if (e.type === 'NEEDS_DATA') {
      return { ...base, reason: e.reason || null };
    }
    if (e.type === 'DEPENDENCY_CONFLICT') {
      return { ...base, edges: e.edges || [] };
    }
    if (e.type === 'QUALITY_FAIL') {
      return {
        ...base,
        tcFailed: Boolean(e.tcFailed),
        blockingBug: Boolean(e.blockingBug),
        reopenCount: e.reopenCount,
      };
    }
    if (e.type === 'COST_OVERRUN') {
      return {
        ...base,
        varianceRatio: e.varianceRatio,
        threshold: e.threshold,
      };
    }
    return { ...base, raw: e };
  });

  if (successors.length || skippedEdges.length) {
    evidenceRefs.push({
      id: 'ev:DEP_CHAIN',
      type: 'DEP_CHAIN',
      impactStatus,
      successors,
      skippedEdges,
      fsChain: Array.isArray(impact?.fsChain) ? impact.fsChain.map(String) : [],
    });
  }

  const goal = issue?.goalImpact || {};
  if (goal.affectsSprintGoal || goal.goalImpactStatus === 'EVIDENCED') {
    evidenceRefs.push({
      id: 'ev:GOAL',
      type: 'GOAL_IMPACT',
      goalImpactStatus: goal.goalImpactStatus || 'UNKNOWN',
      affectsSprintGoal: Boolean(goal.affectsSprintGoal),
      evidence: goal.evidence || null,
    });
  }

  const assumptions = [
    {
      key: 'source',
      text: 'Đề xuất heuristic deterministic — chưa qua LLM',
      status: 'UNVERIFIED',
    },
  ];
  const preconditions = [];
  const recommendActions = [];
  const lines = [];

  lines.push(`Tình huống [${kind}] trên task «${taskTitle}».`);

  if (overdue) {
    lines.push(
      `Quá hạn: due ${iso(overdue.dueDate) || '—'} (so với ${iso(overdue.now) || 'now'}).`
    );
  }

  if (atRisk && Number.isFinite(remainingHours) && Number.isFinite(availableCapacity)) {
    lines.push(
      `Nguy cơ trễ: remaining confirmed ${remainingHours}h, capacity đến due ${availableCapacity}h (gap ${gapHours}h).`
    );
    preconditions.push({
      key: 'remaining_fresh_confirmed',
      text: 'remainingSource=confirmed và còn trong cửa sổ freshness lúc detect',
      ok: true,
    });
    preconditions.push({
      key: 'capacity_window',
      text: 'Capacity đã trừ phân bổ khác nếu caller cung cấp; kiểm tra lại trước apply cam kết',
      ok: availableCapacity != null,
    });
  } else if (kind === 'AT_RISK') {
    lines.push('AT_RISK được ghi nhận nhưng thiếu cặp remaining/capacity đầy đủ trong evidence.');
    assumptions.push({
      key: 'at_risk_incomplete_evidence',
      text: 'Thiếu remaining hoặc capacity trong evidence AT_RISK',
      status: 'UNVERIFIED',
    });
  }

  if (blocked) {
    const bl = Array.isArray(blocked.blockers) ? blocked.blockers : [];
    const parts = bl
      .slice(0, 3)
      .map((b) => `${b.kind || 'other'}:${String(b.reason || '').slice(0, 80)}`)
      .filter(Boolean);
    lines.push(
      parts.length
        ? `Bị chặn: ${parts.join('; ')}${bl.length > 3 ? '…' : ''}.`
        : 'Bị chặn (có blocker mở).'
    );
    if (taskId) {
      recommendActions.push({
        actionId: newActionId('rec_unblock'),
        entityType: 'task',
        entityId: taskId,
        op: 'recommend_unblock',
        payload: {
          message:
            'Xác định đầu mối tháo blocker; ưu tiên công việc song song không phụ thuộc đầu vào bị chặn.',
          blockers: bl,
        },
        requiresFullImpact: false,
      });
    }
  }

  if (stale) {
    lines.push(
      `Tiến độ lâu không cập nhật (lastProgress ${iso(stale.lastProgressAt) || '—'}, ngưỡng ${stale.staleDays ?? '—'} ngày) — tín hiệu riêng, không đồng nghĩa AT_RISK.`
    );
  }
  if (needsData) {
    lines.push(`Thiếu dữ liệu: ${needsData.reason || 'needs_data'}.`);
  }
  if (unassigned) {
    lines.push('Task chưa có người phụ trách.');
    if (taskId) {
      recommendActions.push({
        actionId: newActionId('rec_assign'),
        entityType: 'task',
        entityId: taskId,
        op: 'recommend_assign',
        payload: {
          message:
            'Cần gán người — lọc ứng viên quá tải trước khi chọn (chưa tự gán trong heuristic).',
        },
        requiresFullImpact: false,
      });
    }
  }
  if (capacity) {
    lines.push('Assignee đang quá tải capacity (theo tín hiệu scan).');
  }
  if (depConflict) {
    lines.push('Xung đột/phụ thuộc đầu vào chưa sẵn sàng.');
  }
  if (quality) {
    lines.push(
      `Chất lượng: TC fail=${Boolean(quality.tcFailed)}, bug chặn=${Boolean(quality.blockingBug)}, reopen=${quality.reopenCount ?? 0}.`
    );
    if (taskId) {
      recommendActions.push({
        actionId: newActionId('rec_qa'),
        entityType: 'task',
        entityId: taskId,
        op: 'recommend_quality_fix',
        payload: {
          message: 'Ưu tiên sửa theo TC fail/bug; bổ sung kiểm thử trước khi Confirm Done.',
        },
        requiresFullImpact: false,
      });
    }
  }
  if (cost) {
    lines.push(
      `Chi phí/giờ vượt ngưỡng: varianceRatio=${cost.varianceRatio}, threshold=${cost.threshold}.`
    );
  }

  if (successors.length) {
    lines.push(
      `Chuỗi phụ thuộc FS ảnh hưởng: ${successors.slice(0, 8).join(', ')}${successors.length > 8 ? '…' : ''} (impactStatus=${impactStatus}).`
    );
  } else if (impactStatus === 'PARTIAL_IMPACT' || impactStatus === 'UNSUPPORTED') {
    lines.push(
      `Impact dependency ${impactStatus} — không khẳng định đủ chuỗi; action phụ thuộc impact đầy đủ bị chặn.`
    );
  }

  if (goal.affectsSprintGoal) {
    lines.push('Có bằng chứng ảnh hưởng Sprint Goal (Story↔Goal).');
  } else if (goal.goalImpactStatus === 'UNKNOWN') {
    lines.push('Ảnh hưởng Sprint Goal: UNKNOWN (thiếu link Story↔Goal).');
  }

  assumptions.push({
    key: 'dependency_impact',
    text: `impactStatus=${impactStatus}`,
    status: impactStatus === 'FULL' ? 'VERIFIED_BY_TOOL' : 'PARTIAL',
  });

  if (impactStatus === 'PARTIAL_IMPACT' || impactStatus === 'UNSUPPORTED') {
    preconditions.push({
      key: 'full_impact_not_available',
      text: 'Không apply action requiresFullImpact khi impact chưa FULL',
      ok: true,
    });
  }

  // recommend parallel work when blocked + successors
  if (blocked && successors.length && taskId) {
    recommendActions.push({
      actionId: newActionId('rec_parallel'),
      entityType: 'task',
      entityId: taskId,
      op: 'recommend_parallel_work',
      payload: {
        message:
          'Successor có thể chuẩn bị phần không cần đầu vào bị chặn (vd. mock) — cần xác nhận phạm vi tách được trước khi đổi cam kết.',
        successorIds: successors,
      },
      requiresFullImpact: impactStatus === 'FULL',
      dependsOnImpact: impactStatus === 'FULL',
    });
  }

  if (kind === 'AT_RISK' && gapHours != null && gapHours > 0 && taskId) {
    recommendActions.push({
      actionId: newActionId('rec_support'),
      entityType: 'task',
      entityId: taskId,
      op: 'recommend_support',
      payload: {
        message: `Gap ~${gapHours}h so với capacity đến due. Cân nhắc hỗ trợ phần độc lập hoặc điều chỉnh thứ tự — chỉ sau khi lọc ứng viên không quá tải; heuristic không tự gán người.`,
        gapHours,
        remainingHours,
        availableCapacityToDueHours: availableCapacity,
      },
      requiresFullImpact: false,
    });
  }

  lines.push(
    'Đề xuất áp dụng ngay (cần duyệt): cập nhật nhãn rủi ro / forecast. Đổi assignee, deadline hoặc sprint cam kết không nằm trong bản auto_safe này.'
  );

  const situation = {
    kind,
    taskId: taskId || null,
    taskTitle,
    signals: Array.isArray(issue?.signals) ? issue.signals : [],
    remainingHours: Number.isFinite(remainingHours) ? remainingHours : null,
    availableCapacityToDueHours: Number.isFinite(availableCapacity) ? availableCapacity : null,
    gapHours,
    impactStatus,
    successors,
    goalImpactStatus: goal.goalImpactStatus || 'UNKNOWN',
    affectsSprintGoal: Boolean(goal.affectsSprintGoal),
    narrativeLines: lines,
  };

  return {
    situation,
    summary: lines.join(' ').slice(0, 2000),
    evidenceRefs,
    assumptions,
    preconditions,
    recommendActions,
  };
}

/**
 * @param {{ issue: object, task: object, impact?: object }} input
 */
function buildHeuristicProposal({ issue, task, impact } = {}) {
  const kind = issue?.kind || (issue?.signals || [])[0] || 'AT_RISK';
  const pack = buildSituationPack({ issue, task, impact });
  const actions = [];

  // Auto-safe mutate actions (still pending_approval in service)
  if (task?._id) {
    actions.push({
      actionId: newActionId('label'),
      entityType: 'task',
      entityId: String(task._id),
      op: 'set_risk_label',
      payload: { riskLabel: kind },
      requiresFullImpact: false,
    });
    if (Number.isFinite(Number(task.remainingHours)) && task.remainingSource === 'confirmed') {
      actions.push({
        actionId: newActionId('fc'),
        entityType: 'task',
        entityId: String(task._id),
        op: 'set_forecast',
        payload: {
          remainingHours: Number(task.remainingHours),
          riskLabel: kind,
          completeness: (impact?.impactStatus || pack.situation.impactStatus) === 'FULL' ? 'FULL' : 'PARTIAL',
          inputVersion: `task:${task.entityVersion || 0}`,
          baselineVersion: task.baselineVersion || 0,
          finishDate: null,
        },
        requiresFullImpact: false,
      });
    }
  }

  for (const rec of pack.recommendActions) {
    actions.push(rec);
  }

  return buildProposal({
    summary: pack.summary,
    situation: pack.situation,
    actions,
    evidenceRefs: pack.evidenceRefs,
    assumptions: pack.assumptions,
    preconditions: pack.preconditions,
    simulationRef: {
      type: 'heuristic_forecast',
      impactStatus: pack.situation.impactStatus,
      gapHours: pack.situation.gapHours,
      remainingHours: pack.situation.remainingHours,
      availableCapacityToDueHours: pack.situation.availableCapacityToDueHours,
      successors: pack.situation.successors,
    },
    expectedVersions: task?._id
      ? { [`task:${task._id}`]: task.entityVersion || 0 }
      : {},
    approvalRequirements: [],
    followUpCriteria: [
      { type: 'no_hard_signals' },
      ...(Number.isFinite(pack.situation.remainingHours)
        ? [{ type: 'remaining_reduced', beforeRemaining: pack.situation.remainingHours }]
        : []),
    ],
    goalImpact: issue?.goalImpact || { goalImpactStatus: 'UNKNOWN' },
    interventionLevel: 'auto_safe',
    status: 'draft',
  });
}

module.exports = {
  buildHeuristicProposal,
  buildSituationPack,
};
