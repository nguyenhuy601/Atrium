import { lazy } from 'react';

/** sessionStorage — chặn reload vòng trong cửa sổ ngắn sau 1 lần force refresh. */
export const CHUNK_FORCE_REFRESH_KEY = 'atrium:chunk-force-refresh';

/** Không auto-reload lại trong khoảng này (ms) sau lần force gần nhất. */
const CHUNK_FORCE_COOLDOWN_MS = 15_000;

export function isChunkLoadError(error) {
  const msg = String(error?.message || error || '');
  return /Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk [\d]+ failed|error loading dynamically imported module|CSS_CHUNK_LOAD_FAILED/i.test(
    msg
  );
}

export function clearChunkForceRefresh() {
  try {
    sessionStorage.removeItem(CHUNK_FORCE_REFRESH_KEY);
  } catch {
    /* ignore */
  }
}

export function wasChunkForceRefreshedRecently() {
  try {
    const raw = sessionStorage.getItem(CHUNK_FORCE_REFRESH_KEY);
    if (!raw) return false;
    const ts = Number(raw);
    if (!Number.isFinite(ts)) {
      clearChunkForceRefresh();
      return false;
    }
    if (Date.now() - ts > CHUNK_FORCE_COOLDOWN_MS) {
      clearChunkForceRefresh();
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function markChunkForceRefresh() {
  try {
    sessionStorage.setItem(CHUNK_FORCE_REFRESH_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

/**
 * `React.lazy` + soft-retry + 1 hard reload (cooldown) khi Vite/HMR chunk fail.
 * @param {() => Promise<{ default: import('react').ComponentType<any> }>} factory
 */
export function lazyWithRetry(factory) {
  return lazy(async () => {
    try {
      const mod = await factory();
      clearChunkForceRefresh();
      return mod;
    } catch (error) {
      if (isChunkLoadError(error) && !wasChunkForceRefreshedRecently()) {
        markChunkForceRefresh();
        window.location.reload();
        return { default: function ChunkReloadPlaceholder() { return null; } };
      }

      await new Promise((r) => setTimeout(r, 400));
      return factory();
    }
  });
}
