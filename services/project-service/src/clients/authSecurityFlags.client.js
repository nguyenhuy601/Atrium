const axios = require('axios');

/**
 * Đọc security flags runtime từ auth-service (SoT IP allowlist).
 * @returns {Promise<object|null>}
 */
async function fetchAuthSecurityFlags() {
  const authUrl = String(process.env.AUTH_SERVICE_URL || '').trim().replace(/\/+$/, '');
  const token = String(process.env.GATEWAY_INTERNAL_TOKEN || '').trim();
  if (!authUrl || !token) return null;

  try {
    const response = await axios.get(`${authUrl}/api/auth/internal/security-flags`, {
      headers: { 'x-gateway-internal-token': token },
      timeout: Number(process.env.AUTH_LOOKUP_TIMEOUT_MS || 8000),
      validateStatus: () => true,
    });
    if (response.status >= 400) return null;
    const data = response.data?.data;
    return data && typeof data === 'object' ? data : null;
  } catch {
    return null;
  }
}

module.exports = {
  fetchAuthSecurityFlags,
};
