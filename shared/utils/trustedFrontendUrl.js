const { resolveFrontendUrl } = require('./resolveFrontendUrl');

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);

function toOrigin(raw) {
  try {
    const url = new URL(String(raw || '').trim());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
    return url.origin;
  } catch {
    return '';
  }
}

function listCorsOrigins(env) {
  return String(env.CORS_ORIGIN || '')
    .split(',')
    .map(toOrigin)
    .filter(Boolean);
}

function defaultFrontendOrigin(env) {
  return (
    toOrigin(env.FRONTEND_URL) ||
    listCorsOrigins(env)[0] ||
    (env.DOMAIN ? `https://${String(env.DOMAIN).trim()}` : '') ||
    'http://localhost:5173'
  );
}

function isAllowedOrigin(origin, env) {
  if (!origin) return false;
  if (listCorsOrigins(env).includes(origin)) return true;
  if (origin === toOrigin(env.FRONTEND_URL)) return true;
  if (env.DOMAIN && origin === toOrigin(`https://${String(env.DOMAIN).trim()}`)) {
    return true;
  }
  if (String(env.NODE_ENV || '').toLowerCase() !== 'production') {
    try {
      return LOCAL_HOSTS.has(new URL(origin).hostname);
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Origin dùng để dựng link gửi người dùng (mời / voice / import).
 * Origin/Referer từ request chỉ được dùng khi thuộc allowlist (CORS_ORIGIN / FRONTEND_URL / DOMAIN).
 */
function trustedFrontendUrl(req, env = process.env) {
  const candidate = toOrigin(resolveFrontendUrl(req, 'FRONTEND_URL', env));
  if (isAllowedOrigin(candidate, env)) return candidate;
  return defaultFrontendOrigin(env);
}

module.exports = {
  trustedFrontendUrl,
  isAllowedOrigin,
  toOrigin,
  listCorsOrigins,
  defaultFrontendOrigin,
};
