/**
 * AI HITL path-tab SoT — monitor = /ai-hitl, review = /ai-hitl/review.
 * Query `tab` is legacy only (redirect).
 */

import { applyCanonicalSearch, toSearchString } from './canonicalSearchParams.js';

export const AI_HITL_TAB = {
  MONITOR: 'monitor',
  REVIEW: 'review',
};

/** Local path join — avoid circular import with suitePathUtils. */
function projectsHitlBase(projectId, tabSeg = '') {
  const pid = encodeURIComponent(String(projectId || '').trim());
  const extra = String(tabSeg || '').replace(/^\/+/, '');
  return extra ? `/projects/${pid}/ai-hitl/${extra}` : `/projects/${pid}/ai-hitl`;
}

/**
 * @param {string} raw
 * @returns {'monitor'|'review'}
 */
export function normalizeAiHitlTab(raw) {
  const t = String(raw || '')
    .trim()
    .toLowerCase();
  return t === AI_HITL_TAB.REVIEW ? AI_HITL_TAB.REVIEW : AI_HITL_TAB.MONITOR;
}

/**
 * Parse tab from pathname (.../ai-hitl or .../ai-hitl/review|monitor).
 * @param {string} pathname
 * @returns {'monitor'|'review'|null} null if not an ai-hitl path
 */
export function parseAiHitlTabFromPath(pathname = '') {
  const path = String(pathname || '').replace(/\/+/g, '/');
  const m = path.match(/\/projects\/[^/]+\/ai-hitl(?:\/([^/?#]+))?\/?$/i);
  if (!m) return null;
  const seg = String(m[1] || '')
    .trim()
    .toLowerCase();
  if (!seg || seg === AI_HITL_TAB.MONITOR) return AI_HITL_TAB.MONITOR;
  if (seg === AI_HITL_TAB.REVIEW) return AI_HITL_TAB.REVIEW;
  return AI_HITL_TAB.MONITOR;
}

/**
 * Build canonical HITL path (no ?tab=).
 * @param {string} projectId
 * @param {{
 *   tab?: string,
 *   boardId?: string,
 *   packId?: string,
 *   startWhat?: string|number|boolean,
 *   defaultBoardId?: string,
 *   linkedPackId?: string,
 *   packCount?: number,
 * }} [query]
 * @returns {string}
 */
export function buildAiHitlPath(projectId, query = {}) {
  const pid = String(projectId || '').trim();
  if (!pid) return '/projects';
  const tab = normalizeAiHitlTab(query?.tab);
  const base = projectsHitlBase(pid, tab === AI_HITL_TAB.REVIEW ? 'review' : '');
  const startRaw = query?.startWhat;
  const startWhat =
    startRaw === true || startRaw === 1 || startRaw === '1' ? '1' : String(startRaw || '').trim();
  const params = applyCanonicalSearch(
    {
      boardId: query?.boardId,
      packId: query?.packId,
      startWhat,
    },
    {
      defaultBoardId: query?.defaultBoardId,
      linkedPackId: query?.linkedPackId,
      packCount: query?.packCount,
    }
  );
  return `${base}${toSearchString(params)}`;
}

function projectIdFromHitlPath(pathname = '') {
  const m = String(pathname || '').match(/\/projects\/([^/]+)\/ai-hitl/i);
  if (!m) return '';
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return String(m[1] || '');
  }
}

/**
 * If URL has legacy ?tab= or /ai-hitl/monitor, return canonical path+search.
 * @param {string} pathname
 * @param {string} [search]
 * @returns {string|null}
 */
export function legacyHitlTabQueryRedirect(pathname = '', search = '') {
  const path = String(pathname || '').replace(/\/+/g, '/');
  if (parseAiHitlTabFromPath(path) == null) return null;

  const pid = projectIdFromHitlPath(path);
  if (!pid) return null;

  const params = new URLSearchParams(String(search || '').replace(/^\?/, ''));
  const legacyTab = String(params.get('tab') || '')
    .trim()
    .toLowerCase();
  const pathIsMonitorAlias = /\/ai-hitl\/monitor\/?$/i.test(path);
  if (!legacyTab && !pathIsMonitorAlias) return null;

  const pathTab = parseAiHitlTabFromPath(path) || AI_HITL_TAB.MONITOR;
  const desired = normalizeAiHitlTab(legacyTab || pathTab);
  params.delete('tab');

  return buildAiHitlPath(pid, {
    tab: desired,
    boardId: params.get('boardId') || '',
    packId: params.get('packId') || '',
    startWhat: params.get('startWhat') || '',
  });
}

/**
 * Normalize any in-app path that points at ai-hitl with ?tab= to path-tab form.
 * @param {string} pathWithOptionalSearch
 * @returns {string}
 */
export function normalizeAiHitlActionPath(pathWithOptionalSearch = '') {
  const raw = String(pathWithOptionalSearch || '').trim();
  if (!raw) return raw;
  const qIdx = raw.indexOf('?');
  const pathname = qIdx >= 0 ? raw.slice(0, qIdx) : raw;
  const search = qIdx >= 0 ? raw.slice(qIdx) : '';
  if (!/\/ai-hitl/i.test(pathname)) return raw;

  const params = new URLSearchParams(search.replace(/^\?/, ''));
  const legacyTab = String(params.get('tab') || '').trim();
  const pathTab = parseAiHitlTabFromPath(pathname) || AI_HITL_TAB.MONITOR;
  const tab = normalizeAiHitlTab(legacyTab || pathTab);
  params.delete('tab');

  const pid = projectIdFromHitlPath(pathname);
  if (!pid) return raw;
  return buildAiHitlPath(pid, {
    tab,
    boardId: params.get('boardId') || '',
    packId: params.get('packId') || '',
    startWhat: params.get('startWhat') || '',
  });
}
