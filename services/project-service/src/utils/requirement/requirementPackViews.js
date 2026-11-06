/**
 * GET /projects/requirements/:packId?view=
 * - full (default): lean pack + liveRun + ensurePackPreviewViews (excelPreview)
 * - wizard: slim create-wizard projection
 * - hitl: AI HITL Monitor/Review — Mongo projection + scrub FAILED AI dumps
 */

const { PACK_HITL_EXCLUDE } = require('./requirementPackHitlQuery');

function normalizePackView(view) {
  const v = String(view || 'full').trim().toLowerCase();
  if (v === 'wizard') return 'wizard';
  if (v === 'hitl') return 'hitl';
  return 'full';
}

module.exports = {
  PACK_HITL_EXCLUDE,
  normalizePackView,
};
