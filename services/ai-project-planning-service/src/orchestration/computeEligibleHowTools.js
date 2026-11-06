/**
 * Code-side HOW eligibility — LLM may only bind these tools (no soft-deps rewrite).
 */

const {
  HOW_TOOL_DEPENDENCIES,
  CANONICAL_ORDER,
  howToolDepsSatisfied,
} = require('./howToolDag');
const {
  succeededValidatedTools,
  latestExecutionByTool,
  attemptCountForTool,
} = require('./toolExecutionContract');

const DEFAULT_MAX_ATTEMPTS = 3;

/** LangGraph fail-fast: no eligible tool and required path blocked — do not injectGap. */
const STOP_HOW_NO_ELIGIBLE_PROGRESS = 'HOW_NO_ELIGIBLE_PROGRESS';
const STOP_HOW_DEPENDENCY_NOT_SCHEDULE_READY = 'HOW_DEPENDENCY_NOT_SCHEDULE_READY';

/** ReAct catalog — ProjectPlan is graph finalizePlan, not LLM-selectable. */
function howReactCatalogTools() {
  return CANONICAL_ORDER.filter((name) => name !== 'ProjectPlanTool');
}

/**
 * True when stopReason is a HOW select deadlock (prefix HOW_ to avoid WHAT collision).
 * @param {string|null|undefined} stopReason
 */
function isHowDeadlockStopReason(stopReason) {
  const stop = String(stopReason || '');
  return (
    stop === STOP_HOW_NO_ELIGIBLE_PROGRESS ||
    stop === STOP_HOW_DEPENDENCY_NOT_SCHEDULE_READY ||
    stop.startsWith('HOW_NO_ELIGIBLE')
  );
}

/**
 * Defense when toolExecutions were dropped after a successful WbsTool write.
 * Mirrors artifactCompleteness hasLeafTasks / hasMeaningfulWbs.
 * @param {object} state
 */
function hasWbsLeavesInContainer(state) {
  const tasks = Array.isArray(state?.container?.planning?.tasks)
    ? state.container.planning.tasks
    : [];
  if (tasks.some((t) => t && (t.level === 'task' || t.type === 'task'))) return true;
  const wbs = state?.container?.planning?.wbs || state?.container?.planning?.wbsTree;
  const count = Number(wbs?.taskCount);
  if (Number.isFinite(count) && count > 0) return true;
  if (Array.isArray(wbs?.nodes) && wbs.nodes.length > 0) return true;
  return false;
}

function dependencyAnalysisFlags(state) {
  const dep = state?.container?.analyses?.dependency || {};
  return {
    executionTerminal: Boolean(dep.executionTerminal ?? dep.meta?.executionTerminal),
    scheduleReady: Boolean(dep.scheduleReady ?? dep.meta?.scheduleReady),
    analysisComplete: Boolean(dep.analysisComplete ?? dep.meta?.analysisComplete),
    analysisStatus: dep.analysisStatus || dep.meta?.analysisStatus || null,
  };
}

/**
 * @param {object} state
 * @returns {Set<string>}
 */
function forceRerunSetOf(state) {
  const raw = state?.forceRerunSet;
  if (Array.isArray(raw) && raw.length) {
    return new Set(raw.map((n) => String(n || '').trim()).filter(Boolean));
  }
  return new Set();
}

/**
 * succeededValidatedTools + container fallback for WbsTool (ReAct loop guard).
 * DependencyTool: executionTerminal on container also counts as "done" for Risk/Schedule soft-deps
 * (SKIPPED/FAILED/PARTIAL unlock both; schedulable edges are optional for Schedule).
 *
 * RULE-RR-03/04: when forceRerunSet is non-empty:
 * - tools outside the set → treated as done (reuse)
 * - tools inside the set → not done until succeededValidatedTools has them
 *   (fresh HOW runs start with empty toolExecutions, so prior container artifacts do not skip re-run;
 *    after re-success, they stay done so dependents e.g. Quality←Risk can unlock)
 * @param {object} state
 * @returns {Set<string>}
 */
function howSucceededTools(state) {
  const rerun = forceRerunSetOf(state);
  const catalog = howReactCatalogTools();
  const executed = succeededValidatedTools(state);
  const done = new Set(executed);

  if (!rerun.has('WbsTool') && !done.has('WbsTool') && hasWbsLeavesInContainer(state)) {
    done.add('WbsTool');
  }
  if (!rerun.has('DependencyTool') && !done.has('DependencyTool')) {
    const flags = dependencyAnalysisFlags(state);
    if (flags.executionTerminal) done.add('DependencyTool');
    else {
      const latest = latestExecutionByTool(
        Array.isArray(state?.toolExecutions) ? state.toolExecutions : []
      );
      const row = latest.get('DependencyTool');
      if (row && (row.status === 'succeeded' || row.status === 'skipped' || row.status === 'failed')) {
        done.add('DependencyTool');
      }
    }
  }

  if (rerun.size) {
    for (const name of catalog) {
      if (!rerun.has(name)) done.add(name);
    }
    for (const name of rerun) {
      if (!executed.has(name)) done.delete(name);
    }
  }
  return done;
}

/**
 * Force-rerun tools still missing a validated success in this graph state.
 * @param {object} state
 * @returns {string[]}
 */
