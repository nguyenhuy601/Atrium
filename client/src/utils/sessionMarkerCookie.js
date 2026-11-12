/** Non-HttpOnly marker — JS detect "has session" without reading the refresh token. */
export const SESSION_MARKER_COOKIE = 'vh_has_session';

/** localStorage twin — survives F5 on split-host when cookie Domain is api-only. */
export const SESSION_MARKER_STORAGE_KEY = 'vh_has_session';

function readDocumentCookieHasMarker() {
  if (typeof document === 'undefined') return false;
  try {
    const raw = String(document.cookie || '');
    return raw.split(';').some((part) => {
      const [name, ...rest] = part.trim().split('=');
      if (String(name || '').trim() !== SESSION_MARKER_COOKIE) return false;
      const value = decodeURIComponent(rest.join('=').trim());
      return value === '1' || value === 'true';
    });
  } catch {
    return false;
  }
}

function readStorageHasMarker() {
  if (typeof localStorage === 'undefined') return false;
  try {
    const value = String(localStorage.getItem(SESSION_MARKER_STORAGE_KEY) || '').trim();
    return value === '1' || value === 'true';
  } catch {
    return false;
  }
}

/** True when non-HttpOnly marker cookie is present (set alongside refresh HttpOnly cookie). */
export function hasSessionMarkerCookie() {
  return readDocumentCookieHasMarker();
}

/** Cookie hoặc localStorage — gate gọi refresh sau reload (không phải secret). */
export function hasSessionMarker() {
  return readDocumentCookieHasMarker() || readStorageHasMarker();
}

/** Ghi marker local khi login/refresh thành công (access JWT vào memory). */
export function markSessionPresent() {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(SESSION_MARKER_STORAGE_KEY, '1');
  } catch {
    /* ignore */
  }
}

/** Clear leftover marker so restoreAuthSession does not spam POST /auth/refresh-token. */
export function clearSessionMarkerCookie() {
  if (typeof document !== 'undefined') {
    const expire = `${SESSION_MARKER_COOKIE}=; Path=/; Max-Age=0; SameSite=Strict`;
    document.cookie = expire;
    if (typeof window !== 'undefined' && window.location?.protocol === 'https:') {
      document.cookie = `${expire}; Secure`;
    }
  }
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(SESSION_MARKER_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }
}
