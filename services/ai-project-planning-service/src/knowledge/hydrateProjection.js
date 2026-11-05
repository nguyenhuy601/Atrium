/**
 * Whitelist hydrate payload by phase projection (RULE-FS-05).
 * Default / unknown → full (backward compatible).
 */

const HOW_OMIT_SNAPSHOT_KEYS = new Set([
  'rawWorkbook',
  'workbookBuffers',
]);

/**
 * @param {'what'|'how'|'full'|string|null|undefined} projection
 */
function normalizeProjection(projection) {
  const p = String(projection || '').trim().toLowerCase();
  if (p === 'what' || p === 'how') return p;
  return 'full';
}

function slimIntakeCorpus(corpus) {
  if (!corpus || typeof corpus !== 'object') return corpus;
  return {
    schemaVersion: corpus.schemaVersion,
    totalChars: corpus.totalChars,
    builtAt: corpus.builtAt,
    durationMs: corpus.durationMs,
    skipped: corpus.skipped,
    // Drop large excerpts text for HOW; keep count signal.
    excerptCount: Array.isArray(corpus.excerpts) ? corpus.excerpts.length : 0,
  };
}

function slimPackForHow(pack) {
  if (!pack || typeof pack !== 'object') return pack;
  const next = { ...pack };
  if (next.aiAnalysis && typeof next.aiAnalysis === 'object') {
    const ai = { ...next.aiAnalysis };
    if (ai.intakeCorpus) ai.intakeCorpus = slimIntakeCorpus(ai.intakeCorpus);
    // requirementTools / skill stubs not needed for HOW tools critical path
    delete ai.analyses?.requirementTools;
    next.aiAnalysis = ai;
  }
  return next;
}

function slimSnapshotForHow(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return snapshot;
  const next = { ...snapshot };
  for (const key of HOW_OMIT_SNAPSHOT_KEYS) {
    delete next[key];
  }
  if (next.aiAnalysis && typeof next.aiAnalysis === 'object') {
    const ai = { ...next.aiAnalysis };
    if (ai.intakeCorpus) ai.intakeCorpus = slimIntakeCorpus(ai.intakeCorpus);
    next.aiAnalysis = ai;
  }
  return next;
}

function slimPackForWhat(pack) {
  if (!pack || typeof pack !== 'object') return pack;
  const next = { ...pack };
  // Drop HOW-only staffing history blobs if present at top-level.
  if (next.employeeHistoryFull) delete next.employeeHistoryFull;
  if (next.taskHistoryFull) delete next.taskHistoryFull;
  return next;
}

/**
 * @param {{ snapshot?: object, pack?: object } & object} data
 * @param {string} [projection]
 */
function applyHydrateProjection(data, projection) {
  if (!data || typeof data !== 'object') return data;
  const proj = normalizeProjection(projection);
  if (proj === 'full') {
    return { ...data, projection: 'full' };
  }
  if (proj === 'how') {
    return {
      ...data,
      projection: 'how',
      snapshot: slimSnapshotForHow(data.snapshot),
      pack: slimPackForHow(data.pack),
    };
  }
  // what
  return {
    ...data,
    projection: 'what',
    snapshot: data.snapshot,
    pack: slimPackForWhat(data.pack),
  };
}

module.exports = {
  normalizeProjection,
  applyHydrateProjection,
  slimIntakeCorpus,
};
