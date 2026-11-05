/**
 * Merge succeeded chunk leaves and run global coverage checks.
 * Does not invent or edit source FR rows. Dead-letter chunks stay out of the tree.
 */

const {
  dedupeWbsLeaves,
  materializeWbsFromSotAndLeaves,
  resolveDecompositionOutcome,
  acCitationCoversWhitelist,
  resolveAcRefToWhitelist,
} = require('../engines/wbsProposeLlm');
const { assessDecompositionQuality } = require('../engines/wbsDecompositionQuality');

function frIdOf(leaf) {
  return String(leaf?.sourceFrIds?.[0] || '').trim();
}

/**
 * @param {object[]} units
 * @param {object} context
 */
function reconcileWbsChunks(units, context = {}) {
  const snapshotId = String(context.inputSnapshotId || '');
  const frUnits = Array.isArray(context.frUnits) ? context.frUnits : [];
  const stories = Array.isArray(context.stories) ? context.stories : [];
  const epics = Array.isArray(context.epics) ? context.epics : [];
  const features = Array.isArray(context.features) ? context.features : [];
  const acceptedUnits = [];
  const rejectedSnapshotIds = [];

  for (const unit of units || []) {
    if (unit.status !== 'SUCCEEDED' || !unit.result) continue;
    if (snapshotId && unit.inputSnapshotId !== snapshotId) {
      rejectedSnapshotIds.push(unit.workUnitId);
      continue;
    }
    if (unit.result.inputSnapshotId && snapshotId && unit.result.inputSnapshotId !== snapshotId) {
      rejectedSnapshotIds.push(unit.workUnitId);
      continue;
    }
    acceptedUnits.push(unit);
  }

  const leaves = [];
  const isolatedFrIds = [];
  const clarifications = [];
  const qualityIssues = [];
  let needsReview = false;
  let repairAttempts = 0;
  let llmCalls = 0;
  let promptChars = 0;
  let model = null;
  for (const unit of acceptedUnits) {
    const tasks = Array.isArray(unit.result.tasks) ? unit.result.tasks : [];
    leaves.push(...tasks);
    if (Array.isArray(unit.result.isolatedFrIds)) isolatedFrIds.push(...unit.result.isolatedFrIds);
    if (Array.isArray(unit.result.clarifications)) clarifications.push(...unit.result.clarifications);
    if (Array.isArray(unit.result.qualityIssues)) qualityIssues.push(...unit.result.qualityIssues);
    if (unit.result.needsReview) needsReview = true;
    repairAttempts += Number(unit.result.repairAttempts) || 0;
    llmCalls += Number(unit.result.llmCalls) || 0;
    promptChars += Number(unit.result.promptChars) || 0;
    model = unit.result.model || model;
  }

  const deduped = dedupeWbsLeaves(leaves);
  const merged = deduped.leaves;
  const knownFr = new Set(frUnits.map((unit) => String(unit.id || '').trim()).filter(Boolean));
  const safeLeaves = merged.filter((leaf) => {
    const frId = frIdOf(leaf);
    return frId && knownFr.has(frId);
  });

  const coveredFr = new Set(safeLeaves.map(frIdOf).filter(Boolean));
  const uncoveredFrIds = frUnits.filter((unit) => !coveredFr.has(unit.id)).map((unit) => unit.id);
  const uncoveredAcKeys = [];
  const leavesByFr = new Map();
  for (const leaf of safeLeaves) {
    const frId = frIdOf(leaf);
    if (!frId) continue;
    if (!leavesByFr.has(frId)) leavesByFr.set(frId, []);
    leavesByFr.get(frId).push(leaf);
  }
  for (const unit of frUnits) {
    const group = leavesByFr.get(unit.id);
    if (!group?.length) continue;
    const cited = [];
    for (const leaf of group) {
      for (const ac of leaf.acRefs || []) cited.push(ac);
    }
    const acList = Array.isArray(unit.ac) ? unit.ac : [];
    for (const ac of acList) {
      if (!acCitationCoversWhitelist(ac, cited, { acList, frId: unit.id })) {
        uncoveredAcKeys.push(`${unit.id}:${ac}`);
      }
    }
  }

  const unresolvedStoryIds = stories
    .filter((story) => {
      const frs = Array.isArray(story.fr) ? story.fr : [];
      return frs.length > 0 && frs.every((id) => !coveredFr.has(String(id).trim()));
    })
    .map((story) => story.id);

  const deadUnits = (units || []).filter(
    (unit) => unit.status === 'DEAD_LETTER' || unit.status === 'FAILED'
  );
  const deadLetterIds = deadUnits.map((unit) => unit.workUnitId);
  const chunkError = deadUnits
    .map((unit) => String(unit.error || '').trim())
    .find(Boolean);

  if (!safeLeaves.length) {
    return {
      ok: false,
      meta: {
        source: 'llm_invalid',
        decompositionOutcome: 'failure',
        fallbackReason: deadLetterIds.length
          ? chunkError
            ? `wbs_chunks_dead_letter: ${chunkError.slice(0, 180)}`
            : 'wbs_chunks_dead_letter'
          : 'all_fr_slices_failed',
        reasonCodes: uncoveredFrIds.length ? uncoveredFrIds : ['all_fr_slices_failed'],
        isolatedFrIds,
        uncoveredFrIds,
        deadLetterIds,
        rejectedSnapshotIds,
        llmCalls,
        model,
        promptChars,
        chunks: (units || []).length,
        chunkOrchestrator: 'langgraph',
      },
    };
  }

  const finalQuality = assessDecompositionQuality({
    frUnits,
    tasks: safeLeaves,
    clarifications,
    resolveAcRef: (raw, acList, frId) => resolveAcRefToWhitelist(raw, acList, { frId }),
  });
  if (!finalQuality.ok) {
    qualityIssues.push(...finalQuality.issues);
    needsReview = true;
  }
  if (clarifications.length || uncoveredFrIds.length || uncoveredAcKeys.length || isolatedFrIds.length) {
    needsReview = true;
  }

  const decompositionOutcome = resolveDecompositionOutcome({
    leafCount: safeLeaves.length,
    unresolvedUnitIds: unresolvedStoryIds,
    uncoveredFrIds,
    uncoveredAcKeys,
    qualityIssues,
    clarifications,
    needsReview,
  });
  // Defense: re-stamp Story→Epic via Feature so chunk state without parentEpicId still nests.
  // Observed production failure (run 6ae85813): ABS had Feature+14 stories, but chunk
  // context arrived with features=[] and stories only kept parentId=FEATURE-* (no
  // parentFeatureId) → materialize left Epic empty + Gate2 stub "lập lại" epic.
  const epicIdSet = new Set(
    epics.map((e) => String(e?.id || '').replace(/^c\d+-/i, '').trim()).filter(Boolean)
  );
  const soleEpicId = epicIdSet.size === 1 ? [...epicIdSet][0] : null;

  function looksLikeFeatureId(raw) {
    const id = String(raw || '').replace(/^c\d+-/i, '').trim();
    return id && /^FEATURE[-_]/i.test(id) ? id : '';
  }

  function resolveStoryFeatureId(s) {
    const explicit = String(s?.parentFeatureId || '').replace(/^c\d+-/i, '').trim();
    if (explicit) return explicit;
    return looksLikeFeatureId(s?.parentId) || looksLikeFeatureId(s?.parentFeatureId) || '';
  }

  // Recover Feature rows from durable chunk inputs when LangGraph state dropped them.
  let featuresForTree = Array.isArray(features) ? [...features] : [];
  if (!featuresForTree.length) {
    const seen = new Set();
    for (const unit of units || []) {
      const fromInput = unit?.input?.features;
      if (!Array.isArray(fromInput)) continue;
      for (const f of fromInput) {
        const fid = String(f?.id || '').trim();
        if (!fid || seen.has(fid)) continue;
        seen.add(fid);
        featuresForTree.push(f);
      }
    }
  }

  const featureToEpic = new Map();
  for (const f of featuresForTree) {
    const fid = String(f?.id || '').replace(/^c\d+-/i, '').trim();
    if (!fid) continue;
    let pe = String(f?.parentEpicId || f?.parentId || '')
      .replace(/^c\d+-/i, '')
      .trim();
    if (pe && !epicIdSet.has(pe)) pe = '';
    if (!pe) pe = soleEpicId || '';
    if (pe) {
      f.parentEpicId = pe;
      f.parentId = pe;
    }
    featureToEpic.set(fid, pe);
  }
  const haveFeature = new Set(featureToEpic.keys());
  for (const s of stories) {
    const pf = resolveStoryFeatureId(s);
    if (!pf || haveFeature.has(pf)) continue;
    let pe = String(s?.parentEpicId || '')
      .replace(/^c\d+-/i, '')
      .trim();
    if (pe && !epicIdSet.has(pe)) pe = '';
    if (!pe) pe = soleEpicId || '';
    if (!pe) continue;
    featuresForTree.push({
      id: pf,
      name: pf,
      parentEpicId: pe,
      parentId: pe,
      sourceFrIds: Array.isArray(s.sourceFrIds)
        ? s.sourceFrIds
        : Array.isArray(s.fr)
          ? s.fr
          : [],
    });
    featureToEpic.set(pf, pe);
    haveFeature.add(pf);
  }
  if ((!features || !features.length) && featuresForTree.length) {
    console.warn(
      '[wbs-chunk] reconcile synthesized features=%s (state.features was empty)',
      featuresForTree.length
    );
  }
  const storiesForTree = stories.map((s) => {
    const pf = resolveStoryFeatureId(s) || null;
    let pe = String(s?.parentEpicId || '')
      .replace(/^c\d+-/i, '')
      .trim() || null;
    if (pe && !epicIdSet.has(pe)) pe = null;
    if (!pe && pf) pe = featureToEpic.get(pf) || soleEpicId || null;
    if (!pe && soleEpicId) pe = soleEpicId;
    return {
      ...s,
      parentFeatureId: pf,
      parentEpicId: pe,
      parentId: pf || pe || s.parentId || null,
    };
  });

  const materialized = materializeWbsFromSotAndLeaves({
    epics,
    features: featuresForTree,
    stories: storiesForTree,
    leaves: safeLeaves,
    frUnits,
  });

  return {
    ok: true,
    tasks: materialized.tasks,
    wbs: materialized.wbs,
    meta: {
      source: (units || []).length > 1 ? 'llm_fr_tasks_chunked' : 'llm_fr_tasks',
      decompositionOutcome,
      unresolvedUnitIds: unresolvedStoryIds,
      unresolvedStoryIds,
      storyCount: stories.length,
      epicCount: epics.length,
      featureCount: Number(materialized.wbs?.featureCount) || features.length || 0,
      workPackageCount: 0,
      epicsWithoutStories: materialized.wbs?.epicsWithoutStories || [],
      uncoveredFrIds,
      isolatedFrIds,
      uncoveredAcKeys,
      qualityIssues,
      clarifications,
      needsReview,
      repairAttempts,
      duplicateLeafIds: deduped.duplicateLeafIds,
      uniqueLeafCount: deduped.uniqueLeafCount,
      deadLetterIds,
      rejectedSnapshotIds,
      llmCalls,
      model,
      promptChars,
      unitCount: frUnits.length,
      leafCount: safeLeaves.length,
      chunks: (units || []).length,
      chunkOrchestrator: 'langgraph',
    },
  };
}

module.exports = { reconcileWbsChunks };
