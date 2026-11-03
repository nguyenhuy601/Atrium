/**
 * Drain one outbox event → scanTask (heuristic propose in-process).
 * Graph LLM path có thể thay analyze_requested sau; MVP ack / re-scan nhẹ.
 */

const Task = require('../../models/Task');
const Sprint = require('../../models/Sprint');
const { isExecutionControlEnabled } = require('./constants');
const { markOutboxProcessed } = require('./outbox');

const DONE_STATUSES = new Set(['done', 'completed', 'closed', 'cancelled', 'canceled']);

function defaultCapacityToDue() {
  const n = Number(process.env.EXECUTION_CONTROL_DEFAULT_CAPACITY_TO_DUE);
  return Number.isFinite(n) && n > 0 ? n : 8;
}

const SCAN_EVENT_TYPES = new Set([
  'execution.scan_requested',
  'task.remaining_confirmed',
  'execution.analyze_requested',
]);

/** Events đã xử lý domain in-process — worker chỉ ack. */
const ACK_ONLY_TYPES = new Set([
  'incident.created',
  'risk.occurred',
  'proposal.approved',
  'proposal.rejected',
  'proposal.applied',
  'proposal.partially_applied',
]);

async function loadTaskContext(taskId) {
  const task = await Task.findById(taskId).lean();
  if (!task || task.isActive === false) return null;
  let sprint = null;
  if (task.sprintId) {
    sprint = await Sprint.findById(task.sprintId).lean();
  }
  return { task, sprint };
}

/**
 * @param {object} evt — ExecutionOutbox lean doc
 * @param {{ scanTask?: Function, markProcessed?: Function, loadContext?: Function }} deps
 */
async function processOutboxEvent(evt, deps = {}) {
  if (!isExecutionControlEnabled()) {
    return { skipped: true, reason: 'flag_off' };
  }
  const eventType = String(evt?.eventType || '');
  const eventId = evt?.eventId;
  const markProcessed =
    typeof deps.markProcessed === 'function' ? deps.markProcessed : markOutboxProcessed;
  const loadContext =
    typeof deps.loadContext === 'function' ? deps.loadContext : loadTaskContext;

  try {
    if (ACK_ONLY_TYPES.has(eventType)) {
      await markProcessed(eventId);
      return { ok: true, acked: true, eventType };
    }

    if (SCAN_EVENT_TYPES.has(eventType)) {
      const taskId = evt?.payload?.taskId;
      if (!taskId) {
        await markProcessed(eventId, { failed: true, error: 'missing_taskId' });
        return { ok: false, error: 'missing_taskId' };
      }
      const ctx = await loadContext(taskId);
      if (!ctx) {
        await markProcessed(eventId);
        return { ok: true, skipped: true, reason: 'task_missing' };
      }
      const scanTask =
        typeof deps.scanTask === 'function'
          ? deps.scanTask
          : require('../executionControl.service').scanTask;
      // Worker chạy detect+propose; không enqueue analyze lại (tránh vòng).
      const result = await scanTask(ctx.task, {
        availableCapacityToDueHours: defaultCapacityToDue(),
        sprint: ctx.sprint,
        origin: evt.origin || 'board',
        actorId: null,
        autoPropose: true,
        enqueueAnalyze: false,
      });
      await markProcessed(eventId);
      return {
        ok: true,
        eventType,
        taskId: String(taskId),
        issueCount: (result?.issues || []).length,
        signals: result?.detected?.signals || [],
      };
    }

    // Unknown type — ack để không kẹt queue; log qua caller
    await markProcessed(eventId);
    return { ok: true, skipped: true, reason: 'unknown_event_type', eventType };
  } catch (err) {
    const msg = err?.message || String(err);
    await markProcessed(eventId, { failed: true, error: msg });
    return { ok: false, error: msg, eventType };
  }
}

function isOpenTaskStatus(status) {
  return !DONE_STATUSES.has(String(status || '').trim().toLowerCase());
}

module.exports = {
  processOutboxEvent,
  SCAN_EVENT_TYPES,
  ACK_ONLY_TYPES,
  defaultCapacityToDue,
  isOpenTaskStatus,
  DONE_STATUSES,
};
