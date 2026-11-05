/**
 * Cached preparation artifact (corpus meta + contextPackage) per snapshot+hash+phase.
 * Distinct from per-run execution state (RULE Fast Start P1).
 */

const crypto = require('crypto');
const { runOnArtifactRedis } = require('../artifacts/artifactRedis');

const TTL_SEC = 60 * 60; // 1h

function phaseContextKey({ snapshotId, corpusHash, phase, queryKey }) {
  const snap = String(snapshotId || '').trim() || 'na';
  const hash = String(corpusHash || '').trim() || 'na';
  const ph = phase === 'how' ? 'how' : 'what';
  const q = crypto
    .createHash('sha256')
    .update(String(queryKey || ''))
    .digest('hex')
    .slice(0, 16);
  return `vh:phase-ctx:${ph}:${snap}:${hash}:${q}`;
}

function artifactEnabled(env = process.env) {
  const raw = String(env.PHASE_CONTEXT_ARTIFACT ?? '1').trim().toLowerCase();
  return raw !== '0' && raw !== 'false' && raw !== 'off' && raw !== 'no';
}

/**
 * @returns {Promise<{ hit: boolean, artifact: object|null, reason?: string }>}
 */
async function getPhaseContextArtifact(opts = {}) {
  const env = opts.env || process.env;
  if (!artifactEnabled(env)) return { hit: false, artifact: null, reason: 'disabled' };
  const key = phaseContextKey(opts);
  const result = await runOnArtifactRedis(env, opts.redis, async (redis) => {
    const raw = await redis.get(key);
    if (!raw) return { hit: false, artifact: null, reason: 'miss' };
    try {
      const artifact = JSON.parse(raw);
      if (!artifact || typeof artifact !== 'object') {
        return { hit: false, artifact: null, reason: 'bad_json' };
      }
      return { hit: true, artifact };
    } catch {
      return { hit: false, artifact: null, reason: 'bad_json' };
    }
  });
  if (result && result.hit != null) return result;
  return { hit: false, artifact: null, reason: result?.reason || 'redis_error' };
}

async function putPhaseContextArtifact(opts = {}) {
  const env = opts.env || process.env;
  if (!artifactEnabled(env)) return { ok: false, reason: 'disabled' };
  if (!opts.artifact || typeof opts.artifact !== 'object') {
    return { ok: false, reason: 'no_artifact' };
  }
  const key = phaseContextKey(opts);
  const body = JSON.stringify({
    ...opts.artifact,
    storedAt: new Date().toISOString(),
  });
  const result = await runOnArtifactRedis(env, opts.redis, async (redis) => {
    await redis.set(key, body, 'EX', TTL_SEC);
    return { ok: true, key };
  });
  if (result?.ok) return result;
  return { ok: false, reason: result?.reason || 'redis_error' };
}

module.exports = {
  phaseContextKey,
  getPhaseContextArtifact,
  putPhaseContextArtifact,
  artifactEnabled,
};
