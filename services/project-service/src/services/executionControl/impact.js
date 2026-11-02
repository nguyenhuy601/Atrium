/**
 * Dependency + capacity impact adapters.
 * MVP: FULL only for FS (+ lag). Other types → PARTIAL_IMPACT / UNSUPPORTED.
 * Sprint Goal impact requires Story↔Goal evidence (RULE-EC-05).
 */

const SUPPORTED_FULL = new Set(['FS']);

/**
 * @param {Array<{ predecessorId: string, successorId?: string, type?: string, lagHours?: number }>} edges
 * @param {string} subjectTaskId
 * @returns {{
 *   impactStatus: 'FULL'|'PARTIAL_IMPACT'|'UNSUPPORTED',
 *   affectedTaskIds: string[],
 *   skippedEdges: object[],
 *   fsChain: string[],
 * }}
 */
function analyzeDependencyImpact(edges, subjectTaskId) {
  const list = Array.isArray(edges) ? edges : [];
  const subject = String(subjectTaskId || '');
  if (!subject || !list.length) {
    return {
      impactStatus: 'FULL',
      affectedTaskIds: [],
      skippedEdges: [],
      fsChain: [],
    };
  }

  const skippedEdges = [];
  const fsEdges = [];
  for (const e of list) {
    const type = String(e.type || 'FS').toUpperCase();
    if (!SUPPORTED_FULL.has(type)) {
      skippedEdges.push({
        predecessorId: String(e.predecessorId || ''),
        successorId: String(e.successorId || ''),
        type,
        reason: 'UNSUPPORTED_TYPE',
      });
      continue;
    }
    fsEdges.push({
      predecessorId: String(e.predecessorId || ''),
      successorId: String(e.successorId || ''),
      lagHours: Number(e.lagHours) || 0,
      type: 'FS',
    });
  }

  // BFS successors from subject as predecessor
  const adj = new Map();
  for (const e of fsEdges) {
    if (!adj.has(e.predecessorId)) adj.set(e.predecessorId, []);
    adj.get(e.predecessorId).push(e.successorId);
  }
  const affected = [];
  const seen = new Set([subject]);
  const queue = [subject];
  while (queue.length) {
    const cur = queue.shift();
    for (const nxt of adj.get(cur) || []) {
      if (seen.has(nxt)) continue;
      seen.add(nxt);
      affected.push(nxt);
      queue.push(nxt);
    }
  }

  let impactStatus = 'FULL';
  if (skippedEdges.length && !fsEdges.length) impactStatus = 'UNSUPPORTED';
  else if (skippedEdges.length) impactStatus = 'PARTIAL_IMPACT';

  return {
    impactStatus,
    affectedTaskIds: affected,
    skippedEdges,
    fsChain: [subject, ...affected],
  };
}

/**
 * Block actions that depend on unverified impact parts (RULE-EC-14).
 * @param {object} impact
 * @param {Array<{ actionId: string, requiresFullImpact?: boolean, dependsOnImpact?: boolean }>} actions
 */
function filterActionsByImpact(impact, actions = []) {
  const status = impact?.impactStatus || 'FULL';
  const allowed = [];
  const blocked = [];
  for (const a of actions) {
    const needsFull = a.requiresFullImpact || a.dependsOnImpact;
    if (needsFull && status !== 'FULL') {
      blocked.push({
        actionId: a.actionId,
        reason: `impact_${status}`,
      });
    } else {
      allowed.push(a);
    }
  }
  return { allowed, blocked };
}

/**
 * Sprint goal impact — only when explicit evidence exists.
 * @param {{ servesSprintGoal?: boolean, sprintGoalId?: string, sprintGoalText?: string }} task
 * @param {{ sprintGoal?: string }} sprint
 */
function evaluateSprintGoalImpact(task, sprint = {}) {
  const hasLink =
    Boolean(task?.servesSprintGoal) &&
    Boolean(String(sprint?.goal || sprint?.sprintGoal || '').trim() || task?.sprintGoalId);
  if (!hasLink) {
    return {
      affectsSprintGoal: false,
      goalImpactStatus: 'UNKNOWN',
      evidence: null,
    };
  }
  return {
    affectsSprintGoal: true,
    goalImpactStatus: 'EVIDENCED',
    evidence: {
      servesSprintGoal: true,
      sprintGoal: String(sprint.goal || sprint.sprintGoal || '').slice(0, 500),
    },
  };
}

/**
 * Simple capacity window: working hours minus other allocations (caller supplies numbers).
 */
function computeAvailableCapacityToDue({
  calendarHoursToDue = 0,
  otherAllocatedHours = 0,
} = {}) {
  const cal = Math.max(0, Number(calendarHoursToDue) || 0);
  const other = Math.max(0, Number(otherAllocatedHours) || 0);
  return Math.max(0, cal - other);
}

/**
 * Filter matching candidates who are overloaded before LLM (Wave 5a).
 */
function filterOverloadedCandidates(candidates = [], { maxLoadPct = 100 } = {}) {
  const list = Array.isArray(candidates) ? candidates : [];
  const eligible = [];
  const rejected = [];
  for (const c of list) {
    const load = Number(c.forecastWorkloadPct ?? c.loadPct ?? 0);
    if (Number.isFinite(load) && load > maxLoadPct) {
      rejected.push({ userId: c.userId, reason: 'overload', loadPct: load });
    } else {
      eligible.push(c);
    }
  }
  return { eligible, rejected };
}

module.exports = {
  analyzeDependencyImpact,
  filterActionsByImpact,
  evaluateSprintGoalImpact,
  computeAvailableCapacityToDue,
  filterOverloadedCandidates,
  SUPPORTED_FULL,
};
