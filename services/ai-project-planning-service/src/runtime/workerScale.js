/**
 * In-process worker pool.
 * Worker count follows the queue, capped at 3. Each worker holds at most 2 tasks.
 */

const WORKER_CAP = 3;
const TASKS_CAP = 2;

function resolveWorkerScale(env = process.env) {
  const maxRaw = Number(env.LLM_WORKER_MAX);
  const taskRaw = Number(env.LLM_WORKER_TASKS);
  const maxWorkers =
    Number.isFinite(maxRaw) && maxRaw >= 1 ? Math.min(WORKER_CAP, Math.round(maxRaw)) : WORKER_CAP;
  const tasksPerWorker =
    Number.isFinite(taskRaw) && taskRaw >= 1 ? Math.min(TASKS_CAP, Math.round(taskRaw)) : TASKS_CAP;
  return { maxWorkers, tasksPerWorker };
}

function planWorkerCount(pendingCount, scale = resolveWorkerScale()) {
  const pending = Math.max(0, Math.floor(Number(pendingCount) || 0));
  if (pending <= 0) return 0;
  return Math.min(scale.maxWorkers, Math.ceil(pending / scale.tasksPerWorker));
}

/**
 * Rabbit keeps one listener when the queue is empty.
 * A worker already holding its task cap does not count as free capacity.
 */
function planListenerCount(readyCount, consumers = [], scale = resolveWorkerScale()) {
  const saturated = consumers.filter((worker) => worker.inflight >= scale.tasksPerWorker).length;
  const needed = saturated + planWorkerCount(readyCount, scale);
  return Math.min(scale.maxWorkers, Math.max(1, needed));
}

/**
 * Drain items with a scaled pool. Each worker runs at most `tasksPerWorker` tasks at once.
 * @param {unknown[]} items
 * @param {(item: unknown) => Promise<void>} fn
 * @param {NodeJS.ProcessEnv} [env]
 */
async function runScaledPool(items, fn, env = process.env) {
  const queue = Array.isArray(items) ? [...items] : [];
  const scale = resolveWorkerScale(env);
  const workers = planWorkerCount(queue.length, scale);
  if (!workers) return { workers: 0 };

  async function takeOne() {
    while (queue.length) {
      const item = queue.shift();
      if (item !== undefined) await fn(item);
    }
  }

  await Promise.all(
    Array.from({ length: workers }, () =>
      Promise.all(Array.from({ length: scale.tasksPerWorker }, () => takeOne()))
    )
  );
  return { workers };
}

module.exports = {
  WORKER_CAP,
  TASKS_CAP,
  resolveWorkerScale,
  planWorkerCount,
  planListenerCount,
  runScaledPool,
};
