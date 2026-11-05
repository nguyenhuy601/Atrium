/**
 * Proposal contract + validation (plan §3.8).
 * Zero proposals + NEEDS_* is a valid analyze outcome.
 */

const { PROPOSAL_STATUSES } = require('./constants');

function newActionId(prefix = 'act') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * @returns {object} normalized proposal or throws
 */
function buildProposal(input = {}) {
  const actions = Array.isArray(input.actions) ? input.actions : [];
  const normalizedActions = actions.map((a, i) => ({
    actionId: String(a.actionId || newActionId(`a${i}`)),
    entityType: String(a.entityType || 'task'),
    entityId: String(a.entityId || ''),
    op: String(a.op || 'patch'),
    payload: a.payload && typeof a.payload === 'object' ? a.payload : {},
    requiresFullImpact: Boolean(a.requiresFullImpact || a.dependsOnImpact),
    dependsOnImpact: Boolean(a.dependsOnImpact || a.requiresFullImpact),
  }));

  const evidenceRefs = Array.isArray(input.evidenceRefs)
    ? input.evidenceRefs.map((ref, i) => {
        if (ref && typeof ref === 'object') {
          return {
            ...ref,
            id: String(ref.id || `ev:${i}`),
            type: String(ref.type || 'UNKNOWN'),
          };
        }
        return { id: String(ref), type: 'REF' };
      })
    : [];

  return {
    proposalRevision: Number(input.proposalRevision) || 1,
    status: PROPOSAL_STATUSES.includes(input.status) ? input.status : 'draft',
    actions: normalizedActions,
    evidenceRefs,
    situation:
      input.situation && typeof input.situation === 'object' ? input.situation : null,
    assumptions: Array.isArray(input.assumptions) ? input.assumptions : [],
    preconditions: Array.isArray(input.preconditions) ? input.preconditions : [],
    simulationRef: input.simulationRef || null,
    expectedVersions: input.expectedVersions && typeof input.expectedVersions === 'object'
      ? input.expectedVersions
      : {},
    approvalRequirements: Array.isArray(input.approvalRequirements)
      ? input.approvalRequirements
      : [],
    followUpCriteria: Array.isArray(input.followUpCriteria) ? input.followUpCriteria : [],
    summary: String(input.summary || '').slice(0, 2000),
    goalImpact: input.goalImpact || { goalImpactStatus: 'UNKNOWN', affectsSprintGoal: false },
    interventionLevel: input.interventionLevel || 'propose',
  };
}

/**
 * Validate proposal shape before pending_approval.
 * @returns {{ ok: boolean, errors: string[] }}
 */
function validateProposal(proposal) {
  const errors = [];
  if (!proposal || typeof proposal !== 'object') {
    return { ok: false, errors: ['proposal_required'] };
  }
  if (!Array.isArray(proposal.actions)) errors.push('actions_required');
  for (const a of proposal.actions || []) {
    if (!a.actionId) errors.push('actionId_missing');
    if (!a.entityId) errors.push('entityId_missing');
    if (!a.op) errors.push('op_missing');
  }
  if (!proposal.simulationRef && (proposal.actions || []).some((a) => /schedule|deadline|hours/i.test(JSON.stringify(a.payload || {})))) {
    errors.push('simulationRef_required_for_numeric_schedule_claims');
  }
  // Numeric claims must not appear in summary without simulationRef
  if (/tiết kiệm\s+\d+|save\s+\d+\s*day/i.test(String(proposal.summary || '')) && !proposal.simulationRef) {
    errors.push('numeric_claim_without_simulation');
  }
  return { ok: errors.length === 0, errors };
}

/**
 * Compare expectedVersions vs current — any mismatch invalidates.
 */
function checkExpectedVersions(expected = {}, current = {}) {
  const mismatched = [];
  for (const [k, v] of Object.entries(expected || {})) {
    if (current[k] == null) continue;
    if (String(current[k]) !== String(v)) {
      mismatched.push({ key: k, expected: v, current: current[k] });
    }
  }
  return { ok: mismatched.length === 0, mismatched };
}

/**
 * Idempotency key for apply lock.
 */
function applyLockKey(proposalId, proposalRevision, actionId) {
  return `${String(proposalId)}:${Number(proposalRevision)}:${String(actionId)}`;
}

module.exports = {
  buildProposal,
  validateProposal,
  checkExpectedVersions,
  applyLockKey,
  newActionId,
};
