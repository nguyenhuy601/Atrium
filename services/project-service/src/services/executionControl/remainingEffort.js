/**
 * Remaining effort helpers — confirmed is SoT for AT_RISK.
 * Never use estimate − worklog alone as AT_RISK input.
 */

/**
 * @param {{ estimateHours?: number|null, actualWorklogHours?: number|null }} input
 * @returns {number|null} UI hint only
 */
function inferRemainingFromWorklog({ estimateHours, actualWorklogHours } = {}) {
  const est = Number(estimateHours);
  const actual = Number(actualWorklogHours);
  if (!Number.isFinite(est) || est < 0) return null;
  if (!Number.isFinite(actual) || actual < 0) return Math.max(0, est);
  return Math.max(0, est - actual);
}

/**
 * @param {object} task
 * @param {{ now?: Date, freshHours?: number }} [opts]
 */
function isRemainingFresh(task, opts = {}) {
  if (!task || task.remainingSource !== 'confirmed') return false;
  if (!Number.isFinite(Number(task.remainingHours))) return false;
  const updatedAt = task.remainingUpdatedAt ? new Date(task.remainingUpdatedAt) : null;
  if (!updatedAt || Number.isNaN(updatedAt.getTime())) return false;
  const freshHours = Number(opts.freshHours);
  const windowH = Number.isFinite(freshHours) && freshHours > 0 ? freshHours : 48;
  const now = opts.now instanceof Date ? opts.now : new Date();
  return now.getTime() - updatedAt.getTime() <= windowH * 3600 * 1000;
}

/**
 * Build patch for user-confirmed remaining.
 * @param {{ remainingHours: number, userId: string }} input
 */
function buildConfirmedRemainingPatch({ remainingHours, userId, now = new Date() }) {
  const hours = Number(remainingHours);
  if (!Number.isFinite(hours) || hours < 0) {
    const err = new Error('remainingHours must be a non-negative number');
    err.code = 'INVALID_REMAINING';
    throw err;
  }
  return {
    remainingHours: hours,
    remainingSource: 'confirmed',
    remainingUpdatedAt: now,
    remainingConfirmedBy: userId || null,
    lastProgressAt: now,
  };
}

/**
 * Suggested inferred fields (does not set remainingSource=confirmed).
 */
function buildInferredRemainingHint({ estimateHours, actualWorklogHours, now = new Date() }) {
  const inferred = inferRemainingFromWorklog({ estimateHours, actualWorklogHours });
  if (inferred == null) return null;
  return {
    inferredRemainingHours: inferred,
    // Do not overwrite confirmed SoT
  };
}

module.exports = {
  inferRemainingFromWorklog,
  isRemainingFresh,
  buildConfirmedRemainingPatch,
  buildInferredRemainingHint,
};
