/**
 * Per-specialist execution policy. Planning service stops at L2.
 */

const LEVELS = Object.freeze({
  L0: 'L0',
  L1: 'L1',
  L2: 'L2',
  L3: 'L3',
});

function defaultPolicy(overrides = {}) {
  return {
    maxIterations: 4,
    maxToolCalls: 8,
    maxRuntimeMs: 120000,
    maxRetries: 3,
    allowedTools: [],
    requireEvidence: true,
    requireValidation: true,
    level: LEVELS.L1,
    retryNeedsReview: false,
    ...overrides,
  };
}

function assertLevelAllowed(level) {
  const value = String(level || LEVELS.L1);
  if (value === LEVELS.L3) {
    const err = new Error('L3 không thuộc planning service');
    err.code = 'L3_FORBIDDEN';
    throw err;
  }
  return value;
}

/**
 * @param {string} code
 * @returns {'RETRY'|'REPAIR_JSON'|'BLOCKED'|'FAILED'|'NEEDS_REVIEW'|'STOP_NO_PROGRESS'}
 */
function classifyFailure(code) {
  const key = String(code || '');
  if (key === 'LLM_TIMEOUT' || key === 'ollama_timeout') return 'RETRY';
  if (key === 'INVALID_JSON' || key === 'ollama_json_parse') return 'REPAIR_JSON';
  if (key === 'EVIDENCE_MISSING' || key === 'INPUT_MISSING' || key === 'CONTEXT_MISSING') {
    return 'BLOCKED';
  }
  if (key === 'OUTPUT_NOT_VALIDATED') return 'NEEDS_REVIEW';
  if (key === 'NO_PROGRESS') return 'STOP_NO_PROGRESS';
  if (key === 'TOOL_FAILED') return 'RETRY';
  return 'FAILED';
}

module.exports = {
  LEVELS,
  defaultPolicy,
  assertLevelAllowed,
  classifyFailure,
};
