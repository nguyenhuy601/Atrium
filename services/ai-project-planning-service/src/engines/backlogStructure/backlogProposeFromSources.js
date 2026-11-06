/**
 * Propose Epic/Feature/Story candidates from LLM epic catalog + FR rows (tempIds).
 * No heuristic “one epic for all” dual path — fail-closed when catalog/parentEpicId missing.
 */

const { CLASSIFICATION_TYPES } = require('./constants');

function normalizeRef(raw) {
  return String(raw || '').trim();
}

function frIdOf(fr) {
  return normalizeRef(fr?.id || fr?.logicalId || fr?.frId);
}

function acRefsForFr(fr) {
  const frId = frIdOf(fr);
  if (!frId) return [];
  const ac = fr.ac || fr.acceptanceCriteria || '';
  const parts = Array.isArray(ac)
    ? ac
    : String(ac || '')
        .split(/\n|;/)
        .map((s) => s.trim())
        .filter(Boolean);
  if (!parts.length) return [`${frId}:AC-1`];
  return parts.map((_, j) => `${frId}:AC-${j + 1}`);
}

/**
 * Build candidate proposal 1:1 from epicsCatalog + FR parentEpicId (LLM SoT).
 * @returns {{ ok: true, epics, features, stories, llmCoverageProposals } | { ok: false, code: string, message: string }}
 */
