/**
 * Per-node context allowlist. Workers do not receive the full snapshot.
 */

const SLICE_SPEC = Object.freeze({
  WbsTool: {
    allow: ['stories', 'acceptanceCriteria', 'functionalRequirements', 'architecture'],
    deny: ['risk', 'quality', 'dependency'],
  },
  DependencyTool: {
    allow: ['tasks', 'architecture', 'integrationEvidence'],
    deny: ['risk', 'quality'],
  },
  RiskToolSource: {
    allow: ['capabilities', 'gaps', 'functionalRequirements'],
    deny: ['dependency', 'deps', 'blockingDeps', 'quality'],
  },
  RiskToolDependency: {
    allow: ['dependencyEdges', 'taskIds'],
    deny: ['quality'],
  },
  ScheduleTool: {
    allow: ['estimatedHours', 'calendar', 'assignments', 'dependency'],
    deny: ['risk'],
  },
  WhatSection: {
    allow: ['normalizedSource', 'snapshotId'],
    deny: ['sectionProposals'],
  },
});

function specFor(nodeId) {
  if (String(nodeId || '').startsWith('What')) return SLICE_SPEC.WhatSection;
  return SLICE_SPEC[nodeId] || { allow: [], deny: [] };
}

/**
 * @param {string} nodeId
 * @param {object} source
 * @returns {object}
 */
function buildContextSlice(nodeId, source = {}) {
  const spec = specFor(nodeId);
  const slice = {};
  for (const key of spec.allow) {
    if (source[key] !== undefined) slice[key] = source[key];
  }
  for (const key of spec.deny) {
    if (slice[key] !== undefined) delete slice[key];
  }
  return slice;
}

function sliceContainsDenied(nodeId, slice = {}) {
  const spec = specFor(nodeId);
  return spec.deny.some((key) => slice[key] != null);
}

module.exports = {
  SLICE_SPEC,
  specFor,
  buildContextSlice,
  sliceContainsDenied,
};
