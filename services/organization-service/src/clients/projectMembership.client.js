const axios = require('axios');
const { logger } = require('@enterprise/shared');

const PROJECT_SERVICE_URL = String(process.env.PROJECT_SERVICE_URL || '')
  .trim()
  .replace(/\/+$/, '');
const GATEWAY_INTERNAL_TOKEN = String(
  process.env.GATEWAY_INTERNAL_TOKEN || process.env.USER_SERVICE_INTERNAL_TOKEN || ''
).trim();

/**
 * S2S: project IDs active của user trong org (fallback khi UserProjectMembership lệch sync).
 * @param {string} organizationId
 * @param {string} userId
 * @returns {Promise<string[]>}
 */
async function fetchUserProjectIdsInOrg(organizationId, userId) {
  const oid = String(organizationId || '').trim();
  const uid = String(userId || '').trim();
  if (!oid || !uid || !PROJECT_SERVICE_URL || !GATEWAY_INTERNAL_TOKEN) {
    return [];
  }
  try {
    const response = await axios.get(
      `${PROJECT_SERVICE_URL}/api/projects/internal/org/${encodeURIComponent(oid)}/users/${encodeURIComponent(uid)}/project-ids`,
      {
        headers: {
          'x-internal-token': GATEWAY_INTERNAL_TOKEN,
          'x-gateway-internal-token': GATEWAY_INTERNAL_TOKEN,
        },
        timeout: Number(process.env.PROJECT_LOOKUP_TIMEOUT_MS || 8000),
        validateStatus: () => true,
      }
    );
    if (response.status >= 400) {
      logger.warn('[projectMembership.client] S2S status=%s', response.status);
      return [];
    }
    const ids = response.data?.data?.projectIds || response.data?.projectIds || [];
    return Array.isArray(ids) ? ids.map(String).filter(Boolean) : [];
  } catch (err) {
    logger.warn('[projectMembership.client] S2S failed: %s', err?.message || err);
    return [];
  }
}

module.exports = {
  fetchUserProjectIdsInOrg,
};
