/**
 * Dependency Propose — LLM (HOW sec pattern), chunked under DashScope input ceiling.
 * LLM chooses two time events; code maps to FS|SS|FF|SF in accept.
 * No AUTO_EDGE / SRS heuristic promote. LLM fail ≠ COMPLETE_NO_EDGES.
 */

const { isLlmEnabled } = require('../../runtime/ollamaGenerate');
const { invokeHowSemanticLlm } = require('../../engines/howSemanticLlm');
const { semanticPromptSlice } = require('./dependencySemantic');
const { PROMPT_VERSION } = require('./dependencyAnalysisStatus');
const { EVENT_PAIR_TO_TYPE } = require('./dependencyTypeMap');
const {
  buildDependencyProposeChunks,
  mergeDependencyLlmChunkResults,
  promptCharLength,
} = require('./dependencyProposeBudget');

const LLM_SHAPE = {
  edges: [
    {
      predecessorTaskId: 'TASK-A',
      successorTaskId: 'TASK-B',
      predecessorEvent: 'START|FINISH',
      successorEvent: 'START|FINISH',
      constraintStatement: 'string — B mốc bị ràng buộc bởi A mốc',
      requiredOutput: 'string',
      requiredAt: 'FULL|START|INTEGRATION|TEST_ONLY',
      lagHours: 0,
      basis: 'EXPLICIT|INFERRED',
      evidenceRefs: ['taskId:field or frId:field'],
      assumptions: [],
      gateTaskId: 'optional — leaf gate id when requiredAt=INTEGRATION',
      depType: 'optional FS|SS|FF|SF — must match event map if set',
    },
  ],
  openQuestions: [
    {
      code: 'DEP_OQ|DEP_TYPE_UNRESOLVED|DEP_WBS_REFINEMENT_REQUIRED',
      message: 'string',
      relatedTaskIds: [],
    },
  ],
};

/**
 * Compact evidence for the prompt — skip redundant title when description exists.
 */
function factsPromptSlice(facts = {}) {
  const byTask = new Map();
  for (const e of facts.evidence || []) {
    const taskId = e?.taskId ? String(e.taskId) : '';
    const frId = e?.frId ? String(e.frId) : '';
    const field = String(e?.field || '');
    const key = taskId || frId;
    if (!key) continue;
    if (!byTask.has(key)) byTask.set(key, []);
    byTask.get(key).push({ ...e, field, taskId: taskId || null, frId: frId || null });
  }

  const evidence = [];
  for (const rows of byTask.values()) {
    const hasDesc = rows.some((r) => r.field === 'description' && String(r.text || '').trim());
    for (const e of rows) {
      if (hasDesc && e.field === 'title') continue;
      evidence.push({
        id: e.id,
        taskId: e.taskId || null,
        frId: e.frId || null,
        field: e.field,
        text: e.text ? String(e.text).slice(0, 100) : '',
      });
    }
  }
  return { evidence };
}

function eventTypeMapHint() {
  return Object.entries(EVENT_PAIR_TO_TYPE)
    .map(([pair, type]) => {
      const [pred, succ] = pair.split('|');
      return `${pred}+${succ}=${type}`;
    })
    .join('; ');
}

