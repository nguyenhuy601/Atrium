/**
 * One chunk: LLM call, contract accept, quality gate, limited repair.
 * FR the model skips stay uncovered. Does not choose the next planning tool.
 * Prompt uses wbs-chunk-semantic-v1 + soft token budget / bisect (never strip AC).
 */

const { generateJson } = require('../runtime/ollamaGenerate');
const { cachedGenerateJson } = require('../artifacts/cachedGenerateJson');
const {
  resolveWbsLlmNumPredict,
  resolveWbsLlmNumCtx,
  resolveWbsLlmTimeoutMs,
  resolveWbsLlmMaxRepair,
} = require('../contracts/howWbsLlmContract');
const {
  acceptWbsStoryTasks,
  buildBudgetedWbsStoryLlmPrompt,
  resolveAcRefToWhitelist,
} = require('../engines/wbsProposeLlm');
const {
  assessInputReadiness,
  assessDecompositionQuality,
  formatRepairFeedback,
} = require('../engines/wbsDecompositionQuality');

function coveredFrIds(leaves) {
  const ids = new Set();
  for (const leaf of leaves || []) {
    const frId = String(leaf?.sourceFrIds?.[0] || '').trim();
    if (frId) ids.add(frId);
  }
  return ids;
}

function prefixTasks(tasks, prefix) {
  const prefixToken = String(prefix || '').trim();
  return (tasks || []).map((leaf) => {
    const leafId = String(leaf?.id || '').trim();
    if (!leafId) return { ...leaf, id: leafId };
    if (!prefixToken) return { ...leaf, id: leafId };
    const id =
      leafId === prefixToken ||
      leafId.startsWith(`${prefixToken}-`) ||
      leafId.startsWith(prefixToken)
        ? leafId
        : `${prefixToken}-${leafId}`;
    return { ...leaf, id };
  });
}

/**
 * @param {object} input chunk input stored on the work unit
 * @param {{ env?: object, generateJsonFn?: Function }} [opts]
 */
