/**
 * HOW Domain Supervisor — builds a layer plan from the data DAG.
 * Does not write proposals. LangGraph Send executes the layer.
 */

const { HOW_TOOL_DEPENDENCIES } = require('../../orchestration/howToolDag');
const { buildInputManifest } = require('../core/inputManifest');
const { buildContextSlice } = require('../core/contextSlice');
const { canReuseResult, isNoProgress } = require('../core/agentResult');
const { mergeParallelToolContainers } = require('../../tools/mergePlanningContainers');

/** Quality context does not read analyses.dependency — whole tool stays on the WBS layer. */
const QUALITY_READS_DEPENDENCY = false;

const LAYER_NODES = Object.freeze([
  'WbsTool',
  'DependencyTool',
  'QualityPlanTool',
  'RiskToolSource',
  'ArchitectureTool',
  'RiskToolDependency',
  'ScheduleTool',
]);

const REQUIRED_NODES = Object.freeze([
  'WbsTool',
  'DependencyTool',
  'QualityPlanTool',
  'RiskToolSource',
  'RiskToolDependency',
  'ScheduleTool',
]);

const GRAPH_NODE = Object.freeze({
  WbsTool: { graphNode: 'plainTools', plain: true },
  ScheduleTool: { graphNode: 'plainTools', plain: true },
  DependencyTool: { graphNode: 'DependencyTool', plain: false },
  QualityPlanTool: { graphNode: 'QualityPlanTool', plain: false },
  RiskToolSource: { graphNode: 'RiskTool', plain: false, riskScope: 'source' },
  RiskToolDependency: { graphNode: 'RiskTool', plain: false, riskScope: 'dependency' },
  ArchitectureTool: { graphNode: 'ArchitectureTool', plain: false },
});

function architectureInputReady(state = {}) {
  if (state.inputRefs?.architectureContextRef) return true;
  if (state.pack?.architecture) return true;
  if (state.container?.analyses?.architecture) return true;
  return false;
}

function refsFromState(state = {}) {
  const wbs = state.container?.planning?.wbs || {};
  const dependency = state.container?.analyses?.dependency;
  return {
    snapshotId: state.snapshotId || '',
    wbsRevisionId: state.wbsRevisionId || wbs.revisionId || '',
    requirementContextRef: state.contextPackage?.corpusContentHash || state.requirementContextRef || '',
    dependencyArtifactRef: dependency?.revisionId || (dependency ? 'dependency' : ''),
    architectureContextRef: state.inputRefs?.architectureContextRef || '',
  };
}

function manifestFor(state, toolName) {
  return buildInputManifest({
    runId: state.runId,
    phase: 'how',
    toolName,
    inputRefs: refsFromState(state),
    promptVersion: state.promptVersion || 'how-v1',
  });
}

function storedResult(state, nodeId) {
  const rows = Array.isArray(state.agentResults) ? state.agentResults : [];
  const fromAgent = rows.find((row) => row && (row.toolName === nodeId || row.id === nodeId));
  if (fromAgent) return fromAgent;
  const executions = Array.isArray(state.toolExecutions) ? state.toolExecutions : [];
  const match = [...executions].reverse().find((row) => row && row.toolName === nodeId);
  if (!match) return null;
  return {
    toolName: nodeId,
    status: match.outputValidated && match.status === 'succeeded' ? 'COMPLETED' : match.status,
    inputHash: match.inputHash,
    outputHash: match.outputHash,
    disposition: match.disposition || 'RUN',
  };
}

function isDone(state, nodeId) {
  if (nodeId === 'RiskToolSource') {
    return Boolean(state.container?.analyses?.riskByScope?.source);
  }
  if (nodeId === 'RiskToolDependency') {
    return Boolean(state.container?.analyses?.riskByScope?.dependency);
  }
  const agents = Array.isArray(state.agentResults) ? state.agentResults : [];
  const agent = agents.find((row) => row && (row.toolName === nodeId || row.id === nodeId));
  if (agent) {
    if (agent.disposition === 'SKIPPED') return true;
    if (agent.status !== 'COMPLETED') return false;
    if (agent.inputHash && agent.inputHash !== manifestFor(state, nodeId).inputHash) return false;
    return true;
  }
  const executions = Array.isArray(state.toolExecutions) ? state.toolExecutions : [];
  const match = [...executions].reverse().find((row) => row && row.toolName === nodeId);
  return Boolean(match && match.status === 'succeeded' && match.outputValidated === true);
}