function buildDependencyPrompt({ semantic, facts, languageInstruction = '' }) {
  const allow = facts?.allowLists || {};
  const system = [
    'You are a delivery tech lead inferring task dependencies.',
    'Return JSON only matching SHAPE. No markdown.',
    'Read SEMANTIC before FACTS. Use only ids in ALLOW.',
    'predecessorTaskId = A (predecessor); successorTaskId = B (successor).',
    'Do not invent task ids, FR ids, or evidence ids.',
    'Process in order:',
    '1) Decide if there is a real dependency (not mere topical relatedness).',
    '2) State the condition or output B needs from A (requiredOutput + constraintStatement).',
    '3) Decide whether B is blocked at START, FINISH, or an internal milestone.',
    '4) Decide which A event satisfies it: START or FINISH (or internal milestone).',
    '5) Set predecessorEvent and successorEvent only when both milestones are clear and evidenced.',
    '6) If the binding is an internal milestone without a WBS leaf/gate in ALLOW: openQuestions DEP_WBS_REFINEMENT_REQUIRED; do not invent a type.',
    '7) Never choose type from engine support — engine filter is separate.',
    '8) Do not invent lagHours; use 0 unless evidence states a wait; otherwise ask via openQuestions.',
    `Code maps events to type (${eventTypeMapHint()}). Prefer omitting depType; if set it must match that map.`,
    'requiredAt (FULL|START|INTEGRATION|TEST_ONLY) is orthogonal to type — which part of work needs the condition.',
    'When requiredAt=INTEGRATION and a choke-point leaf exists, set successorTaskId (or gateTaskId) to that gate leaf.',
    'Forbidden inferences: parallel work ⇒ SS; same feature ⇒ FF; frontend uses backend ⇒ FS; unknown ⇒ FS; engine-only-FS ⇒ change meaning to FS.',
    'Parallelism alone does not prove SS or FF.',
    'If milestones are unclear: edges may omit the pair and use openQuestions DEP_TYPE_UNRESOLVED — do not default FS.',
    'If evidence is thin and no true dependency: edges:[] and openQuestions. Empty edges is valid when analysis finds none.',
    'Each evidenceRef must be an id from FACTS.evidence belonging to A, B, or a cited FR of those tasks.',
    languageInstruction || '',
  ]
    .filter(Boolean)
    .join(' ');

  const user = [
    `SEMANTIC=${JSON.stringify(semanticPromptSlice(semantic))}`,
    `FACTS=${JSON.stringify(factsPromptSlice(facts))}`,
    `ALLOW=${JSON.stringify({
      taskIds: allow.taskIds || [],
      frIds: allow.frIds || [],
      evidenceIds: allow.evidenceIds || [],
      events: ['START', 'FINISH'],
      requiredAt: ['FULL', 'START', 'INTEGRATION', 'TEST_ONLY'],
    })}`,
    `SHAPE=${JSON.stringify(LLM_SHAPE)}`,
    `EVENT_TYPE_MAP=${JSON.stringify(EVENT_PAIR_TO_TYPE)}`,
    `PROMPT_VERSION=${PROMPT_VERSION}`,
  ].join('\n');

  return { system, user };
}

async function invokeOneDependencyPrompt({
  system,
  user,
  env,
  generateJsonFn,
  timeoutMs,
}) {
  const llm = await invokeHowSemanticLlm({
    system,
    user,
    env,
    generateJsonFn,
    timeoutMs,
  });
  if (!llm.ok) {
    return {
      ok: false,
      data: { edges: [], openQuestions: [] },
      meta: {
        fallbackReason: llm.meta?.fallbackReason || 'llm_failed',
        llmCalls: llm.meta?.llmCalls || 1,
        model: llm.meta?.model || null,
      },
    };
  }
  const data =
    llm.data && typeof llm.data === 'object'
      ? {
          edges: Array.isArray(llm.data.edges) ? llm.data.edges : [],
          openQuestions: Array.isArray(llm.data.openQuestions) ? llm.data.openQuestions : [],
        }
      : { edges: [], openQuestions: [] };
  return {
    ok: true,
    data,
    meta: {
      llmCalls: llm.meta?.llmCalls || 1,
      model: llm.meta?.model || null,
    },
  };
}

/**
 * @returns {Promise<{ ok: boolean, data: object|null, skipped?: boolean, meta: object }>}
 */