function materializeCandidatesFromEpicCatalog(opts = {}) {
  const frRows = Array.isArray(opts.frRows) ? opts.frRows : [];
  const catalogIn = Array.isArray(opts.epicsCatalog) ? opts.epicsCatalog : [];

  /** @type {Map<string, { id: string, name: string, sourceFrIds: string[] }>} */
  const epicById = new Map();
  for (const row of catalogIn) {
    const id = normalizeRef(row?.id || row?.epicId);
    if (!id) continue;
    if (!epicById.has(id)) {
      epicById.set(id, {
        id,
        name: normalizeRef(row.name || row.title) || id,
        sourceFrIds: [],
      });
    }
  }

  // Fill catalog from FR parentEpicId when catalog rows incomplete / empty.
  for (const fr of frRows) {
    const frId = frIdOf(fr);
    if (!frId) continue;
    const pid =
      fr.parentEpicId === undefined || fr.parentEpicId === null || fr.parentEpicId === ''
        ? null
        : normalizeRef(fr.parentEpicId);
    if (!pid) continue;
    if (!epicById.has(pid)) {
      epicById.set(pid, { id: pid, name: pid, sourceFrIds: [] });
    }
    const epic = epicById.get(pid);
    if (!epic.sourceFrIds.includes(frId)) epic.sourceFrIds.push(frId);
  }

  // Attach catalog.sourceFrIds when provided.
  for (const row of catalogIn) {
    const id = normalizeRef(row?.id || row?.epicId);
    if (!id || !epicById.has(id)) continue;
    const epic = epicById.get(id);
    for (const frId of Array.isArray(row.sourceFrIds) ? row.sourceFrIds : []) {
      const n = normalizeRef(frId);
      if (n && !epic.sourceFrIds.includes(n)) epic.sourceFrIds.push(n);
    }
  }

  if (!epicById.size) {
    return {
      ok: false,
      code: 'missing_epics_catalog',
      message:
        'No epicsCatalog / parentEpicId — refuse heuristic one-epic-for-all. Re-run FR→Epic LLM.',
    };
  }

  const frWithEpic = frRows.filter((fr) => {
    const pid =
      fr.parentEpicId === undefined || fr.parentEpicId === null || fr.parentEpicId === ''
        ? null
        : normalizeRef(fr.parentEpicId);
    return Boolean(pid && epicById.has(pid));
  });
  if (!frWithEpic.length) {
    return {
      ok: false,
      code: 'missing_parent_epic_on_fr',
      message: 'FR rows lack parentEpicId linking to epics catalog — refuse one-epic fallback.',
    };
  }

  const epics = [];
  const epicTempById = new Map();
  for (const epic of epicById.values()) {
    const tempId = `tmp-epic-${epic.id}`;
    epicTempById.set(epic.id, tempId);
    const caps = [
      ...new Set(
        frWithEpic
          .filter((fr) => normalizeRef(fr.parentEpicId) === epic.id)
          .map((fr) => normalizeRef(fr.feature || fr.module || fr.capability || epic.name))
          .filter(Boolean)
      ),
    ];
    epics.push({
      tempId,
      title: epic.name,
      sourceFrIds: epic.sourceFrIds.length
        ? epic.sourceFrIds
        : frWithEpic
            .filter((fr) => normalizeRef(fr.parentEpicId) === epic.id)
            .map(frIdOf)
            .filter(Boolean),
      classificationDecision: {
        type: CLASSIFICATION_TYPES.EPIC,
        summary: `Business goal grouping for ${epic.name}`,
        capabilities: caps.length ? caps : [epic.name],
        evidenceRefs: [`EV-${epic.id}`],
      },
      /** Prefer catalog id after pipeline mint (see applyEpicCatalogIds). */
      catalogEpicId: epic.id,
    });
  }

  /** Feature groups: same parentEpicId + parentFeatureId (or capability when ≥2 FR). */
  const features = [];
  const featureTempByKey = new Map();
  const byEpicCapability = new Map();
  for (const fr of frWithEpic) {
    const frId = frIdOf(fr);
    const epicId = normalizeRef(fr.parentEpicId);
    const featureId = normalizeRef(fr.parentFeatureId);
    const cap = featureId || normalizeRef(fr.feature || fr.module || fr.capability) || '';
    if (!cap) continue;
    const key = `${epicId}::${cap}`;
    if (!byEpicCapability.has(key)) byEpicCapability.set(key, []);
    byEpicCapability.get(key).push({ fr, frId, epicId, featureId, cap });
  }

  let fi = 0;
  for (const [key, rows] of byEpicCapability.entries()) {
    if (rows.length < 2 && !rows[0]?.featureId) continue;
    fi += 1;
    const tempId = `tmp-feature-${fi}`;
    featureTempByKey.set(key, tempId);
    const epicId = rows[0].epicId;
    const title = rows[0].featureId
      ? `Feature ${rows[0].featureId}`
      : `Capability: ${rows[0].cap}`;
    features.push({
      tempId,
      title,
      parentEpicTempId: epicTempById.get(epicId) || null,
      sourceFrIds: rows.map((r) => r.frId),
      classificationDecision: {
        type: CLASSIFICATION_TYPES.FEATURE,
        summary: `Capability boundary under ${epicId}`,
        valueSlices: rows.map((r) => r.fr.name || r.fr.title || r.frId),
        evidenceRefs: [`EV-F-${fi}`],
      },
    });
  }

  const stories = [];
  let si = 0;
  for (const fr of frWithEpic) {
    si += 1;
    const frId = frIdOf(fr);
    const epicId = normalizeRef(fr.parentEpicId);
    const featureId = normalizeRef(fr.parentFeatureId);
    const cap = featureId || normalizeRef(fr.feature || fr.module || fr.capability) || '';
    const featureKey = cap ? `${epicId}::${cap}` : '';
    const parentFeatureTempId = featureKey ? featureTempByKey.get(featureKey) || null : null;
    const title = normalizeRef(fr.name || fr.title || frId) || frId;
    stories.push({
      tempId: `tmp-story-${si}`,
      title,
      parentFeatureTempId,
      parentEpicTempId: parentFeatureTempId ? null : epicTempById.get(epicId) || null,
      sourceFrIds: [frId],
      acRefs: acRefsForFr(fr),
      classificationDecision: {
        type: CLASSIFICATION_TYPES.STORY,
        summary: `Verifiable slice for ${title}`,
        beneficiary: Array.isArray(fr.actors) ? fr.actors[0] : fr.actor || 'user',
        behavior: title,
        evidenceRefs: [`EV-${frId}`],
      },
    });
  }

  const llmCoverageProposals = { coverageByFrId: {}, coverageByAcRef: {} };
  for (const fr of frWithEpic) {
    const frId = frIdOf(fr);
    if (!frId) continue;
    llmCoverageProposals.coverageByFrId[frId] = {
      status: 'PARTIALLY_COVERED',
      evidenceRefs: [`EV-${frId}`],
      summary: 'Catalog-materialized coverage proposal',
    };
  }

  return {
    ok: true,
    epics,
    features,
    stories,
    llmCoverageProposals,
  };
}

/**
 * @deprecated Heuristic dual path removed — use materializeCandidatesFromEpicCatalog.
 */
function buildHeuristicCandidates() {
  throw new Error(
    'buildHeuristicCandidates removed — one-epic-for-all dual path is forbidden; use materializeCandidatesFromEpicCatalog'
  );
}

async function backlogProposeFromSources(opts = {}) {
  const built = materializeCandidatesFromEpicCatalog(opts);
  if (!built.ok) {
    return {
      ok: false,
      code: built.code,
      message: built.message,
      source: 'epic_catalog',
    };
  }
  return {
    ok: true,
    candidateProposal: {
      epics: built.epics,
      features: built.features,
      stories: built.stories,
    },
    llmCoverageProposals: built.llmCoverageProposals,
    source: 'epic_catalog',
  };
}

module.exports = {
  materializeCandidatesFromEpicCatalog,
  buildHeuristicCandidates,
  backlogProposeFromSources,
};
