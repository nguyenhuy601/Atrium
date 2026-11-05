/**
 * ErrorRecord contract — every exception gets a structured record (RULE-EC-10).
 * No generic "fallback": recoveryStatus drives the handling flow.
 */

const { ERROR_CATEGORIES, RECOVERY_STATUSES } = require('./constants');

/**
 * @param {object} partial
 */
function createErrorRecord(partial = {}) {
  const category = String(partial.category || 'transient_infra');
  if (!ERROR_CATEGORIES.includes(category)) {
    // still allow but mark
  }
  const recoveryStatus = String(partial.recoveryStatus || 'needs_review');
  return {
    errorCode: String(partial.errorCode || 'UNKNOWN'),
    category,
    retryable: Boolean(partial.retryable),
    failedStep: String(partial.failedStep || ''),
    affectedActionIds: Array.isArray(partial.affectedActionIds)
      ? partial.affectedActionIds.map(String)
      : [],
    attemptCount: Number(partial.attemptCount) || 0,
    nextRetryAt: partial.nextRetryAt || null,
    recoveryStatus: RECOVERY_STATUSES.includes(recoveryStatus)
      ? recoveryStatus
      : 'needs_review',
    correlationId: String(partial.correlationId || ''),
    detailSafe: String(partial.detailSafe || '').slice(0, 2000),
    createdAt: partial.createdAt || new Date(),
  };
}

/**
 * Classify exception into handling branch (Wave 3).
 * @returns {{ record: object, next: string }}
 */
function classifyException(err, ctx = {}) {
  const msg = String(err?.message || err || '');
  const code = String(err?.code || err?.errorCode || '');
  const step = String(ctx.failedStep || '');

  if (code === 'APPLY_TIMEOUT' || code === 'APPLY_UNKNOWN' || /timeout/i.test(msg)) {
    if (step === 'apply' || ctx.applyPhase) {
      return {
        record: createErrorRecord({
          errorCode: 'APPLY_UNKNOWN',
          category: 'apply_unknown',
          retryable: false,
          failedStep: 'apply',
          affectedActionIds: ctx.affectedActionIds || [],
          attemptCount: ctx.attemptCount || 0,
          recoveryStatus: 'reconciling',
          correlationId: ctx.correlationId,
          detailSafe: msg.slice(0, 500),
        }),
        next: 'RECONCILING',
      };
    }
    return {
      record: createErrorRecord({
        errorCode: 'TRANSIENT_TIMEOUT',
        category: 'transient_infra',
        retryable: true,
        failedStep: step,
        attemptCount: ctx.attemptCount || 0,
        nextRetryAt: new Date(Date.now() + (ctx.backoffMs || 2000)),
        recoveryStatus: 'retry_scheduled',
        correlationId: ctx.correlationId,
        detailSafe: msg.slice(0, 500),
      }),
      next: 'RETRY',
    };
  }

  if (code === 'RATE_LIMIT' || /rate.?limit/i.test(msg)) {
    return {
      record: createErrorRecord({
        errorCode: 'RATE_LIMIT',
        category: 'transient_infra',
        retryable: true,
        failedStep: step,
        attemptCount: ctx.attemptCount || 0,
        nextRetryAt: new Date(Date.now() + (ctx.retryAfterMs || 5000)),
        recoveryStatus: 'retry_scheduled',
        correlationId: ctx.correlationId,
        detailSafe: msg.slice(0, 500),
      }),
      next: 'RETRY',
    };
  }

  if (code === 'LLM_INVALID' || code === 'PROPOSAL_INVALID' || /invalid json|schema/i.test(msg)) {
    const attempts = Number(ctx.attemptCount) || 0;
    const max = Number(ctx.maxFixAttempts) || 3;
    if (attempts < max) {
      return {
        record: createErrorRecord({
          errorCode: 'LLM_INVALID',
          category: 'llm_invalid',
          retryable: true,
          failedStep: step || 'propose',
          attemptCount: attempts,
          recoveryStatus: 'retry_scheduled',
          correlationId: ctx.correlationId,
          detailSafe: msg.slice(0, 500),
        }),
        next: 'FIX_PROPOSAL',
      };
    }
    return {
      record: createErrorRecord({
        errorCode: 'LLM_INVALID_EXHAUSTED',
        category: 'llm_invalid',
        retryable: false,
        failedStep: step || 'propose',
        attemptCount: attempts,
        recoveryStatus: 'needs_review',
        correlationId: ctx.correlationId,
        detailSafe: msg.slice(0, 500),
      }),
      next: 'NEEDS_REVIEW',
    };
  }

  if (code === 'NEEDS_DATA' || code === 'MISSING_BUSINESS_DATA') {
    return {
      record: createErrorRecord({
        errorCode: 'MISSING_BUSINESS_DATA',
        category: 'business_data',
        retryable: false,
        failedStep: step,
        recoveryStatus: 'needs_input',
        correlationId: ctx.correlationId,
        detailSafe: msg.slice(0, 500),
      }),
      next: 'NEEDS_INPUT',
    };
  }

  if (code === 'UNSUPPORTED_DEPENDENCY' || code === 'PARTIAL_IMPACT') {
    return {
      record: createErrorRecord({
        errorCode: code || 'UNSUPPORTED_DEPENDENCY',
        category: 'capability_gap',
        retryable: false,
        failedStep: step || 'impact',
        recoveryStatus: 'capability_limited',
        correlationId: ctx.correlationId,
        detailSafe: msg.slice(0, 500),
      }),
      next: 'CAPABILITY_LIMITED',
    };
  }

  if (code === 'VERSION_MISMATCH' || code === 'DATA_CHANGED') {
    return {
      record: createErrorRecord({
        errorCode: 'DATA_CHANGED',
        category: 'concurrency',
        retryable: false,
        failedStep: step,
        recoveryStatus: 'invalidated_reanalyze',
        correlationId: ctx.correlationId,
        detailSafe: msg.slice(0, 500),
      }),
      next: 'INVALIDATE_REANALYZE',
    };
  }

  if (code === 'APPLY_PARTIAL') {
    return {
      record: createErrorRecord({
        errorCode: 'APPLY_PARTIAL',
        category: 'apply_partial',
        retryable: false,
        failedStep: 'apply',
        affectedActionIds: ctx.affectedActionIds || [],
        recoveryStatus: 'partial_recovery_pending',
        correlationId: ctx.correlationId,
        detailSafe: msg.slice(0, 500),
      }),
      next: 'PARTIAL_RECOVERY',
    };
  }

  if (code === 'FORBIDDEN' || code === 'AUTHZ' || /permission|forbidden|authz/i.test(msg)) {
    return {
      record: createErrorRecord({
        errorCode: 'AUTHZ_DENIED',
        category: 'authz_config',
        retryable: false,
        failedStep: step,
        recoveryStatus: 'stopped_authz',
        correlationId: ctx.correlationId,
        detailSafe: msg.slice(0, 500),
      }),
      next: 'STOPPED_AUTHZ',
    };
  }

  return {
    record: createErrorRecord({
      errorCode: code || 'UNCLASSIFIED',
      category: 'transient_infra',
      retryable: Boolean(ctx.retryable),
      failedStep: step,
      attemptCount: ctx.attemptCount || 0,
      recoveryStatus: ctx.retryable ? 'retry_scheduled' : 'needs_review',
      correlationId: ctx.correlationId,
      detailSafe: msg.slice(0, 500),
    }),
    next: ctx.retryable ? 'RETRY' : 'NEEDS_REVIEW',
  };
}

module.exports = {
  createErrorRecord,
  classifyException,
};
