/**
 * Slim S2S hydrate payload by projection (Fast Start RULE-FS-05).
 * Mirror of APS hydrateProjection — keep in sync for wire size.
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
    excerptCount: Array.isArray(corpus.excerpts) ? corpus.excerpts.length : 0,
  };
}

function slimPackForHow(pack) {
  if (!pack || typeof pack !== 'object') return pack;
  const next = { ...pack };
  if (next.aiAnalysis && typeof next.aiAnalysis === 'object') {
    const ai = { ...next.aiAnalysis };
    if (ai.intakeCorpus) ai.intakeCorpus = slimIntakeCorpus(ai.intakeCorpus);
    if (ai.analyses && typeof ai.analyses === 'object') {
      ai.analyses = { ...ai.analyses };
      delete ai.analyses.requirementTools;
    }
    next.aiAnalysis = ai;
  }
  return next;
}

function slimSnapshotForHow(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return snapshot;
  const next = { ...snapshot };
  delete next.rawWorkbook;
  delete next.workbookBuffers;
  if (next.aiAnalysis && typeof next.aiAnalysis === 'object') {
    const ai = { ...next.aiAnalysis };
    if (ai.intakeCorpus) ai.intakeCorpus = slimIntakeCorpus(ai.intakeCorpus);
    next.aiAnalysis = ai;
  }
  return next;
}

function applyHydrateProjection(data, projection) {
  if (!data || typeof data !== 'object') return data;
  const proj = normalizeProjection(projection);
  if (proj === 'full') return { ...data, projection: 'full' };
  if (proj === 'how') {
    return {
      ...data,
      projection: 'how',
      snapshot: slimSnapshotForHow(data.snapshot),
      pack: slimPackForHow(data.pack),
    };
  }
  const pack = data.pack && typeof data.pack === 'object' ? { ...data.pack } : data.pack;
  if (pack) {
    delete pack.employeeHistoryFull;
    delete pack.taskHistoryFull;
  }
  return { ...data, projection: 'what', pack };
}

module.exports = {
  normalizeProjection,
  applyHydrateProjection,
};
