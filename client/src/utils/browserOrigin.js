/**
 * URL API / signaling — hỗ trợ split-host (apex FE, api.$DOMAIN gateway).
 * Absolute VITE_API_URL thắng; relative/empty → `/api` (Vite proxy hoặc same-origin cố ý).
 */

function trimEnv(value) {
  return String(value || '').trim();
}

function stripTrailingSlashes(url) {
  return String(url || '').replace(/\/+$/, '');
}

/** Origin từ absolute API base (vd. https://api.atrium.dev/api → https://api.atrium.dev). */
export function originFromApiBase(apiBase) {
  const raw = trimEnv(apiBase);
  if (!raw.startsWith('http://') && !raw.startsWith('https://')) return '';
  try {
    const u = new URL(raw);
    return u.origin;
  } catch {
    return stripTrailingSlashes(raw.replace(/\/api\/?$/, ''));
  }
}

/**
 * Pure resolver — truyền env bag để unit test (không cần Vite).
 * @param {{ VITE_API_URL?: string }} env
 */
export function resolveApiBaseUrlFromEnv(env = {}) {
  const raw = trimEnv(env.VITE_API_URL);
  if (!raw) return '/api';
  if (raw.startsWith('/')) return raw;
  return stripTrailingSlashes(raw);
}

/** Base path/URL cho axios. */
export function resolveApiBaseUrl() {
  return resolveApiBaseUrlFromEnv(import.meta.env);
}

export function isRelativeApiBase() {
  const v = trimEnv(import.meta.env.VITE_API_URL);
  return !v || v.startsWith('/');
}

/** Origin UI đang mở — gửi kèm auth API để link email đúng host. */
export function getBrowserFrontendOrigin() {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return stripTrailingSlashes(window.location.origin);
  }
  return '';
}

/**
 * Origin gateway / voice signaling (api host khi split-domain).
 * Ưu tiên: VITE_VOICE_SIGNAL_URL → VITE_SOCKET_URL → absolute VITE_API_URL origin → window.
 * @param {{
 *   VITE_VOICE_SIGNAL_URL?: string,
 *   VITE_SOCKET_URL?: string,
 *   VITE_API_URL?: string,
 * }} env
 * @param {{ locationOrigin?: string }} [opts]
 */
export function resolveAppOriginFromEnv(env = {}, opts = {}) {
  const voice = trimEnv(env.VITE_VOICE_SIGNAL_URL);
  if (voice) return stripTrailingSlashes(voice);

  const socket = trimEnv(env.VITE_SOCKET_URL);
  if (socket) return stripTrailingSlashes(socket);

  const fromApi = originFromApiBase(resolveApiBaseUrlFromEnv(env));
  if (fromApi) return fromApi;

  const loc = trimEnv(opts.locationOrigin);
  if (loc) return stripTrailingSlashes(loc);
  return '';
}

export function resolveAppOrigin() {
  const locationOrigin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : '';
  return resolveAppOriginFromEnv(import.meta.env, { locationOrigin });
}
