/**
 * Execution Control worker: drain Outbox + scheduler quét overdue.
 * Chạy cùng process project-worker (TASK_FROM_FILE + EC).
 */

const { logger } = require('@enterprise/shared');
const Task = require('../models/Task');
const {
  isExecutionControlEnabled,
  claimPendingEvents,
  enqueueTaskScanTrigger,
  processOutboxEvent,
  isOpenTaskStatus,
  DONE_STATUSES,
} = require('../services/executionControl');

let stopped = false;
let drainTimer = null;
let schedulerTimer = null;

function pollMs() {
  const n = parseInt(process.env.EXECUTION_CONTROL_POLL_MS || '2000', 10);
  return Number.isFinite(n) && n >= 500 ? n : 2000;
}

function schedulerMs() {
  const n = parseInt(process.env.EXECUTION_CONTROL_SCHEDULER_MS || '300000', 10);
  return Number.isFinite(n) && n >= 10000 ? n : 300000;
}

function schedulerBatch() {
  const n = parseInt(process.env.EXECUTION_CONTROL_SCHEDULER_BATCH || '50', 10);
  return Number.isFinite(n) && n > 0 ? Math.min(200, n) : 50;
}

function claimLimit() {
  const n = parseInt(process.env.EXECUTION_CONTROL_CLAIM_LIMIT || '20', 10);
  return Number.isFinite(n) && n > 0 ? Math.min(100, n) : 20;
}

async function drainOnce() {
  if (!isExecutionControlEnabled()) return { claimed: 0 };
  const rows = await claimPendingEvents({ limit: claimLimit() });
  let ok = 0;
  let fail = 0;
  for (const evt of rows) {
    const result = await processOutboxEvent(evt);
    if (result?.ok) ok += 1;
    else fail += 1;
    if (!result?.ok && result?.error) {
      logger.warn(
        `[executionControlWorker] event ${evt.eventId} failed: ${result.error}`
      );
    }
  }
  return { claimed: rows.length, ok, fail };
}

/**
 * Scheduler: task quá dueDate + chưa done → enqueue scan (origin scheduler).
 */
async function enqueueOverdueScans() {
  if (!isExecutionControlEnabled()) return { enqueued: 0 };
  const now = new Date();
  const doneList = [...DONE_STATUSES];
  const tasks = await Task.find({
    isActive: true,
    dueDate: { $lte: now },
    status: { $nin: doneList },
  })
    .select('_id organizationId projectId status dueDate')
    .sort({ dueDate: 1 })
    .limit(schedulerBatch())
    .lean();

  let enqueued = 0;
  for (const t of tasks) {
    if (!isOpenTaskStatus(t.status)) continue;
    if (!t.organizationId || !t.projectId) continue;
    const doc = await enqueueTaskScanTrigger({
      organizationId: t.organizationId,
      projectId: t.projectId,
      taskId: t._id,
      origin: 'scheduler',
      reason: 'overdue_dueDate',
    });
    if (doc) enqueued += 1;
  }
  return { enqueued, scannedCandidates: tasks.length };
}

function scheduleDrain() {
  if (stopped) return;
  drainTimer = setTimeout(async () => {
    try {
      const r = await drainOnce();
      if (r.claimed > 0) {
        logger.info(
          `[executionControlWorker] drain claimed=${r.claimed} ok=${r.ok} fail=${r.fail}`
        );
      }
    } catch (err) {
      logger.error(`[executionControlWorker] drain error: ${err.message}`);
    } finally {
      scheduleDrain();
    }
  }, pollMs());
}

function scheduleScheduler() {
  if (stopped) return;
  schedulerTimer = setTimeout(async () => {
    try {
      const r = await enqueueOverdueScans();
      if (r.enqueued > 0) {
        logger.info(
          `[executionControlWorker] scheduler enqueued=${r.enqueued} candidates=${r.scannedCandidates}`
        );
      }
    } catch (err) {
      logger.error(`[executionControlWorker] scheduler error: ${err.message}`);
    } finally {
      scheduleScheduler();
    }
  }, schedulerMs());
}

function isWorkerEnabled() {
  if (!isExecutionControlEnabled()) return false;
  const v = String(process.env.EXECUTION_CONTROL_WORKER ?? '1').trim().toLowerCase();
  return v !== '0' && v !== 'false' && v !== 'off';
}

function runExecutionControlWorkerLoop() {
  stopped = false;
  if (!isWorkerEnabled()) {
    logger.info('[executionControlWorker] disabled (EXECUTION_CONTROL / WORKER flag)');
    return;
  }
  logger.info(
    `[executionControlWorker] started poll=${pollMs()}ms scheduler=${schedulerMs()}ms`
  );
  // Tick đầu ngay (không đợi full interval)
  void drainOnce().catch((err) =>
    logger.error(`[executionControlWorker] initial drain: ${err.message}`)
  );
  void enqueueOverdueScans().catch((err) =>
    logger.error(`[executionControlWorker] initial scheduler: ${err.message}`)
  );
  scheduleDrain();
  scheduleScheduler();
}

async function stopExecutionControlWorker() {
  stopped = true;
  if (drainTimer) clearTimeout(drainTimer);
  if (schedulerTimer) clearTimeout(schedulerTimer);
  drainTimer = null;
  schedulerTimer = null;
}

module.exports = {
  runExecutionControlWorkerLoop,
  stopExecutionControlWorker,
  drainOnce,
  enqueueOverdueScans,
  isWorkerEnabled,
};
