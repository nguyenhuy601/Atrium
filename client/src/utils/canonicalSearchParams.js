/**
 * Canonical suite search — only write query keys when they differ from resolvable defaults.
 */

/**
 * @param {string} boardId
 * @param {string} defaultBoardId
 * @returns {boolean}
 */
export function shouldWriteBoardId(boardId, defaultBoardId = '') {
  const bid = String(boardId || '').trim();
  if (!bid) return false;
  const def = String(defaultBoardId || '').trim();
  if (!def) return true;
  return bid !== def;
}

/**
 * Omit packId when project has exactly one linked pack and it matches.
 * @param {string} packId
 * @param {{ linkedPackId?: string, packCount?: number }} ctx
 * @returns {boolean}
 */
export function shouldWritePackId(packId, { linkedPackId = '', packCount = 0 } = {}) {
  const pid = String(packId || '').trim();
  if (!pid) return false;
  const linked = String(linkedPackId || '').trim();
  const count = Number(packCount) || 0;
  if (count === 1 && linked && pid === linked) return false;
  if (count === 1 && !linked) return false;
  if (linked && pid === linked && count <= 1) return false;
  return true;
}

/**
 * Build URLSearchParams from candidates, skipping empty / default-omitted keys.
 * @param {Record<string, string|undefined|null>} candidates
 * @param {{
 *   defaultBoardId?: string,
 *   linkedPackId?: string,
 *   packCount?: number,
 * }} [opts]
 * @returns {URLSearchParams}
 */
export function applyCanonicalSearch(candidates = {}, opts = {}) {
  const next = new URLSearchParams();
  const defaultBoardId = String(opts.defaultBoardId || '').trim();
  const linkedPackId = String(opts.linkedPackId || '').trim();
  const packCount = Number(opts.packCount) || 0;

  for (const [key, raw] of Object.entries(candidates || {})) {
    const value = String(raw ?? '').trim();
    if (!value) continue;
    if (key === 'organizationId' || key === 'orgId' || key === 'from' || key === 'tab') continue;
    if (key === 'boardId' && !shouldWriteBoardId(value, defaultBoardId)) continue;
    if (key === 'packId' && !shouldWritePackId(value, { linkedPackId, packCount })) continue;
    next.set(key, value);
  }
  return next;
}

/**
 * Merge onto existing search, applying omit rules for board/pack; strips tab.
 * @param {string|URLSearchParams} currentSearch
 * @param {Record<string, string|undefined|null>} patch
 * @param {object} [opts]
 * @returns {URLSearchParams}
 */
export function mergeCanonicalSearch(currentSearch, patch = {}, opts = {}) {
  const current =
    currentSearch instanceof URLSearchParams
      ? new URLSearchParams(currentSearch)
      : new URLSearchParams(String(currentSearch || '').replace(/^\?/, ''));
  current.delete('tab');
  current.delete('organizationId');
  current.delete('orgId');

  const merged = { ...Object.fromEntries(current.entries()), ...patch };
  return applyCanonicalSearch(merged, opts);
}

/**
 * @param {URLSearchParams} params
 * @returns {string} query string with leading `?` or empty
 */
export function toSearchString(params) {
  const qs = params instanceof URLSearchParams ? params.toString() : String(params || '');
  return qs ? `?${qs}` : '';
}
