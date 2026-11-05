/** Closed WBS level catalog for Gate2 "Sửa" selects + UI indent sync. */

export const GATE2_WBS_LEVELS = Object.freeze([
  'epic',
  'feature',
  'story',
  'work_package',
  'task',
]);

/** Visual indent steps when Level changes in edit mode (Epic → Task). */
export const GATE2_WBS_LEVEL_DEPTH = Object.freeze({
  epic: 0,
  feature: 1,
  story: 2,
  work_package: 3,
  task: 4,
});

const WBS_CONTAINER_LEVELS = new Set(['epic', 'feature', 'story', 'work_package']);

const WBS_LEVEL_LABELS = Object.freeze({
  epic: 'Epic',
  feature: 'Feature',
  story: 'Story',
  work_package: 'Work package',
  task: 'Task',
});

function tr(t, key, fallback) {
  const value = typeof t === 'function' ? t(key) : '';
  if (value == null || value === '' || value === key) return fallback;
  return value;
}

/**
 * Effective WBS level from row + optional editedPayload (edit mode).
 * @param {object} row
 * @param {object|null|undefined} editedPayload
 * @returns {string}
 */
export function resolveWbsEffectiveLevel(row, editedPayload) {
  if (editedPayload && Object.prototype.hasOwnProperty.call(editedPayload, 'level')) {
    return String(editedPayload.level || '')
      .trim()
      .toLowerCase();
  }
  return String(row?.level || '')
    .trim()
    .toLowerCase();
}

/**
 * Indent depth for WBS title UI. Tree depth stays until Level is edited;
 * patchWbsCatalogValue then stamps depth from the level catalog.
 * @param {object} row
 * @param {object|null|undefined} editedPayload
 * @returns {number}
 */
export function resolveWbsUiDepth(row, editedPayload) {
  if (editedPayload && Object.prototype.hasOwnProperty.call(editedPayload, 'depth')) {
    return Math.max(0, Math.min(8, Number(editedPayload.depth) || 0));
  }
  return Math.max(0, Math.min(8, Number(row?.depth) || 0));
}

/** Select options for WBS Level column. */
export function wbsLevelSelectOptions(t) {
  return GATE2_WBS_LEVELS.map((level) => ({
    value: level,
    label: tr(t, `requirements.gate2WbsLevel_${level}`, WBS_LEVEL_LABELS[level] || level),
  }));
}

/**
 * When Level changes, keep UI depth / container flags in sync with the catalog.
 * Other fields fall through to a plain merge.
 */
export function patchWbsCatalogValue(row, field, prev, value) {
  const base = { ...(prev && typeof prev === 'object' ? prev : {}) };
  if (field !== 'level') {
    base[field] = value;
    return base;
  }
  const level = String(value || '')
    .trim()
    .toLowerCase();
  base.level = level;
  if (Object.prototype.hasOwnProperty.call(GATE2_WBS_LEVEL_DEPTH, level)) {
    base.depth = GATE2_WBS_LEVEL_DEPTH[level];
    base.isWbsContainer = WBS_CONTAINER_LEVELS.has(level);
  }
  return base;
}

export function isWbsContainerLevel(level) {
  return WBS_CONTAINER_LEVELS.has(String(level || '').trim().toLowerCase());
}
