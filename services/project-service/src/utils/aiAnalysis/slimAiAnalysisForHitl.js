/**
 * Shrink aiAnalysis for GET ?view=hitl — truncate known bulky arrays in-place
 * (always keep Array shape so FE for...of / .map never see {_truncated, sample}).
 */

const MAX_ID_SAMPLE = 24;
const MAX_EDGE_SAMPLE = 40;
const MAX_NODE_SAMPLE = 40;

/** Only these keys are truncated — other arrays pass through unchanged. */
const HEAVY_ARRAY_KEYS = new Set([
  'analyzedTaskIds',
  'taskIds',
  'allowTaskIds',
  'nodes',
  'edges',
  'traceLinks',
  'orphans',
  'openQuestions',
  'clarifications',
  'deltas',
  'rows',
  // Note: do NOT truncate `items` / `proposals` / `epics` — Gate1/Gate2 iterate them.
]);

function maxForKey(key) {
  if (key === 'edges') return MAX_EDGE_SAMPLE;
  if (key === 'nodes' || key === 'rows') return MAX_NODE_SAMPLE;
  return MAX_ID_SAMPLE;
}

function slimHeavyObject(value, depth = 0) {
  if (value == null || typeof value !== 'object' || depth > 8) return value;
  if (Array.isArray(value)) {
    // Never rewrite anonymous arrays to objects — callers expect iterables.
    return value.map((row) => slimHeavyObject(row, depth + 1));
  }

  const out = {};
  for (const [k, v] of Object.entries(value)) {
    if (HEAVY_ARRAY_KEYS.has(k) && Array.isArray(v)) {
      const max = maxForKey(k);
      if (v.length > max) {
        out[`${k}Count`] = v.length;
        out[`${k}Truncated`] = true;
        out[k] = v.slice(0, max).map((row) => slimHeavyObject(row, depth + 1));
      } else {
        out[k] = v.map((row) => slimHeavyObject(row, depth + 1));
      }
      continue;
    }
    out[k] = slimHeavyObject(v, depth + 1);
  }
  return out;
}

/**
 * @param {object|null|undefined} aiAnalysis
 * @returns {object|null|undefined}
 */
function slimAiAnalysisForHitl(aiAnalysis) {
  if (!aiAnalysis || typeof aiAnalysis !== 'object') return aiAnalysis;
  return slimHeavyObject(aiAnalysis);
}

module.exports = {
  slimAiAnalysisForHitl,
  MAX_ID_SAMPLE,
  HEAVY_ARRAY_KEYS,
};
