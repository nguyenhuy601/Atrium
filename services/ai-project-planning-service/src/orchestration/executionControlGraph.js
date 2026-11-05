/**
 * ExecutionControlGraph — post-Gate2 delivery monitoring (not HOW phase).
 * Nodes: Context → DetectImpact → Propose → Validate → WaitApproval → ApplyOrReconcile → FollowUp
 * Domain approve is HTTP on project-service; this graph models analyze/propose path.
 */

const { Annotation, StateGraph, START, END } = require('@langchain/langgraph');

function field() {
  return Annotation();
}

const ExecutionControlState = Annotation.Root({
  projectId: field(),
  issueId: field(),
  pack: field(),
  detection: field(),
  impact: field(),
  proposals: field(),
  validation: field(),
  exception: field(),
  applyResult: field(),
  followUp: field(),
  status: field(),
  error: field(),
  attemptCount: field(),
});

function buildExecutionControlGraph(hooks = {}) {
  const {
    buildContext = async (s) => s.pack || {},
    detectAndImpact = async () => ({ signals: [], impactStatus: 'UNKNOWN' }),
    propose = async () => ({ proposals: [] }),
    validate = async (s) => ({ ok: true, proposals: s.proposals || [] }),
    classifyException = null,
    maxProposeAttempts = 3,
  } = hooks;

  const graph = new StateGraph(ExecutionControlState);

  graph.addNode('contextBuilder', async (state) => {
    const pack = await buildContext(state);
    return { pack, status: 'context_ready', attemptCount: state.attemptCount || 0 };
  });

  graph.addNode('detectImpact', async (state) => {
    const result = await detectAndImpact(state);
    return {
      detection: result.detection || result,
      impact: result.impact || { impactStatus: result.impactStatus || 'UNKNOWN' },
      status: 'detected',
    };
  });

  graph.addNode('propose', async (state) => {
    try {
      const out = await propose(state);
      const proposals = out.proposals || out || [];
      if (!proposals.length) {
        return {
          proposals: [],
          status: out.needsInput ? 'needs_input' : 'needs_review',
        };
      }
      return { proposals, status: 'proposed', attemptCount: (state.attemptCount || 0) + 1 };
    } catch (err) {
      if (classifyException) {
        const { next, record } = classifyException(err, {
          failedStep: 'propose',
          attemptCount: state.attemptCount || 0,
          maxFixAttempts: maxProposeAttempts,
        });
        return {
          exception: record,
          status: next === 'FIX_PROPOSAL' ? 'retry_propose' : 'needs_review',
          attemptCount: (state.attemptCount || 0) + 1,
          error: String(err.message || err),
        };
      }
      return { status: 'needs_review', error: String(err.message || err) };
    }
  });

  graph.addNode('validate', async (state) => {
    const v = await validate(state);
    if (!v.ok) {
      return {
        validation: v,
        status: (state.attemptCount || 0) < maxProposeAttempts ? 'retry_propose' : 'needs_review',
      };
    }
    return { validation: v, proposals: v.proposals || state.proposals, status: 'validated' };
  });

  graph.addNode('awaitApproval', async (state) => {
    // SoT decision is HTTP on project-service; graph parks as waiting_human
    return { status: 'waiting_human' };
  });

  graph.addNode('emitTerminal', async (state) => ({
    status: state.status || 'needs_review',
  }));

  graph.addEdge(START, 'contextBuilder');
  graph.addEdge('contextBuilder', 'detectImpact');
  graph.addEdge('detectImpact', 'propose');
  graph.addConditionalEdges(
    'propose',
    (s) => {
      if (s.status === 'retry_propose') return 'propose';
      if (s.status === 'needs_input' || s.status === 'needs_review') return 'emitTerminal';
      return 'validate';
    },
    {
      propose: 'propose',
      validate: 'validate',
      emitTerminal: 'emitTerminal',
    }
  );
  graph.addConditionalEdges(
    'validate',
    (s) => {
      if (s.status === 'retry_propose') return 'propose';
      if (s.status === 'validated') return 'awaitApproval';
      return 'emitTerminal';
    },
    {
      propose: 'propose',
      awaitApproval: 'awaitApproval',
      emitTerminal: 'emitTerminal',
    }
  );
  graph.addEdge('awaitApproval', END);
  graph.addEdge('emitTerminal', END);

  return graph.compile(hooks.checkpointer ? { checkpointer: hooks.checkpointer } : undefined);
}

/**
 * Run analyze/propose for an issue pack (no apply — apply after HTTP approve).
 */
async function runExecutionControlAnalyze(input, hooks = {}) {
  const graph = buildExecutionControlGraph(hooks);
  const threadId = `exec:${input.projectId}:${input.issueId}:${input.runEpoch || Date.now()}`;
  const result = await graph.invoke(
    {
      projectId: input.projectId,
      issueId: input.issueId,
      pack: input.pack || null,
      proposals: [],
      attemptCount: 0,
      status: 'queued',
    },
    { configurable: { thread_id: threadId } }
  );
  return { threadId, result };
}

module.exports = {
  buildExecutionControlGraph,
  runExecutionControlAnalyze,
  ExecutionControlState,
};
