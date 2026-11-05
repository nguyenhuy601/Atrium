/**
 * WHAT latency instrumentation — measure-only helper (no behavior change).
 * Log line: [what_timing] { round, stages, totalMs, sumStages, sumWorkerMs, ... }
 *
 * sumStages ≈ exclusive orchestration slices (hydrate+prepare+selectTools+meta+…).
 * sumWorkerMs = Σ tool wall (may exceed totalMs when workers ran in parallel).
 */

function emptyStages() {
  return {
    hydrate: null,
    prepareWhat: null,
    selectTools: null,
    /** @deprecated alias — legacy timing payloads */
    understand: null,
    // Stage timing keys kept for progress mappers (FR pipeline meta.stageTimings)
    fr_semantic: null,
    fr_conflict: null,
    fr_synthesis: null,
    fr_total: null,
    bg_derive: null,
    /** Nested wall inside bg_derive (FR LLM decompose); excluded from sumStages. */
    fr_decompose: null,
    /** Nested wall inside bg_derive (section LLM derives); excluded from sumStages. */
    raw_section_derive: null,
    /** Aggregate section/peer tool ms (from toolExecutions SoT). */
    tools: null,
    engines: null,
    meta: null,
  };
}

/** Stages that are exclusive wall slices (avoid double-count nested FR sub-stages / tools). */
const SUM_STAGE_KEYS = Object.freeze([
  'hydrate',
  'prepareWhat',
  'selectTools',
  'fr_total',
  'meta',
]);

/**
 * @param {{ round?: number|string, packId?: string, snapshotId?: string, runId?: string }} [meta]
 */
function createWhatTiming(meta = {}) {
  return {
    round: meta.round != null ? meta.round : 0,
    packId: meta.packId || null,
    snapshotId: meta.snapshotId || null,
    runId: meta.runId || null,
    wallStartedAt: Date.now(),
    stages: emptyStages(),
  };
}

/**
 * @param {object} timing
 * @param {string} stage
 * @param {number|object} msOrDetail — ms number or { ms, ...extra }
 */
function markStage(timing, stage, msOrDetail) {
  if (!timing || typeof timing !== 'object') return timing;
  const stages = timing.stages && typeof timing.stages === 'object'
    ? { ...timing.stages }
    : emptyStages();
  if (msOrDetail != null && typeof msOrDetail === 'object' && !Array.isArray(msOrDetail)) {
    const ms = Number(msOrDetail.ms);
    stages[stage] = {
      ...msOrDetail,
      ms: Number.isFinite(ms) ? Math.max(0, Math.round(ms)) : null,
    };
  } else {
    const ms = Number(msOrDetail);
    stages[stage] = {
      ms: Number.isFinite(ms) ? Math.max(0, Math.round(ms)) : null,
    };
  }
  return { ...timing, stages };
}

function mergeStageDetail(timing, stage, detail) {
  if (!timing || typeof timing !== 'object') return timing;
  const prev = timing.stages?.[stage] && typeof timing.stages[stage] === 'object'
    ? timing.stages[stage]
    : {};
  return markStage(timing, stage, { ...prev, ...(detail || {}) });
}

/** Add ms/llmCalls into an existing stage (multi selectTools visits). */
function accumulateStage(timing, stage, detail = {}) {
  const prev = timing?.stages?.[stage] && typeof timing.stages[stage] === 'object'
    ? timing.stages[stage]
    : {};
  const addMs = Number(detail.ms);
  const prevMs = Number(prev.ms);
  const ms =
    (Number.isFinite(prevMs) ? prevMs : 0) + (Number.isFinite(addMs) ? addMs : 0);
  const addCalls = Number(detail.llmCalls);
  const prevCalls = Number(prev.llmCalls);
  const llmCalls =
    (Number.isFinite(prevCalls) ? prevCalls : 0) +
    (Number.isFinite(addCalls) ? addCalls : 0);
  const addTokens = Number(detail.tokens);
  const prevTokens = Number(prev.tokens);
  const tokens =
    (Number.isFinite(prevTokens) ? prevTokens : 0) +
    (Number.isFinite(addTokens) ? addTokens : 0);
  return markStage(timing, stage, {
    ...prev,
    ...detail,
    ms,
    llmCalls: llmCalls || undefined,
    tokens: tokens || undefined,
  });
}

function sumStageMs(stages = {}) {
  let sum = 0;
  for (const key of SUM_STAGE_KEYS) {
    const ms = Number(stages?.[key]?.ms);
    if (Number.isFinite(ms)) sum += ms;
  }
  return sum;
}

