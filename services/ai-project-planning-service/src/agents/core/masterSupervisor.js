/**
 * Master Supervisor — route a resolved phase. No domain tools.
 */

const { masterTools, BUSINESS_TOOL_NAMES } = require('./domainRegistry');

const DOMAIN_BY_PHASE = Object.freeze({
  what: 'what',
  how: 'how',
  delivery: 'delivery',
});

function routeDomain(phase) {
  const key = String(phase || '').trim().toLowerCase();
  return DOMAIN_BY_PHASE[key] || 'what';
}

function masterPlan(phase) {
  return {
    domain: routeDomain(phase),
    tools: masterTools(),
  };
}

function masterHasBusinessTool(tools) {
  const names = Array.isArray(tools) ? tools : [];
  return names.some((name) => BUSINESS_TOOL_NAMES.includes(name));
}

/**
 * Deterministic check before approvalRequired.
 * NEEDS_REVIEW never opens the gate. Missing evidence never opens the gate.
 * @param {object[]} agentResults
 */
function verifyDomainResult(agentResults = []) {
  const results = Array.isArray(agentResults) ? agentResults : [];
  const needsReview = results.some((row) => row && row.status === 'NEEDS_REVIEW');
  const missingEvidence = results.some((row) => {
    if (!row || row.disposition === 'SKIPPED') return false;
    if (row.status === 'BLOCKED') return true;
    if (row.status === 'FAILED') return true;
    if (row.status === 'COMPLETED') {
      const refs = row.evidenceRefs || [];
      return !Array.isArray(refs) || refs.length === 0;
    }
    return false;
  });
  const runnable = results.filter((row) => row && row.disposition !== 'SKIPPED');
  const allCompleted =
    runnable.length > 0 && runnable.every((row) => row.status === 'COMPLETED');
  const approvalRequired = allCompleted && !needsReview && !missingEvidence;
  return {
    approvalRequired,
    needsReview,
    missingEvidence,
    executionStatus: approvalRequired ? 'READY_FOR_HUMAN_GATE' : 'NOT_READY',
  };
}

module.exports = {
  routeDomain,
  masterPlan,
  masterHasBusinessTool,
  verifyDomainResult,
};
