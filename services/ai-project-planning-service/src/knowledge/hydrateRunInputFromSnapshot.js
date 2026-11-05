/**
 * Resolve runtime snapshot + analysis-freeze pack for a PlanningRun (RULE-DL-01/07).
 * Prefer S2S hydrate when run meta is complete; embedded input.snapshot only as legacy fallback.
 * Fast Start: redis-lg run-input cache + projection=what|how (RULE-FS-04/05).
 */

const projectClient = require('../clients/project.client');
const {
  getRunInputCache,
  setRunInputCache,
} = require('./runInputCache');
const { normalizeProjection } = require('./hydrateProjection');

function hasHydrateMeta(run) {
  const snapshotId = String(run?.snapshotId || '').trim();
  const packId = String(run?.packId || '').trim();
  const organizationId = String(run?.organizationId || '').trim();
  return Boolean(snapshotId && packId && organizationId);
}

/**
 * @param {object} run — PlanningRun lean
 * @param {{
 *   fetchFn?: Function,
 *   projection?: 'what'|'how'|'full',
 *   packContentHash?: string|null,
 *   env?: object,
 * }} [opts]
 * @returns {Promise<{
 *   mode: 'hydrate'|'embedded_legacy'|'cache_hit',
 *   snapshot: object,
 *   pack: object,
 *   packContentHash?: string|null,
 *   pipelineVersion?: number|null,
 *   hydrateMs?: number,
 *   projection?: string,
 * }>}
 */
async function hydrateRunInputFromSnapshot(run, opts = {}) {
  const input = run?.input && typeof run.input === 'object' ? run.input : {};
  const embeddedSnapshot = input.snapshot || input.snapshotPayload || null;
  const embeddedPack = input.pack || null;

  const snapshotId = String(run?.snapshotId || '').trim();
  const packId = String(run?.packId || '').trim();
  const organizationId = String(run?.organizationId || '').trim();
  const projection = normalizeProjection(
    opts.projection ||
      (run?.job === 'phase_how' ? 'how' : run?.job === 'phase_what' ? 'what' : 'full')
  );
  const env = opts.env || process.env;

  // RULE-DL-01/07: when run meta is present, always S2S hydrate (ignore poisoned embedded stubs)
  if (hasHydrateMeta(run)) {
    const knownHash = String(
      opts.packContentHash ||
        input.packContentHash ||
        run.packContentHash ||
        ''
    ).trim();

    if (knownHash) {
      const cached = await getRunInputCache({
        organizationId,
        snapshotId,
        packContentHash: knownHash,
        projection,
        env,
      });
      if (cached.hit && cached.value?.snapshot) {
        console.info(
          '[hydrate_snapshot] mode=cache_hit snapshotId=%s packId=%s projection=%s hydrateMs=0',
          snapshotId,
          packId,
          projection
        );
        return {
          mode: 'cache_hit',
          snapshot: cached.value.snapshot,
          pack: cached.value.pack || {},
          packContentHash: cached.value.packContentHash || knownHash,
          pipelineVersion: cached.value.pipelineVersion ?? null,
          hydrateMs: 0,
          projection,
        };
      }
    }

    const fetchFn = opts.fetchFn || projectClient.fetchAnalysisSnapshotHydrate;
    const hydrateStarted = process.hrtime.bigint();
    const data = await fetchFn({
      snapshotId,
      packId,
      organizationId,
      projection,
    });
    const hydrateMs = Math.max(
      0,
      Math.round(Number(process.hrtime.bigint() - hydrateStarted) / 1e6)
    );
    const packContentHash = String(data.packContentHash || knownHash || '').trim();
    console.info(
      '[hydrate_snapshot] mode=hydrate snapshotId=%s packId=%s embeddedIgnored=%s hydrateMs=%s projection=%s cache=miss',
      snapshotId,
      packId,
      Boolean(embeddedSnapshot),
      hydrateMs,
      projection
    );

    if (packContentHash && data.snapshot) {
      setRunInputCache({
        organizationId,
        snapshotId,
        packContentHash,
        projection,
        value: {
          snapshot: data.snapshot,
          pack: data.pack,
          packContentHash,
          pipelineVersion: data.pipelineVersion ?? null,
        },
        env,
      }).catch(() => {});
    }

    return {
      mode: 'hydrate',
      snapshot: data.snapshot,
      pack: data.pack,
      packContentHash: packContentHash || null,
      pipelineVersion: data.pipelineVersion ?? null,
      hydrateMs,
      projection,
    };
  }

  if (embeddedSnapshot && typeof embeddedSnapshot === 'object') {
    console.info(
      '[hydrate_snapshot] mode=embedded_legacy snapshotId=%s packId=%s',
      String(run?.snapshotId || embeddedSnapshot.snapshotId || ''),
      String(run?.packId || '')
    );
    return {
      mode: 'embedded_legacy',
      snapshot: embeddedSnapshot,
      pack:
        embeddedPack && typeof embeddedPack === 'object'
          ? embeddedPack
          : {},
      packContentHash: input.packContentHash || null,
      pipelineVersion: input.pipelineVersion ?? null,
      projection,
    };
  }

  const err = new Error(
    'Hydrate requires run.snapshotId, run.packId, run.organizationId'
  );
  err.code = 'HYDRATE_RUN_META_REQUIRED';
  throw err;
}

module.exports = {
  hydrateRunInputFromSnapshot,
  hasHydrateMeta,
};
