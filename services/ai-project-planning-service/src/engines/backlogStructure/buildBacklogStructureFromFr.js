/**
 * Materialize backlog structure from FR rows + LLM epicsCatalog → pipeline.
 * No heuristic one-epic-for-all dual path.
 */

const { backlogProposeFromSources } = require('./backlogProposeFromSources');
const { runBacklogStructurePipeline } = require('./runBacklogStructurePipeline');
const { buildOperationKey, hashInput } = require('./proposalOperationStore');

/**
 * After mint, prefer catalog epic ids (multi-epic safe) over random EPIC-xxxxx.
 */
function applyEpicCatalogIds(structure, epicsCatalog, tempRefMap) {
  const catalog = Array.isArray(epicsCatalog) ? epicsCatalog.filter((e) => e?.id) : [];
  if (!catalog.length || !Array.isArray(structure?.epics) || !structure.epics.length) return;

  const usedEpics = new WeakSet();
  for (const cat of catalog) {
    const catId = String(cat.id || '').trim();
    if (!catId) continue;
    const catFr = new Set(
      (Array.isArray(cat.sourceFrIds) ? cat.sourceFrIds : []).map((id) => String(id).trim())
    );
    let best = null;
    let bestScore = -1;
    for (const epic of structure.epics) {
      if (!epic?.id || usedEpics.has(epic)) continue;
      let score = 0;
      if (catFr.size) {
        score = (epic.sourceFrIds || []).filter((id) => catFr.has(String(id).trim())).length;
      } else {
        const name = String(epic.name || epic.title || '').trim();
        const catName = String(cat.name || cat.title || '').trim();
        if (name && catName && name === catName) score = 1;
        if (String(epic.id) === catId) score = 2;
      }
      if (score > bestScore) {
        bestScore = score;
        best = epic;
      }
    }
    if (!best) {
      best = structure.epics.find((e) => e?.id && !usedEpics.has(e)) || null;
    }
    if (!best) continue;

    const oldId = best.id;
    usedEpics.add(best);
    best.id = catId;
    best.name = cat.name || cat.title || best.name || best.title || catId;
    best.title = best.name;

    for (const f of structure.features || []) {
      if (f.parentEpicId === oldId) f.parentEpicId = catId;
    }
    for (const s of structure.stories || []) {
      if (s.parentEpicId === oldId) s.parentEpicId = catId;
    }
    if (tempRefMap && typeof tempRefMap === 'object') {
      for (const [k, v] of Object.entries(tempRefMap)) {
        if (v === oldId) tempRefMap[k] = catId;
      }
    }
  }
}

async function buildBacklogStructureFromFr(opts = {}) {
  const frItems = Array.isArray(opts.frItems) ? opts.frItems : [];
  const epicsCatalog = Array.isArray(opts.epicsCatalog) ? opts.epicsCatalog : [];
  const frAllowList = frItems
    .map((r) => String(r.id || r.logicalId || r.frId || '').trim())
    .filter(Boolean);
  const acAllowList = [];
  for (const fr of frItems) {
    const frId = String(fr.id || fr.logicalId || '').trim();
    const ac = fr.ac || fr.acceptanceCriteria || '';
    const parts = Array.isArray(ac)
      ? ac
      : String(ac || '')
          .split(/\n|;/)
          .map((s) => s.trim())
          .filter(Boolean);
    parts.forEach((_, j) => acAllowList.push(`${frId}:AC-${j + 1}`));
  }

  const sourceSnapshotVersion =
    opts.sourceSnapshotVersion ||
    hashInput({ frAllowList, epicIds: epicsCatalog.map((e) => e.id) }).slice(0, 16);

  const operationKey =
    opts.operationKey ||
    buildOperationKey({
      packId: opts.packId || 'pack',
      phase: 'what',
      tool: 'backlogPropose',
      sourceSnapshotVersion,
      purpose: 'backlog_structure',
    });

  const proposed = await backlogProposeFromSources({
    frRows: frItems,
    epicsCatalog,
    evidenceAllowList: opts.evidenceAllowList,
    env: opts.env,
  });
  if (!proposed.ok) {
    return {
      ok: false,
      code: proposed.code || 'epic_catalog_required',
      message: proposed.message || 'Epic catalog materialize failed',
      backlogSource: 'backlog_structure',
    };
  }

  const pipeline = runBacklogStructurePipeline({
    candidateProposal: proposed.candidateProposal,
    llmCoverageProposals: proposed.llmCoverageProposals,
    operationKey,
    inputFingerprint: {
      frAllowList: [...frAllowList].sort(),
      acAllowList: [...acAllowList].sort(),
      sourceSnapshotVersion,
      purpose: 'backlog_structure',
      epicIds: epicsCatalog.map((e) => e.id).filter(Boolean).sort(),
    },
    frAllowList,
    acAllowList,
    frInScope: frAllowList,
    acInScope: acAllowList,
    approvedBaseline: opts.approvedBaseline || null,
    currentDraft: opts.currentDraft || null,
    userEdits: opts.userEdits || null,
    identityResolutions: opts.identityResolutions || [],
    expectedDraftRevisionId: opts.expectedDraftRevisionId ?? null,
    currentDraftRevisionId: opts.currentDraftRevisionId ?? null,
    sourceSnapshotVersion,
  });

  if (!pipeline.ok) {
    return {
      ok: false,
      ...pipeline,
      backlogSource: 'backlog_structure',
    };
  }

  const structure = pipeline.backlogStructure;
  applyEpicCatalogIds(structure, epicsCatalog, pipeline.tempRefMap);

  return {
    ok: true,
    backlogStructure: {
      ...structure,
      meta: {
        ...structure.meta,
        backlogSource: 'backlog_structure',
        proposeSource: proposed.source || 'epic_catalog',
      },
    },
    tempRefMap: pipeline.tempRefMap,
    draftRevisionId: pipeline.draftRevisionId,
    replay: pipeline.replay,
  };
}

module.exports = {
  buildBacklogStructureFromFr,
  applyEpicCatalogIds,
};
