import authService from './authService';
import { getJwtEmail, getJwtSystemRole, getToken } from '../utils/tokenStorage';
import { mergeAuthUserFromProfile, unwrapApiData } from '../utils/helpers';
import { isAuthRefreshDisabled, refreshAccessTokenSingleFlight } from '../utils/authRefresh';
import { hasSessionMarkerCookie } from '../utils/sessionMarkerCookie';

let inflightRestore = null;

function sessionBaseFromJwt(extra = {}) {
  const systemRole = getJwtSystemRole();
  return {
    email: getJwtEmail() || undefined,
    ...(systemRole ? { systemRole } : {}),
    ...extra,
  };
}

/**
 * Khôi phục phiên sau reload — một flight (StrictMode / tab song song).
 * Chỉ GET /users/me (không bootstrap / shell gom).
 */
export async function restoreAuthSession() {
  let token = getToken();
  if (!token) {
    // Avoid guest spam POST /auth/refresh-token when no session marker (HttpOnly refresh alone is invisible to JS).
    if (!isAuthRefreshDisabled() && hasSessionMarkerCookie()) {
      try {
        await refreshAccessTokenSingleFlight();
      } catch {
        // Silent restore: fail is OK; we'll return guest session.
      }
    }
    token = getToken();
    if (!token) return { user: null };
  }

  if (inflightRestore) {
    return inflightRestore;
  }

  inflightRestore = (async () => {
    const userData = await authService.getCurrentUser();
    const profile = unwrapApiData(userData) || userData;
    return {
      user: mergeAuthUserFromProfile(sessionBaseFromJwt(), profile),
    };
  })();

  try {
    return await inflightRestore;
  } finally {
    inflightRestore = null;
  }
}

export async function restoreAuthSessionAfterLogin(loginUser) {
  const base = mergeAuthUserFromProfile(sessionBaseFromJwt(), loginUser || {});
  try {
    const me = await authService.getCurrentUser();
    return mergeAuthUserFromProfile(base, unwrapApiData(me) || me);
  } catch {
    return base;
  }
}
