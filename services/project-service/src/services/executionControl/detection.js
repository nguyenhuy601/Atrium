/**
 * Deterministic detection rules (Wave 1 + Wave 5 extensions).
 * Signals are additive — NEEDS_DATA never replaces OVERDUE evidence.
 */

const {
  REMAINING_FRESH_HOURS_DEFAULT,
  STALE_PROGRESS_DAYS_DEFAULT,
} = require('./constants');
const { isRemainingFresh } = require('./remainingEffort');

const DONE_STATUSES = new Set(['done', 'completed', 'closed', 'cancelled', 'canceled']);

function isDoneStatus(status) {
  return DONE_STATUSES.has(String(status || '').trim().toLowerCase());
}

/**
 * @param {object} task
 * @param {{
 *   now?: Date,
 *   availableCapacityToDueHours?: number|null,
 *   remainingFreshHours?: number,
 *   staleProgressDays?: number,
 *   hasCompletionEvidence?: boolean,
 *   openBlockers?: array,
 *   quality?: { tcFailed?: boolean, blockingBug?: boolean, reopenThreshold?: number },
 *   cost?: { varianceRatio?: number, threshold?: number },
 *   dependencyConflicts?: array,
 *   capacityOverload?: boolean,
 * }} ctx
 * @returns {{ signals: string[], evidence: object[], needsData: boolean, flags: object }}
 */
function detectTaskSignals(task, ctx = {}) {
  const now = ctx.now instanceof Date ? ctx.now : new Date();
  const signals = [];
  const evidence = [];
  let needsData = false;
  const flags = {};

  if (!task || isDoneStatus(task.status)) {
    if (task && isDoneStatus(task.status) && ctx.hasCompletionEvidence === false) {
      signals.push('DONE_NO_EVIDENCE');
      needsData = true;
      evidence.push({ type: 'DONE_NO_EVIDENCE', message: 'Done without completion evidence' });
    }
    return { signals, evidence, needsData, flags };
  }

  const due = task.dueDate ? new Date(task.dueDate) : null;
  if (due && !Number.isNaN(due.getTime()) && now.getTime() > due.getTime()) {
    signals.push('OVERDUE');
    evidence.push({
      type: 'OVERDUE',
      dueDate: due.toISOString(),
      now: now.toISOString(),
    });
  }

  const freshHours = ctx.remainingFreshHours ?? REMAINING_FRESH_HOURS_DEFAULT;
  const capacity = ctx.availableCapacityToDueHours;
  const remainingOk = isRemainingFresh(task, { now, freshHours });

  if (
    remainingOk &&
    Number.isFinite(Number(capacity)) &&
    Number(task.remainingHours) > Number(capacity)
  ) {
    signals.push('AT_RISK');
    evidence.push({
      type: 'AT_RISK',
      remainingHours: Number(task.remainingHours),
      availableCapacityToDueHours: Number(capacity),
      remainingUpdatedAt: task.remainingUpdatedAt,
    });
  } else if (
    task.remainingSource !== 'confirmed' ||
    !Number.isFinite(Number(task.remainingHours)) ||
    (task.remainingSource === 'confirmed' && !remainingOk)
  ) {
    // Missing/stale remaining — additive NEEDS_DATA; does not invent AT_RISK
    if (due || Number.isFinite(Number(task.estimateHours))) {
      needsData = true;
      signals.push('NEEDS_DATA');
      evidence.push({
        type: 'NEEDS_DATA',
        reason:
          task.remainingSource !== 'confirmed'
            ? 'remaining_not_confirmed'
            : 'remaining_stale',
      });
    }
  }

  const openBlockers =
    ctx.openBlockers ||
    (Array.isArray(task.blockers)
      ? task.blockers.filter((b) => b && !b.resolvedAt)
      : []);
  if (openBlockers.length) {
    signals.push('BLOCKED');
    evidence.push({
      type: 'BLOCKED',
      blockers: openBlockers.map((b) => ({
        kind: b.kind,
        reason: b.reason,
        relatedTaskId: b.relatedTaskId,
      })),
    });
  }

  const staleDays = ctx.staleProgressDays ?? STALE_PROGRESS_DAYS_DEFAULT;
  const progressAt = task.lastProgressAt
    ? new Date(task.lastProgressAt)
    : task.updatedAt
      ? new Date(task.updatedAt)
      : null;
  if (progressAt && !Number.isNaN(progressAt.getTime())) {
    const ageMs = now.getTime() - progressAt.getTime();
    if (ageMs > staleDays * 24 * 3600 * 1000) {
      signals.push('STALE_PROGRESS');
      needsData = true;
      if (!signals.includes('NEEDS_DATA')) signals.push('NEEDS_DATA');
      evidence.push({
        type: 'STALE_PROGRESS',
        lastProgressAt: progressAt.toISOString(),
        staleDays,
      });
    }
  }

  if (!task.assigneeId) {
    signals.push('UNASSIGNED');
    evidence.push({ type: 'UNASSIGNED' });
  }

  if (ctx.capacityOverload) {
    signals.push('CAPACITY_OVERLOAD');
    evidence.push({ type: 'CAPACITY_OVERLOAD' });
  }

  if (Array.isArray(ctx.dependencyConflicts) && ctx.dependencyConflicts.length) {
    signals.push('DEPENDENCY_CONFLICT');
    evidence.push({ type: 'DEPENDENCY_CONFLICT', edges: ctx.dependencyConflicts });
  }

  const q = ctx.quality || {};
  if (q.tcFailed || q.blockingBug || (Number(task.reopenCount) >= (q.reopenThreshold || 3))) {
    signals.push('QUALITY_FAIL');
    evidence.push({
      type: 'QUALITY_FAIL',
      tcFailed: Boolean(q.tcFailed),
      blockingBug: Boolean(q.blockingBug),
      reopenCount: Number(task.reopenCount || 0),
    });
  }

  const cost = ctx.cost || {};
  const threshold = cost.threshold != null ? Number(cost.threshold) : 1.2;
  if (Number.isFinite(Number(cost.varianceRatio)) && Number(cost.varianceRatio) >= threshold) {
    signals.push('COST_OVERRUN');
    evidence.push({
      type: 'COST_OVERRUN',
      varianceRatio: Number(cost.varianceRatio),
      threshold,
    });
  }

  // Deduplicate while preserving order
  const seen = new Set();
  const uniqueSignals = [];
  for (const s of signals) {
    if (seen.has(s)) continue;
    seen.add(s);
    uniqueSignals.push(s);
  }

  flags.needsData = needsData;
  flags.hasOverdue = uniqueSignals.includes('OVERDUE');
  flags.hasAtRisk = uniqueSignals.includes('AT_RISK');
  // Critical: stale alone must not imply AT_RISK
  flags.atRiskFromStaleOnly = false;

  return { signals: uniqueSignals, evidence, needsData, flags };
}

module.exports = {
  detectTaskSignals,
  isDoneStatus,
  DONE_STATUSES,
};
