/**
 * Clear HOW container slices for tools in forceRerunSet so APS will re-execute them.
 */

/**
 * @param {object} container
 * @param {string[]} forceRerunSet
 * @returns {{ container: object, cleared: string[] }}
 */
function invalidateHowArtifacts(container, forceRerunSet = []) {
  const base = container && typeof container === 'object' ? { ...container } : {};
  const set = new Set(
    (Array.isArray(forceRerunSet) ? forceRerunSet : [])
      .map((n) => String(n || '').trim())
      .filter(Boolean)
  );
  const cleared = [];
  if (!set.size) return { container: base, cleared };

  const analyses = { ...(base.analyses || {}) };
  const planning = { ...(base.planning || {}) };
  const resource = { ...(base.resource || {}) };

  if (set.has('WbsTool')) {
    // Drop leaf tasks / live wbs tree so hasWbsLeavesInContainer cannot mark Wbs done.
    if (Array.isArray(planning.tasks) && planning.tasks.length) {
      planning.tasks = [];
      cleared.push('planning.tasks');
    }
    if (planning.wbs != null) {
      delete planning.wbs;
      cleared.push('planning.wbs');
    }
    if (planning.wbsTree != null) {
      delete planning.wbsTree;
      cleared.push('planning.wbsTree');
    }
    if (planning.wbsBaselineRevisionId != null) {
      delete planning.wbsBaselineRevisionId;
      cleared.push('planning.wbsBaselineRevisionId');
    }
    // Keep revisions history but mark tip non-current so stamp can create a new hash tip.
    if (Array.isArray(planning.revisions?.wbs) && planning.revisions.wbs.length) {
      const wbsRevs = planning.revisions.wbs.map((r) =>
        r && r.status === 'current' ? { ...r, status: 'superseded' } : r
      );
      planning.revisions = { ...(planning.revisions || {}), wbs: wbsRevs };
      cleared.push('planning.revisions.wbs:superseded');
    }
  }

  if (set.has('DependencyTool') && analyses.dependency != null) {
    delete analyses.dependency;
    cleared.push('analyses.dependency');
  }
  if (set.has('ScheduleTool')) {
    if (analyses.schedule != null) {
      delete analyses.schedule;
      cleared.push('analyses.schedule');
    }
    if (analyses.assignment != null) {
      delete analyses.assignment;
      cleared.push('analyses.assignment');
    }
    if (resource.schedule != null) {
      delete resource.schedule;
      cleared.push('resource.schedule');
    }
  }
  if (set.has('RiskTool')) {
    if (analyses.risk != null) {
      delete analyses.risk;
      cleared.push('analyses.risk');
    }
    if (analyses.risks != null) {
      delete analyses.risks;
      cleared.push('analyses.risks');
    }
  }
  if (set.has('QualityPlanTool') && analyses.quality != null) {
    delete analyses.quality;
    cleared.push('analyses.quality');
  }

  // Drop succeeded executions for tools in set so succeededValidatedTools won't mark done.
  const phaseHow = base.phaseRuns?.phase_how;
  if (phaseHow && Array.isArray(phaseHow.toolExecutions) && phaseHow.toolExecutions.length) {
    const nextExec = phaseHow.toolExecutions.map((row) => {
      const name = String(row?.toolName || '').trim();
      if (!name || !set.has(name)) return row;
      return {
        ...row,
        status: 'superseded',
        outputValidated: false,
        supersededAt: new Date().toISOString(),
      };
    });
    base.phaseRuns = {
      ...(base.phaseRuns || {}),
      phase_how: { ...phaseHow, toolExecutions: nextExec },
    };
    cleared.push('phase_how.toolExecutions:superseded');
  }

  base.analyses = analyses;
  base.planning = planning;
  base.resource = resource;
  return { container: base, cleared };
}

module.exports = { invalidateHowArtifacts };
