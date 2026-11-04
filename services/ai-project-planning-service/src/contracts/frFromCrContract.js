/**
 * Phase WHAT — propose analyzed FR-* from Customer Raw CR intake.
 * Flag: WHAT_FR_FROM_CR (default on). Customer Raw path only.
 */

const { QWEN_PLUS_MAX_OUTPUT_TOKENS } = require('@enterprise/shared/llm/openaiCompatibleClient');
const { modelOutputCeiling } = require('../runtime/modelOutputBudget');

/**
 * Completion budget for one FR node inside a chunk (name, AC, sourceCrIds, parentEpicId).
 * Sized for latency — do not expand a chunk up to the model ceiling (32768).
 */
const FR_FROM_CR_TOKENS_PER_FR = 280;
/** epics[] / features[] wrapper outside the FR nodes. */
const FR_FROM_CR_OUTPUT_ENVELOPE = 700;

/** FR + epic catalog in one LLM response; fail-closed without epics/parentEpicId. */
const FR_FROM_CR_SHAPE_VERSION = 'fr-from-cr-v2';
/** Intake cap. Chunking (not one giant call) carries 100+ CR. */
const FR_FROM_CR_MAX_CR = 240;
/** CRs per LLM call. 12 stays inside ~120s; 80-in-one timed out at 180s. */
const FR_FROM_CR_CHUNK = 12;
/** One wave for a 65 CR pack (6 chunks). A second wave added ~45s of wall time. */
const FR_FROM_CR_CONCURRENCY = 6;
const FR_FROM_CR_DEFAULT_TIMEOUT_MS = 120000;

function isWhatFrFromCrFlagOn(env = process.env) {
  const raw = env.WHAT_FR_FROM_CR;
  if (raw === undefined || raw === null || String(raw).trim() === '') return true;
  const s = String(raw).trim().toLowerCase();
  if (['0', 'false', 'off', 'no'].includes(s)) return false;
  return true;
}

function clampInt(raw, fallback, { min, max }) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function resolveFrFromCrChunk(env = process.env) {
  // Cap at 24 so an old WHAT_FR_FROM_CR_CHUNK=80 cannot recreate the one-shot timeout.
  return clampInt(env.WHAT_FR_FROM_CR_CHUNK, FR_FROM_CR_CHUNK, { min: 1, max: 24 });
}

function resolveFrFromCrConcurrency(env = process.env) {
  return clampInt(env.WHAT_FR_FROM_CR_CONCURRENCY, FR_FROM_CR_CONCURRENCY, { min: 1, max: 8 });
}

function resolveFrFromCrMaxCr(env = process.env) {
  return clampInt(env.WHAT_FR_FROM_CR_MAX_CR, FR_FROM_CR_MAX_CR, { min: 1, max: 400 });
}

function resolveFrFromCrNumCtx(env = process.env) {
  const n = Number(env.WHAT_FR_FROM_CR_NUM_CTX);
  if (!Number.isFinite(n)) return undefined;
  return clampInt(n, n, { min: 1024, max: 131072 });
}

function resolveFrFromCrTimeoutMs(env = process.env) {
  return clampInt(env.WHAT_FR_FROM_CR_TIMEOUT_MS, FR_FROM_CR_DEFAULT_TIMEOUT_MS, {
    min: 15000,
    max: 180000,
  });
}

/**
 * Completion tokens for one chunk. Default follows row count (~4k for 12 CR),
 * not the 32768 model ceiling. Explicit WHAT_FR_FROM_CR_NUM_PREDICT still wins.
 * @param {number} rowCount
 * @param {NodeJS.ProcessEnv} [env]
 */
function resolveFrFromCrNumPredictForChunk(rowCount, env = process.env) {
  const ceiling = Math.min(QWEN_PLUS_MAX_OUTPUT_TOKENS, modelOutputCeiling(env));
  const rows = Math.max(1, Math.round(Number(rowCount) || 1));
  const sized = FR_FROM_CR_OUTPUT_ENVELOPE + rows * FR_FROM_CR_TOKENS_PER_FR;
  const explicit = env.WHAT_FR_FROM_CR_NUM_PREDICT;
  if (explicit !== undefined && explicit !== null && String(explicit).trim() !== '') {
    return clampInt(explicit, sized, { min: 256, max: ceiling });
  }
  return clampInt(sized, sized, { min: 256, max: ceiling });
}

/** @deprecated Use resolveFrFromCrNumPredictForChunk(rowCount, env). */
function resolveFrFromCrNumPredict(env = process.env) {
  return resolveFrFromCrNumPredictForChunk(FR_FROM_CR_CHUNK, env);
}

module.exports = {
  FR_FROM_CR_SHAPE_VERSION,
  isWhatFrFromCrFlagOn,
  FR_FROM_CR_CHUNK,
  FR_FROM_CR_CONCURRENCY,
  resolveFrFromCrChunk,
  resolveFrFromCrConcurrency,
  resolveFrFromCrMaxCr,
  resolveFrFromCrNumCtx,
  resolveFrFromCrTimeoutMs,
  resolveFrFromCrNumPredict,
  resolveFrFromCrNumPredictForChunk,
};