function forceRerunPendingTools(state) {
  const rerun = forceRerunSetOf(state);
  if (!rerun.size) return [];
  const executed = succeededValidatedTools(state);
  const catalog = howReactCatalogTools();
  const order = new Map(catalog.map((n, i) => [n, i]));
  return [...rerun]
    .filter((name) => !executed.has(name))
    .sort((a, b) => (order.get(a) ?? 999) - (order.get(b) ?? 999));
}

/**
 * @param {object} state
 * @param {{ maxAttempts?: number, catalog?: string[] }} [opts]
 * @returns {{ eligible: string[], blocked: Array<{ toolName: string, blockedBy: string[] }>, running: string[] }}
 */
function computeEligibleHowTools(state, opts = {}) {
  const catalog = Array.isArray(opts.catalog) ? opts.catalog : howReactCatalogTools();
  const maxAttempts = Math.max(1, Number(opts.maxAttempts) || DEFAULT_MAX_ATTEMPTS);
  const done = howSucceededTools(state);
  const latest = latestExecutionByTool(
    Array.isArray(state?.toolExecutions) ? state.toolExecutions : []
  );

  const eligible = [];
  const blocked = [];
  const running = [];

  for (const toolName of catalog) {
    if (done.has(toolName)) continue;

    const row = latest.get(toolName);
    if (row?.status === 'running' || row?.status === 'waiting_external') {
      running.push(toolName);
      continue;
    }

    const attempts = attemptCountForTool(state, toolName);
    if (attempts >= maxAttempts) {
      blocked.push({
        toolName,
        blockedBy: [`retry_exhausted:${attempts}`],
      });
      continue;
    }

    if (!howToolDepsSatisfied(toolName, done)) {
      const deps = HOW_TOOL_DEPENDENCIES[toolName] || [];
      blocked.push({
        toolName,
        blockedBy: deps.filter((d) => !done.has(d)),
      });
      continue;
    }

    // Staged WBS checkpoint: block all dependents until wbsBaselineRevisionId is pinned.
    if (toolName !== 'WbsTool') {
      const {
        isWbsCheckpointEnabled,
        needsWbsConfirm,
      } = require('../planningRevision/wbsCheckpoint');
      if (isWbsCheckpointEnabled() && needsWbsConfirm(state)) {
        blocked.push({
          toolName,
          blockedBy: ['wbs_baseline_confirm'],
        });
        continue;
      }
    }

    // Schedule: DependencyTool terminal is enough. Schedulable edges optional —
    // engine runs with edges when present, otherwise capacity/timeline without FS edges.
    // Do not gate on dependency.scheduleReady (avoids HOW_DEPENDENCY_NOT_SCHEDULE_READY
    // when LLM proposes only non-schedulable INTEGRATION deps).

    eligible.push(toolName);
  }

  return { eligible, blocked, running };
}

function isHowReadyForFinalize(state, opts = {}) {
  if (!opts.required) {
    const { readyToFinalize } = require('../agents/how/howSupervisor');
    if (!readyToFinalize(state)) return false;
    if (forceRerunPendingTools(state).length) return false;
    return true;
  }
  const required = opts.required;
  const done = howSucceededTools(state);
  if (!required.every((name) => done.has(name))) return false;
  // LangGraph termination: selective re-run goal unmet while forceRerun tools lack validated success.
  if (forceRerunPendingTools(state).length) return false;
  return true;
}

/**
 * LangGraph deadlock: nothing eligible/running and Gate2 required tools not satisfied.
 *
 * @param {object} state
 * @param {{ maxAttempts?: number, catalog?: string[], required?: string[] }} [opts]
 * @returns {{
 *   deadlocked: boolean,
 *   reason: string|null,
 *   blocked: Array<{ toolName: string, blockedBy: string[] }>,
 *   eligible: string[],
 *   running: string[],
 * }}
 */
function detectHowSelectDeadlock(state, opts = {}) {
  if (isHowReadyForFinalize(state, opts)) {
    return {
      deadlocked: false,
      reason: null,
      blocked: [],
      eligible: [],
      running: [],
    };
  }

  const { eligible, blocked, running } = computeEligibleHowTools(state, opts);
  if (eligible.length || running.length) {
    return {
      deadlocked: false,
      reason: null,
      blocked,
      eligible,
      running,
    };
  }

  // Legacy: older runs may still carry dependency_scheduleReady blocks in state;
  // map to the historical stop code for UI/compat. New eligibility no longer emits it.
  const done = howSucceededTools(state);
  const scheduleBlock = blocked.find(
    (b) =>
      b.toolName === 'ScheduleTool' &&
      Array.isArray(b.blockedBy) &&
      b.blockedBy.includes('dependency_scheduleReady')
  );
  const reason =
    scheduleBlock && done.has('DependencyTool')
      ? STOP_HOW_DEPENDENCY_NOT_SCHEDULE_READY
      : STOP_HOW_NO_ELIGIBLE_PROGRESS;

  return {
    deadlocked: true,
    reason,
    blocked,
    eligible,
    running,
  };
}

module.exports = {
  howReactCatalogTools,
  computeEligibleHowTools,
  isHowReadyForFinalize,
  detectHowSelectDeadlock,
  isHowDeadlockStopReason,
  hasWbsLeavesInContainer,
  howSucceededTools,
  forceRerunSetOf,
  forceRerunPendingTools,
  dependencyAnalysisFlags,
  DEFAULT_MAX_ATTEMPTS,
  STOP_HOW_NO_ELIGIBLE_PROGRESS,
  STOP_HOW_DEPENDENCY_NOT_SCHEDULE_READY,
};
