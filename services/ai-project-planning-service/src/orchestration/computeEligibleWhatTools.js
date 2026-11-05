/**
 * Code-side WHAT eligibility — UC/Data only wait on WhatFrTool success (DAG),
 * same class as other section tools (no human FR baseline gate).
 */

const {
  WHAT_TOOL_DEPENDENCIES,
  CANONICAL_ORDER,
} = require('./whatToolDag');
const { WHAT_FR_TOOL } = require('../whatSecs/sectionCatalog');
const { successfulWhatTools, requiredWhatTools } = require('./artifactCompleteness');
const {
  latestExecutionByTool,
  attemptCountForTool,
} = require('./toolExecutionContract');

const DEFAULT_MAX_ATTEMPTS = 3;

/** LangGraph fail-fast: no eligible tool and required path blocked. */
const STOP_WHAT_NO_ELIGIBLE_PROGRESS = 'WHAT_NO_ELIGIBLE_PROGRESS';
const STOP_WHAT_GRAPH_RECURSION_LIMIT = 'GRAPH_RECURSION_LIMIT';

function whatReactCatalogTools() {
  return [...CANONICAL_ORDER];
}

function whatToolDepsSatisfied(toolName, done) {
  const name = String(toolName || '').trim();
  if (!name) return false;
  if (!(name in WHAT_TOOL_DEPENDENCIES)) return true;
  const deps = WHAT_TOOL_DEPENDENCIES[name] || [];
  return deps.every((dep) => done.has(dep));
}

/**
 * Tools that list WhatFrTool as a DAG dependency (UC / Data).
 * @param {string} toolName
 */
function dependsOnWhatFr(toolName) {
  const deps = WHAT_TOOL_DEPENDENCIES[toolName] || [];
  return deps.includes(WHAT_FR_TOOL);
}

/**
 * @param {string|null|undefined} stopReason
 */
function isWhatDeadlockStopReason(stopReason) {
  const stop = String(stopReason || '');
  return (
    stop === STOP_WHAT_NO_ELIGIBLE_PROGRESS ||
    stop === STOP_WHAT_GRAPH_RECURSION_LIMIT ||
    stop.startsWith('WHAT_NO_ELIGIBLE')
  );
}

/**
 * Catalog tools all validated-succeeded (ready for metaGate / emitReady path).
 * @param {object} state
 */
function isWhatCatalogComplete(state) {
  const done = successfulWhatTools(state);
  return requiredWhatTools().every((name) => done.has(name));
}

/**
 * @param {object} state
 * @param {{ catalog?: string[], maxAttempts?: number }} [opts]
 * @returns {{ eligible: string[], blocked: Array<{ toolName: string, blockedBy: string[] }>, running: string[] }}
 */
function computeEligibleWhatTools(state, opts = {}) {
  const catalog = Array.isArray(opts.catalog) ? opts.catalog : whatReactCatalogTools();
  const maxAttempts = Math.max(1, Number(opts.maxAttempts) || DEFAULT_MAX_ATTEMPTS);
  const done = successfulWhatTools(state);
  const latest = latestExecutionByTool(
    Array.isArray(state?.toolExecutions) ? state.toolExecutions : []
  );
  const eligible = [];
  const blocked = [];
  const running = [];

  for (const toolName of catalog) {
    if (done.has(toolName)) continue;

    const row = latest.get(toolName);
    if (
      row?.status === 'running' ||
      row?.status === 'pending' ||
      row?.status === 'waiting_external'
    ) {
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

    if (!whatToolDepsSatisfied(toolName, done)) {
      const deps = WHAT_TOOL_DEPENDENCIES[toolName] || [];
      blocked.push({
        toolName,
        blockedBy: deps.filter((d) => !done.has(d)),
      });
      continue;
    }

    eligible.push(toolName);
  }

  return { eligible, blocked, running };
}

/**
 * True deadlock: nothing eligible/running and missing catalog tools cannot progress.
 *
 * @param {object} state
 * @param {{ maxAttempts?: number, catalog?: string[] }} [opts]
 */
function detectWhatSelectDeadlock(state, opts = {}) {
  if (isWhatCatalogComplete(state)) {
    return {
      deadlocked: false,
      reason: null,
      blocked: [],
      eligible: [],
      running: [],
    };
  }

  const { eligible, blocked, running } = computeEligibleWhatTools(state, opts);
  if (eligible.length || running.length) {
    return {
      deadlocked: false,
      reason: null,
      blocked,
      eligible,
      running,
    };
  }

  const done = successfulWhatTools(state);
  const missing = requiredWhatTools().filter((name) => !done.has(name));
  // Condition 3–4: every missing tool is blocked with no remaining path
  // (deps unmet that themselves cannot run, or retry exhausted).
  const blockedByName = new Map(blocked.map((b) => [b.toolName, b]));
  const canProgress = missing.some((name) => {
    if (eligible.includes(name) || running.includes(name)) return true;
    const b = blockedByName.get(name);
    if (!b) return true; // unknown — do not declare deadlock
    const reasons = Array.isArray(b.blockedBy) ? b.blockedBy : [];
    if (reasons.some((r) => String(r).startsWith('retry_exhausted:'))) {
      return false;
    }
    // Dep blockers: if any dep is still eligible/running/not-terminal-failed, progress possible
    for (const dep of reasons) {
      if (done.has(dep)) continue;
      if (eligible.includes(dep) || running.includes(dep)) return true;
      const depBlock = blockedByName.get(dep);
      if (!depBlock) {
        // Dep not in catalog blocked list — may still become eligible later
        if (!done.has(dep) && whatToolDepsSatisfied(dep, done)) return true;
        continue;
      }
      const depReasons = Array.isArray(depBlock.blockedBy) ? depBlock.blockedBy : [];
      if (!depReasons.some((r) => String(r).startsWith('retry_exhausted:'))) {
        // Dep blocked for another reason that might clear — conservative: progress possible
        // unless all dep chain is retry-exhausted
        if (depReasons.length === 0) return true;
      }
    }
    return false;
  });

  if (canProgress) {
    return {
      deadlocked: false,
      reason: null,
      blocked,
      eligible,
      running,
    };
  }

  return {
    deadlocked: true,
    reason: STOP_WHAT_NO_ELIGIBLE_PROGRESS,
    blocked,
    eligible,
    running,
  };
}

module.exports = {
  whatReactCatalogTools,
  computeEligibleWhatTools,
  whatToolDepsSatisfied,
  dependsOnWhatFr,
  detectWhatSelectDeadlock,
  isWhatCatalogComplete,
  isWhatDeadlockStopReason,
  DEFAULT_MAX_ATTEMPTS,
  STOP_WHAT_NO_ELIGIBLE_PROGRESS,
  STOP_WHAT_GRAPH_RECURSION_LIMIT,
  WHAT_FR_TOOL,
};
