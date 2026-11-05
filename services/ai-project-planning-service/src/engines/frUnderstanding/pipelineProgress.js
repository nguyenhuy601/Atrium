/**
 * WHAT progress catalog and the slim data-gate preview.
 * Substep ids align with historical WHAT macro steps (Monitor / HITL).
 */

const FLAGGED_CAP = 30;
const ROW_CAP = 200;
const PAGE_LIMIT_MAX = 20;
const CELL_LIST_CAP = 8;

const SUBSTEPS = {
  prepare: { step: 1, substep: 'prepare' },
  parse: { step: 2, substep: 'parse' },
  normalize: { step: 2, substep: 'normalize' },
  extract: { step: 2, substep: 'extract' },
  filter: { step: 2, substep: 'filter' },
  quality: { step: 2, substep: 'quality' },
  /** Legacy only — not emitted as HITL (RULE-R01) */
  gate_preview: { step: 2, substep: 'quality' },
  context_fetch: { step: 3, substep: 'context_fetch' },
  assemble_context: { step: 3, substep: 'assemble_context' },
  semantic: { step: 3, substep: 'semantic' },
  conflict: { step: 3, substep: 'conflict' },
  agent_understand: { step: 4, substep: 'agent_understand' },
  plan: { step: 4, substep: 'plan' },
  validate: { step: 4, substep: 'validate' },
  synthesis: { step: 4, substep: 'synthesis' },
  evidence: { step: 4, substep: 'evidence' },
  /** Analysis proposal generation (LLM derive) — before metaGate */
  derive: { step: 4, substep: 'derive' },
  observe: { step: 4, substep: 'observe' },
  evaluate_local: { step: 4, substep: 'evaluate_local' },
  meta_gate: { step: 4, substep: 'meta_gate' },
  /** Internal emit only — UI step 4 ends at meta_gate */
  feasibility: { step: 4, substep: 'meta_gate' },
};

const FLAG_KEYS = {
  missing_actor: 'missingActor',
  missing_outcome: 'missingOutcome',
  missing_ac: 'missingAc',
  thin_text: 'thinText',
  ambiguous: 'ambiguous',
  duplicate: 'duplicate',
  cross_module: 'crossModule',
};

function substepMeta(substep) {
  return SUBSTEPS[substep] || null;
}

function emptyQuality() {
  return {
    missingActor: 0,
    missingOutcome: 0,
    missingAc: 0,
    thinText: 0,
    ambiguous: 0,
    duplicate: 0,
    crossModule: 0,
    potentialConflict: 0,
    highImpact: 0,
  };
}

function nonEmptyText(v) {
  return String(v || '').trim().length > 0;
}

function frActorsList(fr, signal) {
  if (Array.isArray(signal?.actors) && signal.actors.length) {
    return signal.actors.map(String).filter((s) => s.trim());
  }
  if (Array.isArray(fr?.actors) && fr.actors.length) {
    return fr.actors.map(String).filter((s) => s.trim());
  }
  if (nonEmptyText(fr?.actor)) return [String(fr.actor).trim()];
  return [];
}

/** Soft H1-aligned flags: actor + behavior/outcome description (not AC). */
function deriveFrContentFlags(fr, signal) {
  const flags = [];
  if (!frActorsList(fr, signal).length) flags.push('missing_actor');
  const outcome =
    nonEmptyText(fr?.description) ||
    nonEmptyText(fr?.requirement) ||
    nonEmptyText(fr?.behavior) ||
    nonEmptyText(fr?.desc) ||
    (Array.isArray(signal?.actions) && signal.actions.some((a) => nonEmptyText(a)));
  if (!outcome) flags.push('missing_outcome');
  return flags;
}

function clipList(value) {
  return (Array.isArray(value) ? value : [])
    .slice(0, CELL_LIST_CAP)
    .map((item) => String(item));
}

function slimRow(row) {
  return {
    frId: String(row?.frId || ''),
    title: String(row?.title || '').slice(0, 160),
    description: String(row?.description || '').slice(0, 240),
    actors: clipList(row?.actors),
    actions: clipList(row?.actions),
    objects: clipList(row?.objects),
    fields: clipList(row?.fields),
    flags: Array.isArray(row?.flags) ? row.flags.map((flag) => String(flag)) : [],
    candidate: Boolean(row?.candidate),
  };
}

/**
 * Processed FR table + counts. Rows capped at 200. No corpus or raw signal text.
 * @param {{ functionalRequirements?: object[], signals?: object[], duplicates?: string[], selection?: object }} input
 */
