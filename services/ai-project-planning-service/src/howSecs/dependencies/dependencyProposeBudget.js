/**
 * Dependency propose — keep each LLM prompt under DashScope input-length ceiling.
 * Error seen: InternalError.Algo.InvalidParameter: Range of input length should be [1, 8192]
 * Budget is measured on full prompt chars (system + "\n\n" + user).
 *
 * Auto: resolveChatPromptCharBudget(model chain). Manual pin: HOW_DEP_LLM_PROMPT_CHAR_BUDGET.
 */

const {
  resolveChatPromptCharBudget,
  INPUT_CHAR_BUDGET_TIGHT,
} = require('@enterprise/shared/llm/openaiCompatibleClient');

const DEFAULT_PROMPT_CHAR_BUDGET = INPUT_CHAR_BUDGET_TIGHT;
const MIN_TASKS_PER_CHUNK = 1;
const MAX_TASKS_PER_CHUNK = 24;

function resolveDepPromptCharBudget(env = process.env) {
  // Feature override wins (ops pin) — still clamp to a sane range.
  const raw = Number(env.HOW_DEP_LLM_PROMPT_CHAR_BUDGET);
  if (Number.isFinite(raw) && raw >= 2000) {
    return Math.min(120000, Math.round(raw));
  }
  try {
    return resolveChatPromptCharBudget(env);
  } catch {
    return DEFAULT_PROMPT_CHAR_BUDGET;
  }
}

function promptCharLength(system, user) {
  return String(system || '').length + 2 + String(user || '').length;
}

function areaKey(task) {
  return String(task?.area || '').trim() || '__default__';
}

/**
 * Prefer co-located work (same area) so intra-feature edges stay in one call.
 * @param {object[]} taskBrief
 * @returns {object[][]}
 */
function groupTaskBriefByArea(taskBrief = []) {
  const map = new Map();
  for (const task of taskBrief) {
    if (!task?.id) continue;
    const key = areaKey(task);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(task);
  }
  return [...map.values()];
}

/**
 * Slice SEMANTIC / FACTS / allowLists to a task-id set (cited FR + evidence only).
 */
function sliceDependencyContext(semantic, facts, taskIds) {
  const idSet = new Set((taskIds || []).map(String).filter(Boolean));
  const taskBrief = (semantic?.upstream?.taskBrief || []).filter((t) => idSet.has(String(t.id)));
  const citedFr = new Set(taskBrief.flatMap((t) => (t.sourceFrIds || []).map(String)));
  const frBrief = (semantic?.business?.frBrief || []).filter((f) => citedFr.has(String(f.id)));
  const frIdSet = new Set(frBrief.map((f) => String(f.id)));

  const evidence = (facts?.evidence || []).filter((e) => {
    const taskId = e?.taskId ? String(e.taskId) : '';
    const frId = e?.frId ? String(e.frId) : '';
    if (taskId && idSet.has(taskId)) return true;
    if (frId && frIdSet.has(frId)) return true;
    return false;
  });

  const slimSemantic = {
    business: {
      locale: semantic?.business?.locale || 'vi',
      projectName: semantic?.business?.projectName || '',
      frBrief,
    },
    upstream: { taskBrief },
  };

  const slimFacts = {
    evidence,
    allowLists: {
      taskIds: taskBrief.map((t) => String(t.id)),
      frIds: frBrief.map((f) => String(f.id)),
      // Only ids in this chunk — never dump the full pack evidence catalog.
      evidenceIds: evidence.map((e) => e.id).filter(Boolean),
      depTypes: facts?.allowLists?.depTypes || ['FS', 'SS', 'FF', 'SF'],
    },
  };

  return { semantic: slimSemantic, facts: slimFacts };
}

/**
 * Greedy pack tasks into chunks that fit buildPrompt under charBudget.
 * @param {object[]} tasks
 * @param {(taskIds: string[]) => { system: string, user: string }} buildPromptForIds
 * @param {number} charBudget
 * @returns {string[][]} task id chunks
 */