function attemptsExhausted(state, nodeId) {
  const executions = Array.isArray(state.toolExecutions) ? state.toolExecutions : [];
  const failed = executions.filter((row) => {
    if (!row || row.status !== 'failed') return false;
    if (row.toolName === nodeId) return true;
    if (row.toolName === 'RiskTool' && nodeId === 'RiskToolSource' && row.riskScope === 'source') {
      return true;
    }
    if (
      row.toolName === 'RiskTool' &&
      nodeId === 'RiskToolDependency' &&
      row.riskScope === 'dependency'
    ) {
      return true;
    }
    return false;
  });
  return failed.length >= 3;
}

function depsOf(nodeId) {
  return HOW_TOOL_DEPENDENCIES[nodeId] || [];
}

/**
 * Next Send layer. Architecture without input is SKIPPED and omitted.
 * @param {object} state
 */
function nextLayer(state = {}) {
  const skipped = [];
  const candidates = [];
  for (const nodeId of LAYER_NODES) {
    if (nodeId === 'ArchitectureTool' && !architectureInputReady(state)) {
      skipped.push({
        id: 'how:ArchitectureTool',
        toolName: 'ArchitectureTool',
        disposition: 'SKIPPED',
        reason: 'ARCHITECTURE_INPUT_NOT_AVAILABLE',
        status: 'BLOCKED',
      });
      continue;
    }
    if (isDone(state, nodeId)) continue;
    if (attemptsExhausted(state, nodeId)) continue;
    const previous = storedResult(state, nodeId);
    const manifest = manifestFor(state, nodeId);
    if (
      previous &&
      isNoProgress(previous, { inputHash: manifest.inputHash, outputHash: previous.outputHash }) &&
      previous.status !== 'COMPLETED'
    ) {
      continue;
    }
    if (
      canReuseResult(previous, {
        inputHash: manifest.inputHash,
        promptVersion: manifest.promptVersion,
        model: state.model || previous?.model,
      })
    ) {
      continue;
    }
    const unmet = depsOf(nodeId).filter((dep) => !isDone(state, dep));
    if (unmet.length) continue;
    const binding = GRAPH_NODE[nodeId];
    candidates.push({
      id: nodeId,
      graphNode: binding.graphNode,
      plain: binding.plain,
      riskScope: binding.riskScope || null,
      inputManifest: manifest,
      contextSlice: buildContextSlice(nodeId, state.contextSource || {}),
    });
  }
  const finalize = candidates.length === 0 && readyToFinalize(state);
  return { nodes: candidates, skipped, finalize };
}

function readyToFinalize(state = {}) {
  return REQUIRED_NODES.every((nodeId) => isDone(state, nodeId));
}

function arrayKeyPath(patch, path) {
  const parts = path.split('.');
  let cursor = patch;
  for (const part of parts) {
    if (cursor == null || typeof cursor !== 'object') return undefined;
    cursor = cursor[part];
  }
  return cursor;
}

/**
 * Join patches onto the frozen layer base. Same array key from two workers is a conflict.
 * @param {object} layerBase
 * @param {object[]} patches
 */
function joinLayer(layerBase, patches = []) {
  const watched = ['analyses.risk.items', 'analyses.risk.risks'];
  for (const path of watched) {
    const writers = (patches || []).filter((patch) => Array.isArray(arrayKeyPath(patch, path)));
    if (writers.length > 1) {
      return { ok: false, code: 'SHARED_KEY', key: path };
    }
  }
  return {
    ok: true,
    container: mergeParallelToolContainers(layerBase, patches || []),
  };
}

module.exports = {
  QUALITY_READS_DEPENDENCY,
  LAYER_NODES,
  REQUIRED_NODES,
  GRAPH_NODE,
  architectureInputReady,
  manifestFor,
  nextLayer,
  readyToFinalize,
  joinLayer,
  isDone,
};