function buildGatePreview(input = {}) {
  const functionalRequirements = Array.isArray(input.functionalRequirements)
    ? input.functionalRequirements
    : [];
  const signals = Array.isArray(input.signals) ? input.signals : [];
  const duplicates = Array.isArray(input.duplicates) ? input.duplicates : [];
  const selection = input.selection && typeof input.selection === 'object' ? input.selection : {};
  const quality = emptyQuality();
  const frById = new Map(
    functionalRequirements.map((fr) => [String(fr?.id || ''), fr])
  );
  const signalById = new Map(signals.map((signal) => [String(signal?.frId || ''), signal]));
  const candidateIds = new Set(
    (Array.isArray(selection.candidates) ? selection.candidates : []).map((row) =>
      String(row?.frId || '')
    )
  );
  const flagged = [];
  const mergedFlagsByFr = new Map();
  for (const signal of signals) {
    const frId = String(signal?.frId || '');
    const base = Array.isArray(signal?.flags) ? signal.flags.map(String) : [];
    const fr = frById.get(frId);
    const derived = fr ? deriveFrContentFlags(fr, signal) : [];
    const flags = [...new Set([...base, ...derived])];
    if (frId) mergedFlagsByFr.set(frId, flags);
    for (const flag of flags) {
      const key = FLAG_KEYS[flag];
      if (key) quality[key] += 1;
    }
    if (!flags.length || flagged.length >= FLAGGED_CAP) continue;
    const title = (fr && (fr.title || fr.name)) || '';
    flagged.push({
      frId,
      title: String(title).slice(0, 160),
      flags,
    });
  }
  // FRs with no signal row — still soft-warn actor / outcome
  for (const fr of functionalRequirements) {
    const frId = String(fr?.id || '');
    if (!frId || mergedFlagsByFr.has(frId)) continue;
    const flags = deriveFrContentFlags(fr, null);
    if (!flags.length) continue;
    mergedFlagsByFr.set(frId, flags);
    for (const flag of flags) {
      const key = FLAG_KEYS[flag];
      if (key) quality[key] += 1;
    }
    if (flagged.length < FLAGGED_CAP) {
      flagged.push({
        frId,
        title: String(fr?.title || fr?.name || '').slice(0, 160),
        flags,
      });
    }
  }
  const rows = functionalRequirements.slice(0, ROW_CAP).map((fr) => {
    const frId = String(fr?.id || '');
    const signal = signalById.get(frId) || {};
    const flags = mergedFlagsByFr.get(frId) || signal.flags || [];
    return slimRow({
      frId,
      title: fr?.title || fr?.name || '',
      description: fr?.description || fr?.requirement || '',
      actors: frActorsList(fr, signal),
      actions: signal.actions,
      objects: signal.objects,
      fields: signal.fields,
      flags,
      candidate: candidateIds.has(frId),
    });
  });
  const counts = selection.counts || {};
  const candidates = Array.isArray(selection.candidates) ? selection.candidates : [];
  const clear = Array.isArray(selection.clear) ? selection.clear : [];
  const byReason = counts.byReason && typeof counts.byReason === 'object' ? counts.byReason : {};
  const conflictsIn =
    selection.conflicts && typeof selection.conflicts === 'object' ? selection.conflicts : {};
  const pairCount = Number(conflictsIn.pairCount) || 0;
  const affectedFrCount = Number(conflictsIn.affectedFrCount) || 0;
  quality.potentialConflict = affectedFrCount;
  quality.highImpact = Number(byReason.high_impact) || 0;

  return {
    frCount: functionalRequirements.length,
    duplicateCount: duplicates.length,
    candidateCount: Number(counts.candidates) || candidates.length,
    skippedCount: Number(counts.clear) || clear.length,
    quality,
    byReason: {
      missing_actor: Number(byReason.missing_actor) || quality.missingActor || 0,
      missing_outcome: Number(byReason.missing_outcome) || quality.missingOutcome || 0,
      missing_ac: Number(byReason.missing_ac) || 0,
      potential_conflict: Number(byReason.potential_conflict) || affectedFrCount,
      high_impact: Number(byReason.high_impact) || 0,
      thin_text: Number(byReason.thin_text) || 0,
      ambiguous: Number(byReason.ambiguous) || 0,
      duplicate: Number(byReason.duplicate) || 0,
      cross_module: Number(byReason.cross_module) || 0,
    },
    conflicts: {
      pairCount,
      affectedFrCount,
    },
    flagged,
    rowTotal: rows.length,
    rows,
  };
}

function summaryGatePreview(raw) {
  const qualityIn = raw.quality && typeof raw.quality === 'object' ? raw.quality : {};
  const quality = emptyQuality();
  for (const key of Object.keys(quality)) {
    quality[key] = Number(qualityIn[key]) || 0;
  }
  const flaggedIn = Array.isArray(raw.flagged) ? raw.flagged : [];
  const storedRows = Array.isArray(raw.rows) ? raw.rows : [];
  const rowTotal = Number.isFinite(Number(raw.rowTotal)) ? Number(raw.rowTotal) : storedRows.length;
  return {
    frCount: Number(raw.frCount) || 0,
    duplicateCount: Number(raw.duplicateCount) || 0,
    candidateCount: Number(raw.candidateCount) || 0,
    skippedCount: Number(raw.skippedCount) || 0,
    quality,
    byReason:
      raw.byReason && typeof raw.byReason === 'object'
        ? raw.byReason
        : {},
    conflicts: {
      pairCount: Number(raw.conflicts?.pairCount) || 0,
      affectedFrCount: Number(raw.conflicts?.affectedFrCount) || 0,
    },
    flagged: flaggedIn.slice(0, FLAGGED_CAP).map((row) => ({
      frId: String(row?.frId || ''),
      title: String(row?.title || '').slice(0, 160),
      flags: Array.isArray(row?.flags) ? row.flags.map((flag) => String(flag)) : [],
    })),
    rowTotal,
  };
}

/**
 * Default publish omits rows. Pass { offset, limit } to return one page (max 20).
 * @param {object|null} raw
 * @param {{ offset?: number|string, limit?: number|string }|null} [page]
 */
function publishGatePreview(raw, page) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const summary = summaryGatePreview(raw);
  const wantsPage = page && page.offset != null && page.offset !== '';
  if (!wantsPage) return summary;
  const storedRows = Array.isArray(raw.rows) ? raw.rows : [];
  const offset = Math.max(0, Number(page.offset) || 0);
  const limit = Math.min(
    PAGE_LIMIT_MAX,
    Math.max(1, Number(page.limit) || PAGE_LIMIT_MAX)
  );
  return {
    ...summary,
    rows: storedRows.slice(offset, offset + limit).map(slimRow),
  };
}

module.exports = {
  FLAGGED_CAP,
  ROW_CAP,
  PAGE_LIMIT_MAX,
  SUBSTEPS,
  substepMeta,
  buildGatePreview,
  publishGatePreview,
};