/**
 * Prefer toolExecutions duration (SoT); do not also add toolResults for same tool.
 * @param {object} state
 * @returns {{ byTool: Record<string, number>, sumWorkerMs: number, frMs: number|null }}
 */
function collectToolWallMs(state) {
  const byTool = {};
  const executions = Array.isArray(state?.toolExecutions) ? state.toolExecutions : [];
  const fromExec = new Set();
  for (const row of executions) {
    const name = String(row?.toolName || '').trim();
    if (!name) continue;
    let ms = Number(row.durationMs);
    if (!Number.isFinite(ms) && row.startedAt && row.completedAt) {
      ms = Math.max(0, Date.parse(row.completedAt) - Date.parse(row.startedAt));
    }
    if (!Number.isFinite(ms)) continue;
    fromExec.add(name);
    byTool[name] = Math.max(byTool[name] || 0, Math.round(ms));
  }
  for (const row of Array.isArray(state?.toolResults) ? state.toolResults : []) {
    const name = String(row?.toolName || '').trim();
    if (!name || fromExec.has(name)) continue;
    const ms = Number(row.durationMs);
    if (!Number.isFinite(ms)) continue;
    byTool[name] = Math.max(byTool[name] || 0, Math.round(ms));
  }
  let sumWorkerMs = 0;
  for (const ms of Object.values(byTool)) sumWorkerMs += ms;
  const frMs = byTool.WhatFrTool != null ? byTool.WhatFrTool : null;
  return { byTool, sumWorkerMs, frMs };
}

/**
 * Fold tool walls into timing stages (single source; no double-count with results).
 * @param {object} timing
 * @param {object} state
 */
function foldToolDurationsIntoTiming(timing, state) {
  let t = timing && typeof timing === 'object' ? timing : createWhatTiming();
  const { byTool, sumWorkerMs, frMs } = collectToolWallMs(state);
  if (frMs != null) {
    t = markStage(t, 'fr_total', { ms: frMs, source: 'toolExecutions' });
  }
  const sectionMs = Object.entries(byTool)
    .filter(([name]) => name !== 'WhatFrTool')
    .reduce((acc, [, ms]) => acc + ms, 0);
  if (sectionMs > 0 || Object.keys(byTool).length) {
    t = markStage(t, 'tools', {
      ms: sectionMs,
      byTool,
      sumWorkerMs,
      source: 'toolExecutions_prefer',
    });
  }
  return { ...t, sumWorkerMs };
}

/**
 * @param {object} timing
 * @param {{ totalMs?: number, state?: object }} [opts]
 */
function finalizeWhatTiming(timing, opts = {}) {
  let t = timing && typeof timing === 'object' ? timing : createWhatTiming();
  if (opts.state) {
    t = foldToolDurationsIntoTiming(t, opts.state);
  }
  const wall = opts.totalMs != null
    ? Math.max(0, Math.round(Number(opts.totalMs)))
    : Math.max(0, Date.now() - (t.wallStartedAt || Date.now()));
  const sumStages = sumStageMs(t.stages);
  const sumWorkerMs =
    t.sumWorkerMs != null
      ? t.sumWorkerMs
      : Number(t.stages?.tools?.sumWorkerMs) || 0;
  return {
    ...t,
    totalMs: wall,
    sumStages,
    sumWorkerMs,
    note:
      'sumWorkerMs may exceed totalMs when tools ran in parallel; sumStages excludes nested tool walls',
  };
}

function logWhatTiming(timing, opts = {}) {
  const final = finalizeWhatTiming(timing, opts);
  // eslint-disable-next-line no-console
  console.info('[what_timing] %s', JSON.stringify(final));
  return final;
}

function startSpan() {
  const t0 = Date.now();
  return () => Math.max(0, Date.now() - t0);
}

function logWhatCtx(tag, contextPackage, itemCount) {
  const mode =
    contextPackage?.mode != null
      ? String(contextPackage.mode)
      : contextPackage?.modeUsed != null
        ? String(contextPackage.modeUsed)
        : '-';
  console.info(`[what-ctx] tag=${tag} mode=${mode} items=${itemCount}`);
}

module.exports = {
  emptyStages,
  SUM_STAGE_KEYS,
  createWhatTiming,
  markStage,
  mergeStageDetail,
  accumulateStage,
  sumStageMs,
  collectToolWallMs,
  foldToolDurationsIntoTiming,
  finalizeWhatTiming,
  logWhatTiming,
  startSpan,
  logWhatCtx,
};
