/**
 * Baseline snapshot on Task — never fabricate from current actual alone.
 */

/**
 * @param {object} task — lean or doc-like
 * @param {{
 *   source: 'gate2_promote'|'wbs_publish'|'cr_apply'|'manual',
 *   planningBaselineId?: *,
 *   revisionId?: string,
 *   promotedAt?: Date,
 *   startDate?: Date|null,
 *   dueDate?: Date|null,
 *   estimateHours?: number|null,
 *   assigneeId?: *,
 *   sprintId?: *,
 * }} snap
 */
function applyBaselineSnapshot(task, snap = {}) {
  if (!task || typeof task !== 'object') {
    throw new Error('task required');
  }
  const source = snap.source || 'manual';
  const hasPlan =
    snap.dueDate != null ||
    snap.startDate != null ||
    snap.estimateHours != null ||
    snap.assigneeId != null;

  if (!hasPlan && source !== 'cr_apply') {
    return {
      baselineRef: {
        planningBaselineId: snap.planningBaselineId || null,
        revisionId: String(snap.revisionId || ''),
        promotedAt: snap.promotedAt || new Date(),
        source: 'missing',
        missing: true,
      },
      baselineVersion: Number(task.baselineVersion || 0),
      // leave baseline fields untouched
    };
  }

  const nextVersion = Number(task.baselineVersion || 0) + 1;
  return {
    baselineRef: {
      planningBaselineId: snap.planningBaselineId || null,
      revisionId: String(snap.revisionId || ''),
      promotedAt: snap.promotedAt || new Date(),
      source,
      missing: false,
    },
    baseline: {
      startDate: snap.startDate ?? task.startDate ?? null,
      dueDate: snap.dueDate ?? task.dueDate ?? null,
      estimateHours:
        snap.estimateHours != null
          ? Number(snap.estimateHours)
          : task.estimateHours != null
            ? Number(task.estimateHours)
            : null,
      assigneeId: snap.assigneeId ?? task.assigneeId ?? null,
      sprintId: snap.sprintId ?? task.sprintId ?? null,
    },
    baselineVersion: nextVersion,
  };
}

/**
 * Migration: never copy current dueDate as baseline when no trusted source.
 * @returns {{ status: 'snapshotted'|'missing', patch: object }}
 */
function backfillBaselineFromTrustedSource(task, trusted = null) {
  if (!task) return { status: 'missing', patch: { baselineRef: { missing: true, source: 'missing' } } };
  if (task.baselineRef && task.baselineRef.missing === false && task.baseline?.dueDate) {
    return { status: 'snapshotted', patch: {} };
  }
  if (!trusted || typeof trusted !== 'object') {
    return {
      status: 'missing',
      patch: {
        baselineRef: {
          planningBaselineId: null,
          revisionId: '',
          promotedAt: null,
          source: 'missing',
          missing: true,
        },
      },
    };
  }
  return {
    status: 'snapshotted',
    patch: applyBaselineSnapshot(task, {
      source: trusted.source || 'wbs_publish',
      planningBaselineId: trusted.planningBaselineId,
      revisionId: trusted.revisionId,
      startDate: trusted.startDate,
      dueDate: trusted.dueDate,
      estimateHours: trusted.estimateHours,
      assigneeId: trusted.assigneeId,
      sprintId: trusted.sprintId,
      promotedAt: trusted.promotedAt || new Date(),
    }),
  };
}

module.exports = {
  applyBaselineSnapshot,
  backfillBaselineFromTrustedSource,
};
