/**
 * S2S `/api/auth/internal/*` đã bảo vệ bằng internalGatewayAuth —
 * không đếm vào IP rate-limit chung (tránh Excel import / provision burst → 429).
 *
 * `POST /refresh-token` cũng skip limiter **chung** (`app.use('/api/auth', …)`),
 * vì route đã có `createRefreshTokenLimiter` (trần riêng, cao hơn) — tránh
 * đếm kép + 429 cascade khi nhiều tab, vẫn chống brute-force cookie.
 *
 * @param {{ path?: string, originalUrl?: string, url?: string }} req
 * @returns {boolean}
 */
function shouldSkipAuthRouteRateLimit(req) {
  const path = String(req?.path || '');
  const original = String(req?.originalUrl || req?.url || '');
  return (
    path.startsWith('/internal') ||
    path === '/refresh-token' ||
    /\/api\/auth\/internal(?:\/|$|\?)/.test(original) ||
    /\/api\/auth\/refresh-token(?:\/|$|\?)/.test(original)
  );
}

module.exports = {
  shouldSkipAuthRouteRateLimit,
};
