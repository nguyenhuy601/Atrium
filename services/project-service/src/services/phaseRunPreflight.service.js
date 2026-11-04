/**
 * Fast Start preflight — classify READY | STALE | MISSING and refresh only when needed.
 * RULE-FS-02: reuse_if_valid never skips form INVALID / missing snapshot when MISSING.
 */

const { buildPackContentHash } = require('../utils/aiAnalysis/packContentHash');
const {
  isSnapshotProjectionCompatible,
} = require('../utils/aiAnalysis/pipeline/snapshotCompatibility');
const { PIPELINE_VERSION } = require('../utils/aiAnalysis/pipeline/pipelineConstants');

const PREPARATION_STATES = Object.freeze(['READY', 'STALE', 'MISSING']);

/**
 * @param {object|null|undefined} pack
 * @param {object|null|undefined} snapshotDoc
 * @param {{ phaseJob?: string }} [opts]
 * @returns {'READY'|'STALE'|'MISSING'}
 */
function classifyPhaseRunPreparation(pack, snapshotDoc, opts = {}) {
  const phaseJob = opts.phaseJob === 'phase_how' ? 'phase_how' : 'phase_what';
  if (!snapshotDoc || !snapshotDoc._id) {
    return 'MISSING';
  }

  if (phaseJob === 'phase_what') {
    const form = pack?.aiAnalysis?.formValidation;
    if (form && form.ok === false) {
      const err = new Error('Customer Raw form validation failed');
      err.statusCode = 422;
      err.errorCode = 'FORM_VALIDATION_FAILED';
      err.formValidation = form;
      throw err;
    }
    const {
      isCustomerRawIntakePack,
      packNeedsCanonicalRawBackfill,
      countValidFr,
    } = require('../utils/requirement/workbookDiagnostic');
    const formOk = form?.ok === true;
    const isRaw = formOk || isCustomerRawIntakePack(pack);
    if (isRaw && packNeedsCanonicalRawBackfill(pack) && countValidFr(pack) === 0) {
      return 'MISSING';
    }
  }

  const packObj = pack && typeof pack.toObject === 'function' ? pack.toObject() : pack;
  const liveHash = buildPackContentHash(packObj || {});
  const compat = isSnapshotProjectionCompatible(snapshotDoc, {
    packContentHash: liveHash,
    pipelineVersion: PIPELINE_VERSION,
  });
  if (!compat.ok) {
    if (compat.reason === 'missing_snapshot' || compat.reason === 'canonical_raw') {
      return 'MISSING';
    }
    return 'STALE';
  }
  return 'READY';
}

/**
 * Ensure pack+snapshot ready for phase start under snapshotPolicy.
 *
 * @param {{
 *   userId: string,
 *   organizationId: string,
 *   packId: string,
 *   pack: object,
 *   phaseJob: 'phase_what'|'phase_how',
 *   snapshotPolicy?: string,
 * }} opts
 */
async function ensurePhaseRunPrepared(opts = {}) {
  const {
    userId,
    organizationId,
    packId,
    phaseJob,
  } = opts;
  let pack = opts.pack;
  const snapshotPolicy = String(opts.snapshotPolicy || 'reuse_if_valid')
    .trim()
    .toLowerCase();
  const reuseIfValid =
    snapshotPolicy === 'reuse_if_valid' || snapshotPolicy === '' || snapshotPolicy === 'default';

  const {
    isSnapshotPipelineEnabled,
    ensureActiveAiAnalysisSnapshot,
    loadActiveSnapshotDocument,
    assertSnapshotRequired,
  } = require('./aiAnalysisSnapshot.service');

  let snapshotDoc = null;
  if (isSnapshotPipelineEnabled()) {
    snapshotDoc = await loadActiveSnapshotDocument({
      organizationId,
      packId,
      pack,
    });
  }

  let preparationState = classifyPhaseRunPreparation(pack, snapshotDoc, { phaseJob });
  let reusedSnapshot = preparationState === 'READY';

  // MISSING: full prepare path for WHAT (intake + snapshot).
  if (preparationState === 'MISSING' && phaseJob === 'phase_what') {
    const { prepareUnderstandingOnly } = require('./whatRequirementPhase.service');
    await prepareUnderstandingOnly({ userId, organizationId, packId });
    const RequirementPack = require('../models/RequirementPack');
    pack = await RequirementPack.findOne({ _id: packId, organizationId });
    if (!pack) {
      const err = new Error('RequirementPack không tồn tại');
      err.statusCode = 404;
      err.errorCode = 'PACK_NOT_FOUND';
      throw err;
    }
    reusedSnapshot = false;
    preparationState = 'STALE';
  }

  if (!isSnapshotPipelineEnabled()) {
    return {
      pack,
      snapshotDoc: null,
      snapshotId: pack?.aiAnalysisActiveSnapshotId
        ? String(pack.aiAnalysisActiveSnapshotId)
        : null,
      preparationState: preparationState === 'READY' ? 'READY' : preparationState,
      reusedSnapshot: false,
      packContentHash: buildPackContentHash(
        pack && typeof pack.toObject === 'function' ? pack.toObject() : pack || {}
      ),
    };
  }

  const shouldRefresh =
    !reuseIfValid ||
    preparationState === 'STALE' ||
    preparationState === 'MISSING' ||
    !snapshotDoc;

  if (shouldRefresh) {
    const ensured = await ensureActiveAiAnalysisSnapshot({
      userId,
      organizationId,
      packId,
      pack,
      refreshOnFrDrift: preparationState !== 'READY' || phaseJob === 'phase_how',
    });
    pack = ensured.pack || pack;
    snapshotDoc = ensured.snapshotDoc;
    reusedSnapshot = preparationState === 'READY' && Boolean(snapshotDoc);
    if (preparationState === 'MISSING') {
      preparationState = snapshotDoc ? 'READY' : 'MISSING';
    } else if (preparationState === 'STALE') {
      preparationState = 'READY';
    }
  } else {
    // READY + reuse_if_valid: keep active snapshot, no recreate.
    reusedSnapshot = true;
  }

  assertSnapshotRequired(snapshotDoc);
  const snapshotId = snapshotDoc ? String(snapshotDoc._id) : null;
  const packContentHash = String(
    snapshotDoc?.packContentHash ||
      buildPackContentHash(
        pack && typeof pack.toObject === 'function' ? pack.toObject() : pack || {}
      )
  );

  // eslint-disable-next-line no-console
  console.info(
    '[phase_run_preflight] preparationState=%s reusedSnapshot=%s packId=%s snapshotId=%s',
    preparationState,
    reusedSnapshot,
    String(packId),
    snapshotId || ''
  );

  return {
    pack,
    snapshotDoc,
    snapshotId,
    preparationState,
    reusedSnapshot,
    packContentHash,
  };
}

module.exports = {
  PREPARATION_STATES,
  classifyPhaseRunPreparation,
  ensurePhaseRunPrepared,
};
