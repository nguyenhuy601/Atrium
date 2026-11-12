/** Cửa sổ chấp nhận refresh token vừa bị rotate (race multi-tab / 401 storm). */
const DEFAULT_PREVIOUS_GRACE_MS = 90_000;

function previousRefreshGraceMs() {
  const raw = Number(process.env.AUTH_REFRESH_PREVIOUS_GRACE_MS);
  if (Number.isFinite(raw) && raw >= 0) return raw;
  return DEFAULT_PREVIOUS_GRACE_MS;
}

function previousRefreshStillValid(userAuth, now = new Date()) {
  const prev = String(userAuth?.previousRefreshToken || '').trim();
  if (!prev) return false;
  const expiresAt = userAuth?.previousRefreshTokenExpiresAt;
  if (!expiresAt) return false;
  const expMs = new Date(expiresAt).getTime();
  if (!Number.isFinite(expMs)) return false;
  return expMs > now.getTime();
}

/**
 * Có clear cookie khi refresh thất bại?
 * AUTH_REFRESH_MISMATCH = race rotate — clear sẽ xóa cookie mới trên cùng browser.
 */
function shouldClearCookiesOnRefreshFailure(error) {
  const code = String(error?.errorCode || '').trim();
  if (code === 'AUTH_REFRESH_MISMATCH') return false;
  if (code === 'AUTH_REFRESH_INVALID') return true;
  const reason = String(error?.refreshFailureReason || '').trim();
  if (reason === 'mismatch') return false;
  return code === 'AUTH_REFRESH_INVALID';
}

module.exports = {
  DEFAULT_PREVIOUS_GRACE_MS,
  previousRefreshGraceMs,
  previousRefreshStillValid,
  shouldClearCookiesOnRefreshFailure,
};
