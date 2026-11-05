/**
 * WHAT FR revision stamp + auto-pin after WhatFrTool (no human confirm gate).
 */

const {
  buildArtifactRevision,
  extractFrContent,
  appendRequirementsArtifactRevision,
  getCurrentRequirementsRevisionId,
  ORIGINS,
} = require('./artifactRevision');

/**
 * @param {object} container
 */
function getFrBaselineRevisionId(container) {
  const id = container?.requirements?.frBaselineRevisionId;
  return id ? String(id) : null;
}

/**
 * After WhatFrTool success — stamp immutable FR revision (idempotent by contentHash).
 * @param {object} container
 * @param {{ runId?: string, toolName?: string, createdBy?: string|null, srsProposal?: object|null }} [meta]
 */
function stampFrRevisionAfterTool(container, meta = {}) {
  const content = extractFrContent(container, meta.srsProposal || null);
  const existingId = getCurrentRequirementsRevisionId(container, 'fr');
  const { hashRevisionContent } = require('./revisionIds');
  const hash = hashRevisionContent(content);
  const list = container?.requirements?.revisions?.fr;
  if (Array.isArray(list) && list.length) {
    const tip = [...list].reverse().find((r) => r?.status === 'current') || list[list.length - 1];
    if (tip?.contentHash === hash) {
      return { container, revision: tip, created: false };
    }
  }
  if (!content.frCount && !existingId) {
    return { container, revision: null, created: false };
  }
  const revision = buildArtifactRevision({
    kind: 'fr',
    artifactId: 'fr-01',
    parentRevisionId: existingId,
    origin: ORIGINS.AI_GENERATED,
    content,
    runId: meta.runId || null,
    toolName: meta.toolName || 'WhatFrTool',
    createdBy: meta.createdBy || null,
    provenance: {
      origin: ORIGINS.AI_GENERATED,
      runId: meta.runId || null,
      toolName: meta.toolName || 'WhatFrTool',
      inputRevisionId: null,
      outputValidated: true,
    },
  });
  const next = appendRequirementsArtifactRevision(container, revision);
  return { container: next, revision, created: true };
}

/**
 * Auto-pin FR baseline after WhatFrTool (idempotent if already same id).
 * @param {object} container
 * @param {{ revisionId?: string|null, actorUserId?: string|null, requestId?: string|null }} opts
 */
function pinFrBaseline(container, opts = {}) {
  const base = container && typeof container === 'object' ? { ...container } : {};
  const requirements = { ...(base.requirements || {}) };
  const revisionId =
    String(opts.revisionId || '').trim() ||
    getCurrentRequirementsRevisionId(base, 'fr') ||
    null;
  if (!revisionId) {
    const err = new Error('Cannot pin FR baseline — no fr revision');
    err.code = 'FR_REVISION_MISSING';
    err.statusCode = 400;
    throw err;
  }
  if (requirements.frBaselineRevisionId === revisionId) {
    return { container: base, revisionId, duplicated: true };
  }
  requirements.frBaselineRevisionId = revisionId;
  requirements.frBaselinePinnedAt = new Date().toISOString();
  requirements.frBaselinePinnedBy = opts.actorUserId || null;
  if (opts.requestId) {
    requirements.frBaselinePinRequestId = String(opts.requestId);
  }
  base.requirements = requirements;
  return { container: base, revisionId, duplicated: false };
}

module.exports = {
  getFrBaselineRevisionId,
  stampFrRevisionAfterTool,
  pinFrBaseline,
  extractFrContent,
};