async function executeWbsChunk(input = {}, opts = {}) {
  const env = opts.env || process.env;
  const frUnits = Array.isArray(input.frUnits) ? input.frUnits : [];
  const stories = Array.isArray(input.stories) ? input.stories : [];
  const epics = Array.isArray(input.epics) ? input.epics : [];
  const idPrefix = String(input.idPrefix || 'c0');
  const roleAllowList = Array.isArray(input.roleAllowList) ? input.roleAllowList : null;
  const gen = typeof opts.generateJsonFn === 'function' ? opts.generateJsonFn : generateJson;
  const numCtx = resolveWbsLlmNumCtx(env);
  const timeoutMs = resolveWbsLlmTimeoutMs(env);
  const maxRepair = resolveWbsLlmMaxRepair(env);
  const startedAt = Date.now();
  // Hard wall so repair × per-call timeout cannot pin WbsTool for 12m+ on one chunk.
  const chunkWallMs = Math.min(
    Number(env.HOW_WBS_CHUNK_WALL_MS) > 0
      ? Math.round(Number(env.HOW_WBS_CHUNK_WALL_MS))
      : timeoutMs * (1 + maxRepair + 1),
    Number(env.HOW_WBS_TOOL_TIMEOUT_MS) > 0
      ? Math.round(Number(env.HOW_WBS_TOOL_TIMEOUT_MS))
      : 900_000
  );
  let llmCalls = 0;
  let promptChars = 0;
  let model = null;
  let repairAttempts = 0;
  let budgetTrimSteps = [];
  let lastEstimatedTokens = 0;
  const clarifications = [];
  const qualityIssues = [];

  function wallExceeded() {
    return Date.now() - startedAt >= chunkWallMs;
  }

  const readiness = assessInputReadiness(frUnits);
  if (!readiness.ok) {
    clarifications.push(...readiness.clarifications);
    return {
      ok: false,
      retryable: false,
      needsReview: true,
      reason: 'insufficient_source',
      clarifications,
      qualityIssues,
      llmCalls,
      promptChars,
      model,
      repairAttempts,
      inputSnapshotId: input.inputSnapshotId || null,
    };
  }

  async function runSliceOnce(slice, prefix, repairFeedback) {
    const budgeted = buildBudgetedWbsStoryLlmPrompt({
      frUnits: slice,
      stories,
      epics,
      semantic: input.semantic || null,
      localeInstruction: input.localeInstruction || '',
      roleAllowList,
      repairFeedback,
      env,
    });
    lastEstimatedTokens = budgeted.estimatedTokens;
    if (budgeted.budgetTrimSteps?.length) {
      budgetTrimSteps = [...new Set([...budgetTrimSteps, ...budgeted.budgetTrimSteps])];
    }

    if (budgeted.overBudget && slice.length > 1) {
      const mid = Math.ceil(slice.length / 2);
      console.info(
        `[wbs-chunk] prompt_bisect prefix=${prefix} fr=${slice.length} tokens=${budgeted.estimatedTokens} budget=${budgeted.budget}`
      );
      const left = await runSliceOnce(slice.slice(0, mid), `${prefix}b0`, repairFeedback);
      const right = await runSliceOnce(slice.slice(mid), `${prefix}b1`, repairFeedback);
      const tasks = [...(left.tasks || []), ...(right.tasks || [])];
      if (left.ok && right.ok) {
        return {
          ok: true,
          tasks,
          clarifications: [...(left.clarifications || []), ...(right.clarifications || [])],
          bisect: true,
        };
      }
      return {
        ok: false,
        retryable: left.retryable !== false || right.retryable !== false,
        needsReview: Boolean(left.needsReview || right.needsReview),
        reason: left.ok ? right.reason : left.reason,
        tasks,
        clarifications: [...(left.clarifications || []), ...(right.clarifications || [])],
        issues: [...(left.issues || []), ...(right.issues || [])],
        bisect: true,
      };
    }

    if (budgeted.overBudget) {
      return {
        ok: false,
        retryable: false,
        needsReview: true,
        reason: 'prompt_over_budget',
        estimatedTokens: budgeted.estimatedTokens,
        budget: budgeted.budget,
        budgetTrimSteps,
      };
    }

    const prompt = budgeted.prompt;
    promptChars += prompt.length;
    const numPredict = resolveWbsLlmNumPredict(slice.length, env);
    let llmResult;
    try {
      llmResult = await cachedGenerateJson({
        prompt,
        numPredict,
        numCtx,
        timeoutMs,
        temperature: 0.1,
        env,
        jobType: 'wbs',
        generateJsonFn: gen,
      });
    } catch (err) {
      llmCalls += 1;
      return { ok: false, retryable: true, reason: String(err?.message || err || 'llm_throw') };
    }
    if (!llmResult?.cacheHit) llmCalls += 1;
    model = llmResult?.model || model;
    if (!llmResult?.ok || llmResult.data == null) {
      return { ok: false, retryable: true, reason: llmResult?.error || 'llm_failed' };
    }
    const accepted = acceptWbsStoryTasks(llmResult.data, stories, {
      frUnits: slice,
      epics,
      semantic: input.semantic || null,
      roleAllowList,
      requireChunkEnvelope: true,
    });
    if (!accepted.ok) {
      return {
        ok: false,
        retryable: true,
        reason: (accepted.errors || ['contract_fail']).join(';').slice(0, 400),
        contractErrors: accepted.errors || [],
      };
    }
    const tasks = prefixTasks(accepted.tasks, prefix);
    const quality = assessDecompositionQuality({
      frUnits: slice,
      tasks,
      clarifications: accepted.clarifications || [],
      resolveAcRef: (raw, acList, frId) => resolveAcRefToWhitelist(raw, acList, { frId }),
    });
    if (accepted.clarifications?.length && (!tasks.length || !quality.ok)) {
      return {
        ok: false,
        retryable: false,
        needsReview: true,
        reason: 'clarifications_returned',
        clarifications: accepted.clarifications,
        issues: quality.issues,
        tasks,
      };
    }
    if (!quality.ok) {
      return {
        ok: false,
        retryable: true,
        reason: quality.issues.map((i) => i.code).join('|') || 'quality_fail',
        issues: quality.issues,
        clarifications: quality.clarifications,
        tasks,
        repairFeedback: formatRepairFeedback(quality),
      };
    }
    return { ok: true, tasks, clarifications: accepted.clarifications || [] };
  }

  async function runSlice(slice, prefix) {
    let feedback = null;
    let last = null;
    for (let attempt = 0; attempt <= maxRepair; attempt += 1) {
      if (wallExceeded()) {
        return {
          ok: false,
          retryable: false,
          needsReview: true,
          reason: 'chunk_wall_timeout',
          issues: last?.issues || [],
          clarifications: last?.clarifications || [],
          tasks: last?.tasks || [],
        };
      }
      if (attempt > 0) repairAttempts += 1;
      last = await runSliceOnce(
        slice,
        `${prefix}${attempt > 0 ? `r${attempt}` : ''}`,
        feedback
      );
      if (last.ok) return last;
      if (last.needsReview) return last;
      if (last.reason === 'prompt_over_budget') return last;
      if (attempt >= maxRepair) break;
      feedback = last.repairFeedback || {
        instruction: 'Fix contract/quality errors.',
        issues: last.contractErrors || [{ code: 'contract_fail', message: last.reason }],
        clarifications: last.clarifications || [],
      };
    }
    return {
      ok: false,
      retryable: false,
      needsReview: true,
      reason: last?.reason || 'quality_repair_exhausted',
      issues: last?.issues || [],
      clarifications: last?.clarifications || [],
      tasks: last?.tasks || [],
    };
  }

  const first = await runSlice(frUnits, idPrefix);
  if (!first.ok && !first.tasks?.length) {
    if (first.clarifications?.length) clarifications.push(...first.clarifications);
    if (first.issues?.length) qualityIssues.push(...first.issues);
    return {
      ok: false,
      retryable: first.retryable !== false && !first.needsReview,
      needsReview: Boolean(first.needsReview),
      reason: first.reason,
      clarifications,
      qualityIssues,
      llmCalls,
      promptChars,
      model,
      repairAttempts,
      budgetTrimSteps,
      estimatedTokens: lastEstimatedTokens,
      inputSnapshotId: input.inputSnapshotId || null,
    };
  }

  const tasks = [...(first.tasks || [])];
  if (first.clarifications?.length) clarifications.push(...first.clarifications);
  if (first.issues?.length) qualityIssues.push(...first.issues);
  const isolatedFrIds = [];
  const covered = coveredFrIds(tasks);
  const missing = frUnits.filter((unit) => unit?.id && !covered.has(unit.id));
  if (missing.length && !wallExceeded()) {
    const one = await runSlice(missing, `${idPrefix}f`);
    if (one.ok) tasks.push(...one.tasks);
    else if (one.tasks?.length) tasks.push(...one.tasks);
    if (one.clarifications?.length) clarifications.push(...one.clarifications);
    if (one.issues?.length) qualityIssues.push(...one.issues);
    const now = coveredFrIds(tasks);
    for (const unit of missing) {
      if (now.has(unit.id)) continue;
      isolatedFrIds.push(unit.id);
    }
  }

  const needsReview =
    Boolean(first.needsReview) ||
    clarifications.length > 0 ||
    qualityIssues.length > 0 ||
    isolatedFrIds.length > 0;

  return {
    ok: !needsReview || tasks.length > 0,
    needsReview,
    tasks,
    isolatedFrIds,
    clarifications,
    qualityIssues,
    llmCalls,
    promptChars,
    model,
    repairAttempts,
    budgetTrimSteps,
    estimatedTokens: lastEstimatedTokens,
    inputSnapshotId: input.inputSnapshotId || null,
  };
}

module.exports = { executeWbsChunk };
