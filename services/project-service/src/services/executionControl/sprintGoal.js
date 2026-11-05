/**
 * Wave 5b — Sprint Goal gap + simulation (tool numbers only).
 */

/**
 * @param {{
 *   sprint: { goal?: string, endDate?: Date|string|null },
 *   stories: Array<{ _id: string, servesSprintGoal?: boolean, remainingHours?: number|null, remainingSource?: string, signals?: string[] }>,
 *   teamCapacityToSprintEnd?: number,
 * }} input
 */
function detectSprintGoalAtRisk(input = {}) {
  const goal = String(input.sprint?.goal || '').trim();
  if (!goal) {
    return {
      atRisk: false,
      reason: 'no_sprint_goal',
      goalImpactStatus: 'UNKNOWN',
    };
  }
  const stories = Array.isArray(input.stories) ? input.stories : [];
  const goalStories = stories.filter((s) => s.servesSprintGoal);
  if (!goalStories.length) {
    return {
      atRisk: false,
      reason: 'no_story_goal_link',
      goalImpactStatus: 'UNKNOWN',
    };
  }

  const blockedGoal = goalStories.filter((s) =>
    (s.signals || []).some((x) => x === 'BLOCKED' || x === 'AT_RISK' || x === 'OVERDUE')
  );
  let remainingSum = 0;
  let confirmedCount = 0;
  for (const s of goalStories) {
    if (s.remainingSource === 'confirmed' && Number.isFinite(Number(s.remainingHours))) {
      remainingSum += Number(s.remainingHours);
      confirmedCount += 1;
    }
  }
  const capacity = Number(input.teamCapacityToSprintEnd);
  const capacityGap =
    Number.isFinite(capacity) && confirmedCount === goalStories.length && remainingSum > capacity;

  const atRisk = blockedGoal.length > 0 || capacityGap;
  return {
    atRisk,
    goalImpactStatus: 'EVIDENCED',
    evidence: {
      sprintGoal: goal.slice(0, 500),
      blockedGoalStoryIds: blockedGoal.map((s) => String(s._id)),
      remainingSum,
      teamCapacityToSprintEnd: Number.isFinite(capacity) ? capacity : null,
      capacityGap: Boolean(capacityGap),
    },
    reason: blockedGoal.length ? 'goal_story_blocked' : capacityGap ? 'capacity_gap' : 'ok',
  };
}

/**
 * Simulate keep vs cut scenarios — returns tool numbers (no LLM).
 */
function simulateSprintScopeOptions({
  goalStories = [],
  otherStories = [],
  teamCapacityToSprintEnd = 0,
} = {}) {
  const capacity = Math.max(0, Number(teamCapacityToSprintEnd) || 0);
  const goalHours = goalStories.reduce(
    (s, t) => s + (t.remainingSource === 'confirmed' ? Number(t.remainingHours) || 0 : 0),
    0
  );
  const otherHours = otherStories.reduce(
    (s, t) => s + (t.remainingSource === 'confirmed' ? Number(t.remainingHours) || 0 : 0),
    0
  );
  const keepAll = {
    id: 'keep_all',
    goalHours,
    otherHours,
    total: goalHours + otherHours,
    fits: goalHours + otherHours <= capacity,
  };
  const protectGoalCutOther = {
    id: 'protect_goal_cut_other',
    goalHours,
    otherHours: 0,
    total: goalHours,
    fits: goalHours <= capacity,
    cutStoryIds: otherStories.map((t) => String(t._id)),
  };
  return {
    simulationRef: {
      type: 'sprint_scope_sim',
      capacity,
      scenarios: [keepAll, protectGoalCutOther],
    },
  };
}

module.exports = {
  detectSprintGoalAtRisk,
  simulateSprintScopeOptions,
};
