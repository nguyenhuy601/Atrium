/**
 * Board / scheduler → Outbox triggers (design: triggers → outbox → worker).
 * Debounce bằng eventId theo bucket thời gian để coalesce spam mutate.
 */

const { isExecutionControlEnabled } = require('./constants');
const { enqueueOutboxEvent } = require('./outbox');

/** Fields board/task mutate làm detection có thể đổi. */
const EC_SCAN_FIELDS = Object.freeze([
  'dueDate',
  'status',
  'remainingHours',
  'remainingSource',
  'remainingUpdatedAt',
  'assigneeId',
  'blockers',
  'estimateHours',
  'sprintId',
  'dependsOn',
]);

function debounceMs() {
  const n = parseInt(process.env.EXECUTION_CONTROL_DEBOUNCE_MS || '30000', 10);
  return Number.isFinite(n) && n >= 1000 ? n : 30000;
}

function scanEventId(taskId, bucket) {
  return `ece_scan_${String(taskId)}_${bucket}`.slice(0, 120);
}

function shouldEnqueueFromPatch(keys = []) {
  const set = new Set((Array.isArray(keys) ? keys : []).map(String));
  return EC_SCAN_FIELDS.some((f) => set.has(f));
}

/**
 * Enqueue scan for one task. Idempotent trong cửa sổ debounce (unique eventId).
 */
async function enqueueTaskScanTrigger({
  organizationId,
  projectId,
  taskId,
  origin = 'board',
  reason = '',
  force = false,
} = {}) {
  if (!isExecutionControlEnabled()) return null;
  if (!organizationId || !projectId || !taskId) return null;
  const bucket = force ? Date.now() : Math.floor(Date.now() / debounceMs());
  return enqueueOutboxEvent({
    organizationId,
    projectId,
    eventType: 'execution.scan_requested',
    origin: String(origin || 'board').slice(0, 64),
    eventId: scanEventId(taskId, bucket),
    payload: {
      taskId: String(taskId),
      reason: String(reason || '').slice(0, 120),
    },
  });
}

/**
 * Fire-and-forget từ board/task mutate — không throw lên caller.
 */
function enqueueTaskScanTriggerBestEffort(args) {
  Promise.resolve()
    .then(() => enqueueTaskScanTrigger(args))
    .catch(() => {
      /* outbox fail không chặn board write */
    });
}

module.exports = {
  EC_SCAN_FIELDS,
  debounceMs,
  shouldEnqueueFromPatch,
  enqueueTaskScanTrigger,
  enqueueTaskScanTriggerBestEffort,
  scanEventId,
};
