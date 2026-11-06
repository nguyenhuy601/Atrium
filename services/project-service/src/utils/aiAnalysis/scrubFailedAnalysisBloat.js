/**
 * Persist-safe cleanup: strip ID/node dumps from FAILED AI tool results so the
 * RequirementPack.aiAnalysis Mixed document stops swelling.
 * Does not truncate successful HOW graphs.
 */

const FAIL_RE = /fail|error|cancelled/i;
const BLOAT_KEYS = [
  'analyzedTaskIds',
  'taskIds',
  'allowTaskIds',
  'nodes',
  'orphans',
  'traceLinks',
];

function isFailedStatus(status) {
  return FAIL_RE.test(String(status || ''));
}

function scrubObject(node, stats) {
  if (!node || typeof node !== 'object') return node;
  if (Array.isArray(node)) {
    return node.map((item) => scrubObject(item, stats));
  }

  const failed = isFailedStatus(node.status) || isFailedStatus(node.analysisStatus);
  const out = {};
  for (const [key, value] of Object.entries(node)) {
    if (failed && BLOAT_KEYS.includes(key) && Array.isArray(value) && value.length > 0) {
      out[`${key}Count`] = value.length;
      out[key] = [];
      stats.cleared += 1;
      stats.idsDropped += value.length;
      continue;
    }
    out[key] = scrubObject(value, stats);
  }
  return out;
}

/**
 * @param {object|null|undefined} aiAnalysis
 * @returns {{ value: object|null|undefined, changed: boolean, cleared: number, idsDropped: number }}
 */
function scrubFailedAnalysisBloat(aiAnalysis) {
  if (!aiAnalysis || typeof aiAnalysis !== 'object') {
    return { value: aiAnalysis, changed: false, cleared: 0, idsDropped: 0 };
  }
  const stats = { cleared: 0, idsDropped: 0 };
  const value = scrubObject(aiAnalysis, stats);
  return {
    value,
    changed: stats.cleared > 0,
    cleared: stats.cleared,
    idsDropped: stats.idsDropped,
  };
}

module.exports = {
  scrubFailedAnalysisBloat,
  isFailedStatus,
};