async function proposeDependencyWithLlm({
  semantic = null,
  facts = null,
  env = process.env,
  generateJsonFn = null,
} = {}) {
  if (!semantic || typeof semantic !== 'object') {
    return {
      ok: false,
      skipped: true,
      data: null,
      meta: {
        fallbackReason: 'missing_SEMANTIC',
        analysisStatus: 'SEMANTIC_INCOMPLETE',
        llmCalls: 0,
        providerAttempts: 0,
        promptVersion: PROMPT_VERSION,
      },
    };
  }
  if (!isLlmEnabled(env)) {
    return {
      ok: false,
      skipped: true,
      data: { edges: [], openQuestions: [] },
      meta: {
        fallbackReason: 'LLM_off',
        analysisStatus: 'SKIPPED',
        source: 'llm_skipped',
        llmCalls: 0,
        providerAttempts: 0,
        promptVersion: PROMPT_VERSION,
      },
    };
  }

  let languageInstruction = '';
  try {
    const { languageInstruction: langFn } = require('../../semantic/buildSemanticDeriveContext');
    languageInstruction = langFn(semantic.business?.locale || 'vi');
  } catch {
    languageInstruction = '';
  }

  const { resolveHowSecAttemptTimeoutMs } = require('../howSecAttemptTimeout');
  const timeoutMs = resolveHowSecAttemptTimeoutMs(env);

  const { charBudget, chunks } = buildDependencyProposeChunks({
    semantic,
    facts,
    buildPrompt: buildDependencyPrompt,
    languageInstruction,
    env,
  });

  if (!chunks.length) {
    return {
      ok: false,
      skipped: true,
      data: { edges: [], openQuestions: [] },
      meta: {
        fallbackReason: 'missing_SEMANTIC',
        analysisStatus: 'SEMANTIC_INCOMPLETE',
        llmCalls: 0,
        providerAttempts: 0,
        promptVersion: PROMPT_VERSION,
        charBudget,
      },
    };
  }

  // Guard: even a 1-task chunk can exceed budget if evidence is huge — fail closed with clear reason.
  for (const chunk of chunks) {
    const len = promptCharLength(chunk.prompt.system, chunk.prompt.user);
    if (len > charBudget && chunk.taskIds.length <= 1) {
      return {
        ok: false,
        data: { edges: [], openQuestions: [] },
        meta: {
          fallbackReason: `dep_prompt_over_budget:${len}>${charBudget}`,
          analysisStatus: 'FAILED',
          source: 'llm_failed',
          llmCalls: 0,
          providerAttempts: 0,
          promptVersion: PROMPT_VERSION,
          charBudget,
          promptChars: len,
        },
      };
    }
  }

  const chunkResults = [];
  for (const chunk of chunks) {
    const result = await invokeOneDependencyPrompt({
      system: chunk.prompt.system,
      user: chunk.prompt.user,
      env,
      generateJsonFn,
      timeoutMs,
    });
    chunkResults.push(result);
  }

  const merged = mergeDependencyLlmChunkResults(chunkResults);

  if (merged.failedChunkCount > 0) {
    return {
      ok: false,
      data: { edges: merged.edges, openQuestions: merged.openQuestions },
      meta: {
        fallbackReason: merged.failures[0] || 'llm_failed',
        analysisStatus: 'FAILED',
        source: 'llm_failed',
        llmCalls: merged.llmCalls,
        providerAttempts: merged.llmCalls,
        model: merged.model,
        promptVersion: PROMPT_VERSION,
        charBudget,
        chunkCount: merged.chunkCount,
        failedChunkCount: merged.failedChunkCount,
      },
    };
  }

  return {
    ok: true,
    data: {
      edges: merged.edges,
      openQuestions: merged.openQuestions,
    },
    meta: {
      llmCalls: merged.llmCalls,
      providerAttempts: merged.llmCalls,
      model: merged.model,
      source: 'fact_llm',
      promptVersion: PROMPT_VERSION,
      charBudget,
      chunkCount: merged.chunkCount,
    },
  };
}

/** @deprecated Heuristic propose removed — do not use on HOW path. */
function proposeDependencyDeterministic() {
  return {
    ok: false,
    skipped: true,
    data: { edges: [], openQuestions: [] },
    meta: {
      fallbackReason: 'deterministic_removed',
      analysisStatus: 'SKIPPED',
      llmCalls: 0,
      source: 'deterministic_removed',
    },
  };
}

module.exports = {
  proposeDependencyWithLlm,
  proposeDependencyDeterministic,
  buildDependencyPrompt,
  LLM_SHAPE,
  factsPromptSlice,
};
