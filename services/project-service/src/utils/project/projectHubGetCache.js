/**
 * Process-local TTL + in-flight coalesce for GET ?view=hub (per user × project).
 * Avoids N parallel Hub callers recomputing membership/caps on cold miss.
 */
const { createTtlCoalesceCache } = require('../ttlCoalesceCache');

const HUB_GET_CACHE_TTL_MS = 30_000;
const hubGetCache = createTtlCoalesceCache({ ttlMs: HUB_GET_CACHE_TTL_MS });

function hubGetCacheKey(userId, projectId) {
  const uid = String(userId || '').trim();
  const pid = String(projectId || '').trim();
  if (!uid || !pid) return '';
  return `${uid}|${pid}`;
}

function invalidateHubGetCacheForProject(projectId) {
  const pid = String(projectId || '').trim();
  if (!pid) return;
  hubGetCache.invalidateWhere((k) => k.endsWith(`|${pid}`));
}

function invalidateHubGetCacheForUserProject(userId, projectId) {
  const key = hubGetCacheKey(userId, projectId);
  if (key) hubGetCache.deleteKey(key);
}

function clearHubGetCache() {
  hubGetCache.clear();
}

module.exports = {
  hubGetCache,
  hubGetCacheKey,
  HUB_GET_CACHE_TTL_MS,
  invalidateHubGetCacheForProject,
  invalidateHubGetCacheForUserProject,
  clearHubGetCache,
};
