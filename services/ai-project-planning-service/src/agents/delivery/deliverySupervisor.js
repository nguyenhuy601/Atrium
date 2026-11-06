/**
 * Delivery Domain Supervisor. L2 drafts only.
 * Does not stamp release or handover.
 */

const { DELIVERY_NODES } = require('./deliveryDag');
const { verifyDomainResult } = require('../core/masterSupervisor');
const { mapExecutionToAgentResult } = require('../core/agentResult');

function assessReleaseCriteria(input = {}) {
  const hasScope = Boolean(input.snapshotId || input.requirementContextRef);
  if (!hasScope) {
    return mapExecutionToAgentResult(
      {
        toolName: 'releaseReadiness',
        inputAvailable: false,
        errorCode: 'INPUT_MISSING',
        outputValidated: false,
      },
      { requireEvidence: true }
    );
  }
  return mapExecutionToAgentResult(
    {
      toolName: 'releaseReadiness',
      status: 'succeeded',
      outputValidated: false,
      evidenceRefs: ['criteria:release'],
      inputHash: input.inputHash || '',
    },
    { requireEvidence: true }
  );
}

function checkQualityConditions(results = []) {
  const readiness = results.find((row) => row.toolName === 'releaseReadiness');
  if (!readiness || readiness.status === 'BLOCKED' || readiness.status === 'FAILED') {
    return mapExecutionToAgentResult(
      {
        toolName: 'qualityGate',
        inputAvailable: false,
        errorCode: 'INPUT_MISSING',
        outputValidated: false,
      },
      { requireEvidence: true }
    );
  }
  return mapExecutionToAgentResult(
    {
      toolName: 'qualityGate',
      status: 'succeeded',
      outputValidated: true,
      evidenceRefs: ['gate:quality-conditions'],
      inputHash: readiness.inputHash || '',
    },
    { requireEvidence: true }
  );
}

function resultOf(state, nodeId) {
  const rows = Array.isArray(state.agentResults) ? state.agentResults : [];
  return rows.find((row) => row && row.toolName === nodeId) || null;
}

function isTerminal(state, nodeId) {
  const row = resultOf(state, nodeId);
  if (!row || row.disposition === 'SKIPPED') return false;
  return ['COMPLETED', 'NEEDS_REVIEW', 'BLOCKED', 'FAILED'].includes(row.status);
}

function nextLayer(state = {}) {
  const nodes = [];
  for (const node of DELIVERY_NODES) {
    if (!node.implemented) continue;
    if (resultOf(state, node.id)) continue;
    if (node.deps.some((dep) => !isTerminal(state, dep))) continue;
    nodes.push({ id: node.id, graphNode: node.id, kind: node.kind || 'tool' });
  }
  return { nodes };
}

/**
 * Run implemented nodes only. Unimplemented specialists are not COMPLETED.
 * @param {object} state
 */
function runDelivery(state = {}) {
  const agentResults = [];
  const pending = new Set(
    DELIVERY_NODES.filter((node) => node.implemented).map((node) => node.id)
  );
  const guard = DELIVERY_NODES.length + 1;
  let steps = 0;
  while (pending.size && steps < guard) {
    steps += 1;
    const layer = nextLayer({ ...state, agentResults });
    if (!layer.nodes.length) break;
    for (const node of layer.nodes) {
      const result =
        node.id === 'releaseReadiness'
          ? assessReleaseCriteria(state)
          : checkQualityConditions(agentResults);
      agentResults.push(result);
      pending.delete(node.id);
    }
  }
  const verify = verifyDomainResult(agentResults);
  return {
    agentResults,
    approvalRequired: verify.approvalRequired,
    executionStatus: verify.executionStatus,
  };
}

module.exports = {
  assessReleaseCriteria,
  checkQualityConditions,
  nextLayer,
  runDelivery,
};
