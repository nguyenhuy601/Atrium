/**
 * Wave 5d — FR/AC/UC change after baseline → mark review + CR draft payload.
 */

/**
 * @param {{ beforeKeys: string[], afterKeys: string[], kind: 'FR'|'AC'|'UC' }} diff
 */
function diffRequirementKeys({ beforeKeys = [], afterKeys = [], kind = 'FR' } = {}) {
  const before = new Set((beforeKeys || []).map(String));
  const after = new Set((afterKeys || []).map(String));
  const added = [...after].filter((k) => !before.has(k));
  const removed = [...before].filter((k) => !after.has(k));
  return {
    kind,
    changed: added.length > 0 || removed.length > 0,
    added,
    removed,
  };
}

/**
 * Build CR draft fields (does not persist — service layer creates CR).
 */
function buildScopeChangeCrDraft({
  projectId,
  diffs = [],
  workItemIds = [],
  titlePrefix = 'Scope change detected',
} = {}) {
  const parts = (diffs || [])
    .filter((d) => d.changed)
    .map((d) => `${d.kind}: +${(d.added || []).length}/-${(d.removed || []).length}`);
  return {
    title: `${titlePrefix}: ${parts.join(', ') || 'artifact revision'}`.slice(0, 240),
    description: 'Auto-detected requirement change after baseline. Review before applying baseline update.',
    type: 'scope',
    reason: 'execution_control_scope_change',
    workItemIds,
    impact: {
      summary: parts.join('; '),
      diffs,
    },
    marks: {
      artifactsNeedReview: true,
      baselineOverwriteBlocked: true,
    },
    projectId,
  };
}

module.exports = {
  diffRequirementKeys,
  buildScopeChangeCrDraft,
};
