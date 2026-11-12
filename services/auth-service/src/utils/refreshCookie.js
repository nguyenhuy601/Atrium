const DEFAULT_COOKIE_NAME = 'refresh_token';
const DEFAULT_COOKIE_PATH = '/api/auth';
/** Non-HttpOnly marker — JS can detect "has session" without reading the refresh token. */
const SESSION_MARKER_NAME = 'vh_has_session';
const SESSION_MARKER_VALUE = '1';
/** Marker must be Path=/ so document.cookie on SPA (/app, /login) can read it. */
const SESSION_MARKER_PATH = '/';

function getRefreshCookieName() {
  return String(process.env.AUTH_REFRESH_COOKIE_NAME || DEFAULT_COOKIE_NAME).trim();
}

function getRefreshCookiePath() {
  return String(process.env.AUTH_REFRESH_COOKIE_PATH || DEFAULT_COOKIE_PATH).trim();
}

function getSessionMarkerCookieName() {
  return String(process.env.AUTH_SESSION_MARKER_COOKIE_NAME || SESSION_MARKER_NAME).trim();
}

function getSessionMarkerCookiePath() {
  return String(process.env.AUTH_SESSION_MARKER_COOKIE_PATH || SESSION_MARKER_PATH).trim() || '/';
}

/**
 * Parent domain for split-host (FE atrium.dev + API api.atrium.dev).
 * Explicit AUTH_REFRESH_COOKIE_DOMAIN wins; `none`/`false` disables.
 * Else DOMAIN, else hostname of FRONTEND_URL.
 */
function normalizeCookieDomain(value) {
  const raw = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^\./, '');
  if (!raw || raw === 'localhost' || raw.endsWith('.localhost')) return null;
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(raw)) return null;
  return `.${raw}`;
}

function getRefreshCookieDomain() {
  const explicit = process.env.AUTH_REFRESH_COOKIE_DOMAIN;
  if (explicit != null && String(explicit).trim() !== '') {
    const v = String(explicit).trim().toLowerCase();
    if (v === '0' || v === 'false' || v === 'no' || v === 'none' || v === 'off') {
      return null;
    }
    return normalizeCookieDomain(v);
  }

  const fromDomain = normalizeCookieDomain(process.env.DOMAIN);
  if (fromDomain) return fromDomain;

  const frontend = String(process.env.FRONTEND_URL || '').trim();
  if (!frontend) return null;
  try {
    return normalizeCookieDomain(new URL(frontend).hostname);
  } catch {
    return null;
  }
}

function parseBooleanEnv(value, defaultValue) {
  if (value == null) return defaultValue;
  const normalized = String(value).trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'yes') return true;
  if (normalized === '0' || normalized === 'false' || normalized === 'no') return false;
  return defaultValue;
}

function isForwardedHttps(req) {
  const proto = String(req?.headers?.['x-forwarded-proto'] || '')
    .split(',')[0]
    .trim()
    .toLowerCase();
  return proto === 'https';
}

function isCookieSecure(req) {
  const envVal = process.env.AUTH_REFRESH_COOKIE_SECURE;
  if (envVal != null && String(envVal).trim() !== '') {
    return parseBooleanEnv(envVal, false);
  }
  return (
    isForwardedHttps(req) ||
    Boolean(req?.secure) ||
    process.env.NODE_ENV === 'production'
  );
}

function getCookieValueFromHeader(cookieHeader, cookieName) {
  if (!cookieHeader || !cookieName) return null;
  const parts = String(cookieHeader).split(';');
  for (const part of parts) {
    const [rawName, ...rest] = part.trim().split('=');
    const name = String(rawName || '').trim();
    if (!name || name !== cookieName) continue;
    const value = rest.join('=');
    return decodeURIComponent(String(value || '').trim());
  }
  return null;
}

function readRefreshTokenFromReq(req) {
  const cookieName = getRefreshCookieName();
  const fromParser = req?.cookies?.[cookieName];
  if (fromParser) return String(fromParser).trim();
  const cookieHeader = req?.headers?.cookie;
  return getCookieValueFromHeader(cookieHeader, cookieName);
}

function cookieSecurityOptions(req) {
  const domain = getRefreshCookieDomain();
  return {
    secure: isCookieSecure(req),
    sameSite: 'strict',
    ...(domain ? { domain } : {}),
  };
}

function clearCookieVariants(res, name, { path, httpOnly, sec }) {
  const base = { ...sec, path, httpOnly };
  // Drop domain from base for host-only legacy clear (api.atrium.dev without Domain=).
  const { domain: _domain, ...hostOnly } = base;
  void _domain;
  res.clearCookie(name, hostOnly);
  if (sec.domain) {
    res.clearCookie(name, base);
  }
}

function setRefreshCookie(res, refreshTokenRaw, req) {
  const sec = cookieSecurityOptions(req);
  const refreshName = getRefreshCookieName();
  const refreshPath = getRefreshCookiePath();
  const markerName = getSessionMarkerCookieName();
  const markerPath = getSessionMarkerCookiePath();

  // Avoid duplicate host-only + Domain cookies after migrating to parent domain.
  clearCookieVariants(res, refreshName, { path: refreshPath, httpOnly: true, sec });
  clearCookieVariants(res, markerName, { path: markerPath, httpOnly: false, sec });
  clearCookieVariants(res, markerName, { path: refreshPath, httpOnly: false, sec });

  // Session cookie: không set Max-Age/Expires. Path scoped to auth API only.
  res.cookie(refreshName, refreshTokenRaw, {
    ...sec,
    path: refreshPath,
    httpOnly: true,
  });

  // Marker readable by JS on SPA pages — Path=/ (+ Domain=parent) so document.cookie can see it.
  res.cookie(markerName, SESSION_MARKER_VALUE, {
    ...sec,
    path: markerPath,
    httpOnly: false,
  });
}

/** Chỉ xóa cookie khi refresh invalid thật (thiếu/hết hạn) — không xóa khi mismatch race. */
const {
  shouldClearCookiesOnRefreshFailure,
} = require('./refreshTokenGrace');

function clearRefreshCookie(res, req) {
  const sec = cookieSecurityOptions(req);
  const refreshName = getRefreshCookieName();
  const refreshPath = getRefreshCookiePath();
  const markerName = getSessionMarkerCookieName();
  const markerPath = getSessionMarkerCookiePath();

  clearCookieVariants(res, refreshName, { path: refreshPath, httpOnly: true, sec });
  clearCookieVariants(res, markerName, { path: markerPath, httpOnly: false, sec });
  // Also clear legacy marker that may have been set with Path=/api/auth before this fix.
  clearCookieVariants(res, markerName, { path: refreshPath, httpOnly: false, sec });
}

module.exports = {
  SESSION_MARKER_NAME,
  SESSION_MARKER_VALUE,
  SESSION_MARKER_PATH,
  getRefreshCookieName,
  getRefreshCookiePath,
  getRefreshCookieDomain,
  getSessionMarkerCookieName,
  getSessionMarkerCookiePath,
  isCookieSecure,
  readRefreshTokenFromReq,
  setRefreshCookie,
  clearRefreshCookie,
  shouldClearCookiesOnRefreshFailure,
};
