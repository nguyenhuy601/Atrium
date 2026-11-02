/**
 * Apply + RECONCILING — never retry apply on unknown without lookup (RULE-EC-11).
 */

const { applyLockKey } = require('./proposalContract');
const { createErrorRecord } = require('./errorRecord');

/**
 * In-memory / store-backed action outcome registry.
 * Production uses Mongo ExecutionApplyAction; this module stays pure over a Map-like store.
 */

/**
 * @param {{ get: Function, set: Function }} store
 * @param {string} lockKey
 * @param {'applied'|'not_applied'|'unknown'} status
 * @param {object} [meta]
 */
async function recordActionOutcome(store, lockKey, status, meta = {}) {
  await store.set(lockKey, {
    status,
    ...meta,
    updatedAt: new Date().toISOString(),
  });
}

async function lookupActionOutcome(store, lockKey) {
  const row = await store.get(lockKey);
  if (!row) return { status: 'not_applied' };
  return row;
}

/**
 * Safe apply one action with reconcile semantics.
 * @param {object} opts
 * @param {Function} opts.execute — async () => result; may throw with code APPLY_TIMEOUT
 * @param {{ get: Function, set: Function }} opts.store
 */
async function applyActionWithReconcile({
  proposalId,
  proposalRevision,
  action,
  execute,
  store,
  correlationId = '',
}) {
  const lockKey = applyLockKey(proposalId, proposalRevision, action.actionId);
  const existing = await lookupActionOutcome(store, lockKey);
  if (existing.status === 'applied') {
    return {
      status: 'applied',
      idempotent: true,
      actionId: action.actionId,
      result: existing.result || null,
    };
  }

  try {
    const result = await execute(action);
    await recordActionOutcome(store, lockKey, 'applied', { result });
    return { status: 'applied', idempotent: false, actionId: action.actionId, result };
  } catch (err) {
    const code = String(err?.code || '');
    if (code === 'APPLY_TIMEOUT' || code === 'APPLY_UNKNOWN' || /timeout/i.test(String(err?.message || ''))) {
      await recordActionOutcome(store, lockKey, 'unknown', {
        error: String(err.message || err).slice(0, 500),
      });
      return {
        status: 'reconciling',
        actionId: action.actionId,
        errorRecord: createErrorRecord({
          errorCode: 'APPLY_UNKNOWN',
          category: 'apply_unknown',
          retryable: false,
          failedStep: 'apply',
          affectedActionIds: [action.actionId],
          recoveryStatus: 'reconciling',
          correlationId,
          detailSafe: String(err.message || err).slice(0, 500),
        }),
      };
    }
    await recordActionOutcome(store, lockKey, 'not_applied', {
      error: String(err.message || err).slice(0, 500),
    });
    throw err;
  }
}

/**
 * After RECONCILING — lookup then maybe safe retry once.
 */
async function reconcileAction({
  proposalId,
  proposalRevision,
  action,
  execute,
  store,
  verifyRemote = null,
  correlationId = '',
}) {
  const lockKey = applyLockKey(proposalId, proposalRevision, action.actionId);
  let row = await lookupActionOutcome(store, lockKey);

  if (verifyRemote) {
    const remote = await verifyRemote(action);
    if (remote?.applied) {
      await recordActionOutcome(store, lockKey, 'applied', { result: remote.result });
      return { status: 'applied', actionId: action.actionId, via: 'remote_verify' };
    }
    if (remote?.notApplied) {
      row = { status: 'not_applied' };
      await recordActionOutcome(store, lockKey, 'not_applied');
    }
  }

  if (row.status === 'applied') {
    return { status: 'applied', actionId: action.actionId, via: 'store' };
  }
  if (row.status === 'not_applied') {
    return applyActionWithReconcile({
      proposalId,
      proposalRevision,
      action,
      execute,
      store,
      correlationId,
    });
  }
  // still unknown
  return {
    status: 'needs_review',
    actionId: action.actionId,
    errorRecord: createErrorRecord({
      errorCode: 'APPLY_STILL_UNKNOWN',
      category: 'apply_unknown',
      retryable: false,
      failedStep: 'apply',
      affectedActionIds: [action.actionId],
      recoveryStatus: 'needs_review',
      correlationId,
      detailSafe: 'Reconcile could not determine apply outcome',
    }),
  };
}

/**
 * Apply many actions; stop dependents of failed steps.
 * @param {Array<{ actionId: string, dependsOnActionIds?: string[] }>} actions
 */
async function applyActionBatch({
  proposalId,
  proposalRevision,
  actions,
  execute,
  store,
  correlationId = '',
}) {
  const results = [];
  const failed = new Set();
  const applied = new Set();

  for (const action of actions || []) {
    const deps = Array.isArray(action.dependsOnActionIds) ? action.dependsOnActionIds : [];
    if (deps.some((d) => failed.has(d))) {
      results.push({
        status: 'skipped_dependency',
        actionId: action.actionId,
      });
      failed.add(action.actionId);
      continue;
    }
    const r = await applyActionWithReconcile({
      proposalId,
      proposalRevision,
      action,
      execute,
      store,
      correlationId,
    });
    results.push(r);
    if (r.status === 'applied') applied.add(action.actionId);
    else {
      failed.add(action.actionId);
      if (r.status === 'reconciling') {
        return {
          status: 'reconciling',
          results,
          appliedActionIds: [...applied],
          failedActionIds: [...failed],
        };
      }
    }
  }

  if (failed.size && applied.size) {
    return {
      status: 'partially_applied',
      results,
      appliedActionIds: [...applied],
      failedActionIds: [...failed],
    };
  }
  if (failed.size) {
    return {
      status: 'apply_failed',
      results,
      appliedActionIds: [...applied],
      failedActionIds: [...failed],
    };
  }
  return {
    status: 'applied',
    results,
    appliedActionIds: [...applied],
    failedActionIds: [],
  };
}

function createMemoryApplyStore() {
  const map = new Map();
  return {
    async get(key) {
      return map.get(key) || null;
    },
    async set(key, value) {
      map.set(key, value);
    },
    _map: map,
  };
}

module.exports = {
  recordActionOutcome,
  lookupActionOutcome,
  applyActionWithReconcile,
  reconcileAction,
  applyActionBatch,
  createMemoryApplyStore,
  applyLockKey,
};