function packTasksIntoPromptChunks(tasks, buildPromptForIds, charBudget) {
  const list = Array.isArray(tasks) ? tasks.filter((t) => t?.id) : [];
  if (!list.length) return [];

  const chunks = [];
  let cursor = 0;
  while (cursor < list.length) {
    let lo = MIN_TASKS_PER_CHUNK;
    let hi = Math.min(MAX_TASKS_PER_CHUNK, list.length - cursor);
    let best = lo;
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      const slice = list.slice(cursor, cursor + mid);
      const ids = slice.map((t) => String(t.id));
      const { system, user } = buildPromptForIds(ids);
      if (promptCharLength(system, user) <= charBudget) {
        best = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    // Single oversized task: still emit (caller may slim further / fail honestly).
    if (best < 1) best = 1;
    chunks.push(list.slice(cursor, cursor + best).map((t) => String(t.id)));
    cursor += best;
  }
  return chunks;
}

/**
 * Build prompt chunks: area groups → fit budget → list of { taskIds, semantic, facts }.
 */
function buildDependencyProposeChunks({
  semantic,
  facts,
  buildPrompt,
  languageInstruction = '',
  env = process.env,
} = {}) {
  const charBudget = resolveDepPromptCharBudget(env);
  const taskBrief = Array.isArray(semantic?.upstream?.taskBrief)
    ? semantic.upstream.taskBrief
    : [];

  const buildPromptForIds = (taskIds) => {
    const sliced = sliceDependencyContext(semantic, facts, taskIds);
    return buildPrompt({
      semantic: sliced.semantic,
      facts: sliced.facts,
      languageInstruction,
    });
  };

  // Fast path: whole pack fits.
  const allIds = taskBrief.map((t) => String(t.id)).filter(Boolean);
  if (allIds.length) {
    const full = buildPromptForIds(allIds);
    if (promptCharLength(full.system, full.user) <= charBudget) {
      const sliced = sliceDependencyContext(semantic, facts, allIds);
      return {
        charBudget,
        chunks: [
          {
            taskIds: allIds,
            semantic: sliced.semantic,
            facts: sliced.facts,
            prompt: full,
          },
        ],
      };
    }
  }

  const areaGroups = groupTaskBriefByArea(taskBrief);
  const chunks = [];
  for (const group of areaGroups) {
    const idChunks = packTasksIntoPromptChunks(group, buildPromptForIds, charBudget);
    for (const taskIds of idChunks) {
      const sliced = sliceDependencyContext(semantic, facts, taskIds);
      chunks.push({
        taskIds,
        semantic: sliced.semantic,
        facts: sliced.facts,
        prompt: buildPrompt({
          semantic: sliced.semantic,
          facts: sliced.facts,
          languageInstruction,
        }),
      });
    }
  }

  // Cross-area slim pass when we split — titles only so inter-area edges can surface.
  if (chunks.length > 1 && allIds.length > 1) {
    const titleOnlyBrief = taskBrief.map((t) => ({
      id: String(t.id),
      title: String(t.title || t.name || t.id).slice(0, 80),
      ...(t.area ? { area: String(t.area).slice(0, 24) } : {}),
    }));
    const crossSemantic = {
      business: {
        locale: semantic?.business?.locale || 'vi',
        projectName: semantic?.business?.projectName || '',
        frBrief: [],
      },
      upstream: { taskBrief: titleOnlyBrief },
    };
    const crossFacts = {
      evidence: [],
      allowLists: {
        taskIds: allIds,
        frIds: [],
        evidenceIds: [],
        depTypes: facts?.allowLists?.depTypes || ['FS', 'SS', 'FF', 'SF'],
      },
    };
    const crossPrompt = buildPrompt({
      semantic: crossSemantic,
      facts: crossFacts,
      languageInstruction,
    });
    if (promptCharLength(crossPrompt.system, crossPrompt.user) <= charBudget) {
      chunks.push({
        taskIds: allIds,
        semantic: crossSemantic,
        facts: crossFacts,
        prompt: crossPrompt,
        crossArea: true,
      });
    }
  }

  return { charBudget, chunks };
}

function edgePairKey(edge) {
  const a = String(edge?.predecessorTaskId || '').trim();
  const b = String(edge?.successorTaskId || '').trim();
  if (!a || !b) return '';
  return `${a}=>${b}`;
}

function mergeDependencyLlmChunkResults(chunkResults = []) {
  const edges = [];
  const seen = new Set();
  const openQuestions = [];
  let llmCalls = 0;
  let model = null;
  const failures = [];

  for (const row of chunkResults) {
    llmCalls += Number(row?.meta?.llmCalls) || (row?.ok === false || row?.ok === true ? 1 : 0);
    if (row?.meta?.model) model = row.meta.model;
    if (!row?.ok) {
      failures.push(row?.meta?.fallbackReason || 'llm_failed');
      continue;
    }
    for (const edge of row?.data?.edges || []) {
      const key = edgePairKey(edge);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      edges.push(edge);
    }
    for (const oq of row?.data?.openQuestions || []) {
      if (oq && typeof oq === 'object') openQuestions.push(oq);
    }
  }

  return {
    edges,
    openQuestions,
    llmCalls,
    model,
    failures,
    chunkCount: chunkResults.length,
    failedChunkCount: failures.length,
  };
}

module.exports = {
  DEFAULT_PROMPT_CHAR_BUDGET,
  resolveDepPromptCharBudget,
  promptCharLength,
  groupTaskBriefByArea,
  sliceDependencyContext,
  packTasksIntoPromptChunks,
  buildDependencyProposeChunks,
  mergeDependencyLlmChunkResults,
  edgePairKey,
};
