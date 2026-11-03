/**
 * Nested phase subgraph (what/how) + LangGraph interrupt:
 * parent orchestrator channels stay at invoke input; FR/HOW artifacts live under
 * checkpoint_ns = phase name. Recover SharedChannels from that namespace.
 */

const { isInterrupted, INTERRUPT } = require('@langchain/langgraph');
const { projectSharedFromState, SHARED_PHASE_KEYS } = require('./sharedPhaseChannels');

function readInterruptPayload(state) {
  const raw = state?.[INTERRUPT] || state?.__interrupt__ || null;
  if (!raw) return null;
  const first = Array.isArray(raw) ? raw[0] : raw;
  if (first && typeof first === 'object' && first.value != null) return first.value;
  return first;
}

function channelValuesFromTuple(tuple) {
  const cp = tuple?.checkpoint || null;
  return (
    cp?.channel_values ||
    cp?.channelValues ||
    (tuple && typeof tuple === 'object' ? tuple.channel_values : null) ||
    {}
  );
}

/**
 * @param {{ checkpointer?: object, threadId: string, phase: 'what'|'how', parentState?: object }} opts
 */
async function loadPhaseSubgraphSharedState(opts = {}) {
  const checkpointer = opts.checkpointer;
  const threadId = String(opts.threadId || '');
  const phase = opts.phase === 'how' ? 'how' : 'what';
  if (!checkpointer || typeof checkpointer.getTuple !== 'function' || !threadId) {
    return null;
  }
  try {
    const tuple = await checkpointer.getTuple({
      configurable: { thread_id: threadId, checkpoint_ns: phase },
    });
    const values = channelValuesFromTuple(tuple);
    if (!values || !Object.keys(values).length) return null;
    return projectSharedFromState(values);
  } catch (err) {
    console.warn(
      '[agent_core] loadPhaseSubgraphSharedState failed phase=%s: %s',
      phase,
      err?.message || err
    );
    return null;
  }
}

function mergeSharedPreferRight(base, overlay) {
  const { mergeSrsProposalPatches } = require('./whatPhaseToolNodes');
  const { deepMergePlanningContainers } = require('../tools/mergePlanningContainers');
  const out = { ...(base && typeof base === 'object' ? base : {}) };
  const src = overlay && typeof overlay === 'object' ? overlay : {};
  for (const key of SHARED_PHASE_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(src, key)) continue;
    const val = src[key];
    if (val === undefined) continue;
    if (val === null && out[key] != null) continue;
    if (Array.isArray(val) && val.length === 0 && Array.isArray(out[key]) && out[key].length) {
      continue;
    }
    if (key === 'srsProposal') {
      out[key] = mergeSrsProposalPatches(out[key], val);
      continue;
    }
    if (key === 'container') {
      out[key] = deepMergePlanningContainers(out[key] || {}, val || {});
      continue;
    }
    if (key === 'history' || key === 'toolResults' || key === 'toolExecutions' || key === 'messages') {
      const left = Array.isArray(out[key]) ? out[key] : [];
      const right = Array.isArray(val) ? val : [];
      out[key] = left.length || right.length ? [...left, ...right.filter((x) => !left.includes(x))] : left;
      continue;
    }
    out[key] = val;
  }
  return out;
}

/**
 * After orchestrator.invoke: if interrupted, overlay phase subgraph checkpoint channels.
 * @param {object} finalState
 * @param {{ checkpointer?: object, threadId: string, phase: 'what'|'how' }} opts
 */
async function resolveOrchestratorInvokeState(finalState, opts = {}) {
  const parent = projectSharedFromState(finalState || {});
  const interrupted = isInterrupted(finalState) || Boolean(finalState?.[INTERRUPT] || finalState?.__interrupt__);
  const hitlInterrupt = readInterruptPayload(finalState);
  if (!interrupted) {
    return {
      ...parent,
      interrupted: false,
      hitlInterrupt: null,
    };
  }
  const nested = await loadPhaseSubgraphSharedState(opts);
  const merged = nested ? mergeSharedPreferRight(parent, nested) : parent;
  console.info(
    '[agent_core] interrupt recovered phase=%s hasSrs=%s hist=%s',
    opts.phase,
    Boolean(merged.srsProposal || merged.container?.analyses?.srsProposal),
    Array.isArray(merged.history) ? merged.history.length : 0
  );
  return {
    ...merged,
    interrupted: true,
    hitlInterrupt,
    paused: true,
    stopReason: merged.stopReason || null,
    hitl: hitlInterrupt || merged.hitl || null,
  };
}

module.exports = {
  readInterruptPayload,
  loadPhaseSubgraphSharedState,
  resolveOrchestratorInvokeState,
  mergeSharedPreferRight,
};
