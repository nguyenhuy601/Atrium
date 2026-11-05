/**
 * Run-input hydrate cache on redis-lg (RULE-FS-04).
 * Key: vh:run-input:{orgId}:{snapshotId}:{packContentHash}:{projection}
 */

const { runOnArtifactRedis } = require('../artifacts/artifactRedis');

const DEFAULT_TTL_SEC = 30 * 60; // 30m

function cacheEnabled(env = process.env) {
  const raw = String(env.RUN_INPUT_CACHE ?? '1').trim().toLowerCase();
  return raw !== '0' && raw !== 'false' && raw !== 'off' && raw !== 'no';
}

function cacheTtlSec(env = process.env) {
  const n = Number(env.RUN_INPUT_CACHE_TTL_SEC);
  if (Number.isFinite(n) && n > 0) return Math.floor(n);
  return DEFAULT_TTL_SEC;
}

/**
 * @param {{
 *   organizationId: string,
 *   snapshotId: string,
 *   packContentHash: string,
 *   projection?: string,
 * }} parts
 */
function buildRunInputCacheKey(parts) {
  const org = String(parts.organizationId || '').trim() || 'na';
  const snap = String(parts.snapshotId || '').trim() || 'na';
  const hash = String(parts.packContentHash || '').trim() || 'na';
  const proj = String(parts.projection || 'full').trim().toLowerCase() || 'full';
  return `vh:run-input:${org}:${snap}:${hash}:${proj}`;
}

/**
 * @param {{
 *   organizationId: string,
 *   snapshotId: string,
 *   packContentHash: string,
 *   projection?: string,
 *   env?: object,
 *   redis?: object,
 * }} opts
 * @returns {Promise<{ hit: boolean, value: object|null, reason?: string }>}
 */
async function getRunInputCache(opts = {}) {
  const env = opts.env || process.env;
  if (!cacheEnabled(env)) return { hit: false, value: null, reason: 'disabled' };
  const key = buildRunInputCacheKey(opts);
  const result = await runOnArtifactRedis(env, opts.redis, async (redis) => {
    const raw = await redis.get(key);
    if (!raw) return { hit: false, value: null, reason: 'miss' };
    try {
      const value = JSON.parse(raw);
      if (!value || typeof value !== 'object') {
        return { hit: false, value: null, reason: 'bad_json' };
      }
      return { hit: true, value };
    } catch {
      return { hit: false, value: null, reason: 'bad_json' };
    }
  });
  if (result && result.hit != null) return result;
  return { hit: false, value: null, reason: result?.reason || 'redis_error' };
}

/**
 * @param {{
 *   organizationId: string,
 *   snapshotId: string,
 *   packContentHash: string,
 *   projection?: string,
 *   value: object,
 *   env?: object,
 *   redis?: object,
 * }} opts
 */
async function setRunInputCache(opts = {}) {
  const env = opts.env || process.env;
  if (!cacheEnabled(env)) return { ok: false, reason: 'disabled' };
  if (!opts.value || typeof opts.value !== 'object') {
    return { ok: false, reason: 'no_value' };
  }
  const key = buildRunInputCacheKey(opts);
  const ttl = cacheTtlSec(env);
  const body = JSON.stringify(opts.value);
  const result = await runOnArtifactRedis(env, opts.redis, async (redis) => {
    await redis.set(key, body, 'EX', ttl);
    return { ok: true, key, ttl };
  });
  if (result?.ok) return result;
  return { ok: false, reason: result?.reason || 'redis_error' };
}

module.exports = {
  cacheEnabled,
  cacheTtlSec,
  buildRunInputCacheKey,
  getRunInputCache,
  setRunInputCache,
};
