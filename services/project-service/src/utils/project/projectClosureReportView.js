/**
 * Opt-in projection for closure report dashboard (GET /projects/:id?view=closure-report).
 * Whitelist only — no boards / workflow / uat dumps / technicalSetup.
 */

const CLOSURE_REPORT_VIEW_ALIASES = new Set(['closure-report', 'closurereport']);

/** Keys allowed on the shaped payload (top-level). */
const CLOSURE_REPORT_ALLOW_KEYS = [
  '_id',
  'id',
  'title',
  'projectCode',
  'status',
  'closedAt',
  'closedBy',
  'deliveryPhase',
  'organizationId',
  'isActive',
  'closureSnapshot',
];

function isClosureReportView(view) {
  return CLOSURE_REPORT_VIEW_ALIASES.has(String(view || '').trim().toLowerCase());
}

/**
 * @param {object} payload — full getProject result
 * @returns {object}
 */
function toProjectClosureReportView(payload) {
  const src = payload && typeof payload === 'object' ? payload : {};
  const out = {};
  for (const key of CLOSURE_REPORT_ALLOW_KEYS) {
    if (Object.prototype.hasOwnProperty.call(src, key)) {
      out[key] = src[key];
    }
  }
  if (out._id == null && src.id != null) out._id = src.id;
  if (out.closureSnapshot != null && typeof out.closureSnapshot !== 'object') {
    out.closureSnapshot = null;
  }
  return out;
}

module.exports = {
  isClosureReportView,
  toProjectClosureReportView,
  CLOSURE_REPORT_VIEW_ALIASES,
  CLOSURE_REPORT_ALLOW_KEYS,
};
