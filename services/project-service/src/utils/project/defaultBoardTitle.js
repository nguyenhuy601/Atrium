/**
 * Default Kanban board title = project name, then projectCode.
 * Explicit title from client wins when non-empty (except legacy placeholder PRJ).
 */

const FALLBACK_BOARD_TITLE = 'Board';

/**
 * @param {unknown} projectCode
 * @param {unknown} [projectTitle]
 * @returns {string}
 */
function resolveDefaultBoardTitle(projectCode, projectTitle) {
  const name = String(projectTitle || '').trim();
  if (name) return name.slice(0, 120);
  const code = String(projectCode || '').trim();
  return code || FALLBACK_BOARD_TITLE;
}

/**
 * @param {{ title?: unknown, projectCode?: unknown, projectTitle?: unknown }} [opts]
 * @returns {string}
 */
function resolveBoardTitle(opts = {}) {
  const explicit = String(opts.title || '').trim();
  if (explicit && !/^prj$/i.test(explicit)) return explicit;
  return resolveDefaultBoardTitle(opts.projectCode, opts.projectTitle);
}

module.exports = {
  FALLBACK_BOARD_TITLE,
  resolveDefaultBoardTitle,
  resolveBoardTitle,
};
