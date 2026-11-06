/**
 * AgentResult — derived run metadata. Not a Gate artifact.
 * COMPLETED is not ToolExecution success.
 */

const crypto = require('crypto');

const AGENT_STATUSES = Object.freeze([
  'COMPLETED',
  'NEEDS_REVIEW',
  'BLOCKED',
  'FAILED',
]);

const DISPOSITIONS = Object.freeze(['RUN', 'SKIPPED']);

function hashValue(value) {
  const json = JSON.stringify(value ?? null);
  return crypto.createHash('sha256').update(json).digest('hex').slice(0, 16);
}

function issue(code, message, severity = 'error') {
  return {
    code: String(code || 'UNSPECIFIED'),
    severity,
    message: String(message || code || ''),
  };
}

function hasValidEvidence(execution, policy) {
  if (!policy?.requireEvidence) return true;
  const refs = execution?.evidenceRefs || execution?.evidence || [];
  return Array.isArray(refs) && refs.length > 0;
}

/**
 * Map a tool execution row to AgentResult.
 * Do not treat status succeeded as COMPLETED.
 * @param {object} execution
 * @param {object} [policy]
 */
function mapExecutionToAgentResult(execution = {}, policy = {}) {
  const toolName = String(execution.toolName || '').trim();
  const requireEvidence = policy.requireEvidence !== false;
  const activePolicy = { ...policy, requireEvidence };
  const evidenceRefs = Array.isArray(execution.evidenceRefs)
    ? execution.evidenceRefs.map(String)
    : [];
  const attempt = Math.max(1, Number(execution.attempt) || 1);
  const maxRetries = Math.max(1, Number(policy.maxRetries) || 3);

  const base = {
    id: String(execution.id || `${execution.phase || 'run'}:${toolName}`),
    toolName,
    inputHash: execution.inputHash != null ? String(execution.inputHash) : '',
    outputRef: execution.outputRef != null ? String(execution.outputRef) : undefined,
    outputHash: execution.outputHash != null ? String(execution.outputHash) : undefined,
    evidenceRefs,
    promptVersion: execution.promptVersion != null ? String(execution.promptVersion) : undefined,
    model: execution.model != null ? String(execution.model) : undefined,
    disposition: execution.disposition === 'SKIPPED' ? 'SKIPPED' : 'RUN',
    validation: {
      outputValidated: Boolean(execution.outputValidated),
      evidenceValidated: hasValidEvidence(execution, activePolicy),
      issues: [],
    },
    execution: {
      attempt,
      startedAt: execution.startedAt || null,
      completedAt: execution.completedAt || null,
      durationMs: Number(execution.durationMs) || 0,
      toolCalls: Array.isArray(execution.toolCalls) ? execution.toolCalls : [],
      tokenUsage: execution.tokenUsage || null,
      queueWaitMs: Number(execution.queueWaitMs) || 0,
    },
  };

  if (base.disposition === 'SKIPPED') {
    return {
      ...base,
      status: 'BLOCKED',
      validation: {
        ...base.validation,
        issues: [issue(execution.reason || 'SKIPPED', 'Node không nằm trong lần chạy này', 'info')],
      },
    };
  }

  if (execution.inputAvailable === false || execution.errorCode === 'INPUT_MISSING') {
    return blocked(base, 'INPUT_MISSING', 'Thiếu input bắt buộc');
  }
  if (requireEvidence && !hasValidEvidence(execution, activePolicy)) {
    return blocked(base, 'EVIDENCE_MISSING', 'Thiếu evidence theo policy');
  }
  const failed =
    execution.status === 'failed' ||
    execution.status === 'FAILED' ||
    Boolean(execution.errorCode && execution.errorCode !== 'INPUT_MISSING');
  if (failed) {
    const code = String(execution.errorCode || 'TOOL_FAILED');
    return {
      ...base,
      status: 'FAILED',
      validation: {
        ...base.validation,
        issues: [issue(code, execution.errorMessage || code)],
      },
    };
  }
  if (attempt > maxRetries && execution.status !== 'succeeded') {
    return {
      ...base,
      status: 'FAILED',
      validation: {
        ...base.validation,
        issues: [issue('RETRY_EXHAUSTED', 'Hết retry')],
      },
    };
  }
  if (!execution.outputValidated) {
    return {
      ...base,
      status: 'NEEDS_REVIEW',
      validation: {
        ...base.validation,
        issues: [issue('OUTPUT_NOT_VALIDATED', 'Output chưa được validate', 'warning')],
      },
    };
  }
  return {
    ...base,
    status: 'COMPLETED',
  };
}

function blocked(base, code, message) {
  return {
    ...base,
    status: 'BLOCKED',
    validation: {
      ...base.validation,
      evidenceValidated: code !== 'EVIDENCE_MISSING' && base.validation.evidenceValidated,
      issues: [issue(code, message)],
    },
  };
}

/**
 * Reuse only when hash, prompt version, and model all match a COMPLETED row.
 */
function canReuseResult(existing, request = {}) {
  if (!existing || existing.status !== 'COMPLETED') return false;
  if (existing.disposition === 'SKIPPED') return false;
  if (!existing.inputHash || existing.inputHash !== request.inputHash) return false;
  if (String(existing.promptVersion || '') !== String(request.promptVersion || '')) return false;
  if (String(existing.model || '') !== String(request.model || '')) return false;
  return true;
}

function isNoProgress(previous, next) {
  if (!previous || !next) return false;
  return (
    previous.inputHash &&
    previous.inputHash === next.inputHash &&
    previous.outputHash &&
    previous.outputHash === next.outputHash
  );
}

function shouldRetry(result, policy = {}) {
  if (!result || result.disposition === 'SKIPPED') return false;
  if (result.status === 'COMPLETED' && !policy.inputHashChanged) return false;
  if (result.status === 'FAILED') return true;
  if (result.status === 'NEEDS_REVIEW') return Boolean(policy.retryNeedsReview);
  if (result.status === 'BLOCKED') return Boolean(policy.inputTemporarilyMissing);
  return false;
}

module.exports = {
  AGENT_STATUSES,
  DISPOSITIONS,
  hashValue,
  mapExecutionToAgentResult,
  canReuseResult,
  isNoProgress,
  shouldRetry,
};
