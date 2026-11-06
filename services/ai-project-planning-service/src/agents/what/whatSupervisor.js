/**
 * WHAT Domain Supervisor — section layers from whatToolDag.
 * Peer sections read one frozen snapshot, not each other's proposals.
 */

const { WHAT_TOOL_DEPENDENCIES, CANONICAL_ORDER } = require('../../orchestration/whatToolDag');
const { buildInputManifest } = require('../core/inputManifest');
const { buildContextSlice } = require('../core/contextSlice');

function manifestFor(state, toolName) {
  return buildInputManifest({
    runId: state.runId,
    phase: 'what',
    toolName,
    inputRefs: {
      snapshotId: state.snapshotId || '',
      requirementContextRef: state.contextPackage?.corpusContentHash || '',
    },
    promptVersion: state.promptVersion || 'what-v1',
  });
}

function isDone(state, toolName) {
  const rows = Array.isArray(state.agentResults) ? state.agentResults : [];
  const row = rows.find((item) => item && item.toolName === toolName);
  if (row) {
    if (row.status !== 'COMPLETED') return false;
    const manifest = manifestFor(state, toolName);
    if (row.inputHash && row.inputHash !== manifest.inputHash) return false;
    return true;
  }
  const executions = Array.isArray(state.toolExecutions) ? state.toolExecutions : [];
  const match = [...executions].reverse().find((item) => item && item.toolName === toolName);
  return Boolean(match && match.status === 'succeeded' && match.outputValidated === true);
}

function nextLayer(state = {}) {
  const nodes = [];
  for (const toolName of CANONICAL_ORDER) {
    if (isDone(state, toolName)) continue;
    const deps = WHAT_TOOL_DEPENDENCIES[toolName] || [];
    if (deps.some((dep) => !isDone(state, dep))) continue;
    nodes.push({
      id: toolName,
      graphNode: toolName,
      plain: false,
      inputManifest: manifestFor(state, toolName),
      contextSlice: buildContextSlice(toolName, state.contextSource || {}),
    });
  }
  return {
    nodes,
    finalize: nodes.length === 0 && CANONICAL_ORDER.every((name) => isDone(state, name)),
  };
}

module.exports = {
  nextLayer,
  manifestFor,
  isDone,
};
