/**
 * URL frontend cho email / link mời — ưu tiên Origin/Referer từ browser,
 * sau đó X-Forwarded-*, cuối cùng FRONTEND_URL / DOMAIN.
 */
function resolveFrontendUrl(req, fallbackEnvKey = 'FRONTEND_URL', env = process.env) {
  const origin = req?.headers?.origin;
  if (origin && String(origin).trim()) {
    return String(origin).trim().replace(/\/+$/, '');
  }

  const xfFrontend = req?.headers?.['x-frontend-url'];
  if (xfFrontend && String(xfFrontend).trim()) {
    try {
      return new URL(String(xfFrontend).trim()).origin.replace(/\/+$/, '');
    } catch {
      /* ignore */
    }
  }

  const referer = req?.headers?.referer;
  if (referer && String(referer).trim()) {
    try {
      return new URL(String(referer)).origin;
    } catch {
      /* ignore */
    }
  }

  const xfProto = String(req?.headers?.['x-forwarded-proto'] || '')
    .split(',')[0]
    .trim();
  const xfHost = String(req?.headers?.['x-forwarded-host'] || req?.headers?.host || '')
    .split(',')[0]
    .trim();
  if (xfHost) {
    const proto = xfProto || 'https';
    return `${proto}://${xfHost}`.replace(/\/+$/, '');
  }

  const fallback =
    env[fallbackEnvKey] ||
    env.FRONTEND_URL ||
    (env.DOMAIN ? `https://${String(env.DOMAIN).trim()}` : '') ||
    'http://localhost:5173';
  return String(fallback).replace(/\/+$/, '');
}

module.exports = { resolveFrontendUrl };
