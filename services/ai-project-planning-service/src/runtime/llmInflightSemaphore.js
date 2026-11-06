/**
 * In-process LLM admission control.
 * Limits one process, not the whole cluster. Release in finally, including timeout and throw.
 */

class LlmQueueTimeout extends Error {
  constructor(message) {
    super(message || 'LLM queue timeout');
    this.name = 'LlmQueueTimeout';
    this.code = 'LLM_QUEUE_TIMEOUT';
  }
}

function readLimit(env = process.env) {
  const raw = Number(env.LLM_MAX_INFLIGHT);
  if (!Number.isFinite(raw) || raw < 1) return 2;
  return Math.floor(raw);
}

function readTimeout(env = process.env) {
  const raw = Number(env.LLM_QUEUE_TIMEOUT_MS);
  if (!Number.isFinite(raw) || raw < 1) return 60000;
  return Math.floor(raw);
}

function createLlmSemaphore(opts = {}) {
  const limit = Math.max(1, Number(opts.limit) || 2);
  const timeoutMs = Math.max(1, Number(opts.timeoutMs) || 60000);
  let inflight = 0;
  const waiters = [];

  function settleNext() {
    while (inflight < limit && waiters.length) {
      const waiter = waiters.shift();
      if (waiter.settled) continue;
      waiter.settled = true;
      clearTimeout(waiter.timer);
      inflight += 1;
      waiter.resolve(releaseFor(waiter));
    }
  }

  function releaseFor(waiter) {
    let released = false;
    return function release() {
      if (released) return;
      released = true;
      inflight = Math.max(0, inflight - 1);
      settleNext();
    };
  }

  function acquire() {
    if (inflight < limit && waiters.length === 0) {
      inflight += 1;
      const holder = { settled: true };
      return Promise.resolve(releaseFor(holder));
    }
    return new Promise((resolve, reject) => {
      const waiter = { resolve, reject, settled: false, timer: null };
      waiter.timer = setTimeout(() => {
        if (waiter.settled) return;
        waiter.settled = true;
        const index = waiters.indexOf(waiter);
        if (index >= 0) waiters.splice(index, 1);
        reject(new LlmQueueTimeout());
      }, timeoutMs);
      waiters.push(waiter);
      settleNext();
    });
  }

  return {
    acquire,
    get inflight() {
      return inflight;
    },
    get waiting() {
      return waiters.length;
    },
  };
}

const byProvider = new Map();

function semaphoreFor(provider, env = process.env) {
  const key = String(provider || 'default');
  if (!byProvider.has(key)) {
    byProvider.set(
      key,
      createLlmSemaphore({ limit: readLimit(env), timeoutMs: readTimeout(env) })
    );
  }
  return byProvider.get(key);
}

/**
 * @param {{ provider?: string, env?: NodeJS.ProcessEnv, semaphore?: object }} opts
 * @returns {Promise<Function>} release
 */
async function acquireLlmSlot(opts = {}) {
  const gate = opts.semaphore || semaphoreFor(opts.provider, opts.env);
  return gate.acquire();
}

function resetLlmSemaphores() {
  byProvider.clear();
}

module.exports = {
  LlmQueueTimeout,
  createLlmSemaphore,
  acquireLlmSlot,
  resetLlmSemaphores,
  readLimit,
  readTimeout,
};
