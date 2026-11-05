/**
 * Pure FE helpers: done/total for Monitor Run Loading Card.
 * Catalog used only for counts — UI must not list pending names.
 */

import { HOW_PLANNING_LAYERS } from './howProgressViewModel.js';

const DONE_TOOL_STATUSES = new Set(['succeeded', 'skipped']);
/** In-flight from BE toolExecutions (pending here = queued, not catalog-idle). */
const EXEC_RUNNING_STATUSES = new Set([
  'running',
  'waiting_external',
  'queued',
  'pending',
  'retrying',
]);
/** Layer view marks idle tools as pending — only these mean current. */
const LAYER_RUNNING_STATUSES = new Set([
  'running',
  'waiting_external',
  'retrying',
  'queued',
]);

/**
 * WHAT: progress within the active macro's substeps.
 * done = index of current substep (current itself not counted as done).
 *
 * @param {{ activeMacroSubsteps?: string[], substep?: string|null }} input
 * @returns {{ done: number, total: number, currentIds: string[] }}
 */
export function countWhatMacroProgress({ activeMacroSubsteps = [], substep = null } = {}) {
  const steps = Array.isArray(activeMacroSubsteps)
    ? activeMacroSubsteps.filter(Boolean)
    : [];
  const total = steps.length;
  if (total === 0) {
    return { done: 0, total: 0, currentIds: [] };
  }
  const current = String(substep || '').trim();
  const index = current ? steps.indexOf(current) : -1;
  if (index < 0) {
    return { done: 0, total, currentIds: current ? [current] : [] };
  }
  return {
    done: index,
    total,
    currentIds: [steps[index]],
  };
}

function flatPlanningToolIds() {
  return HOW_PLANNING_LAYERS.flat();
}

/**
 * Normalize to { doneIds, currentIds } — never treat layer-idle `pending` as current.
 */
function collectEnginesIds(planningLayers = [], toolExecutions = [], activeStepIds = null) {
  const catalog = new Set(flatPlanningToolIds());
  const doneSet = new Set();
  const currentSet = new Set();

  for (const row of Array.isArray(toolExecutions) ? toolExecutions : []) {
    const id = String(row?.toolName || row?.id || '').trim();
    if (!id || !catalog.has(id)) continue;
    const status = String(row?.status || '').trim().toLowerCase();
    if (DONE_TOOL_STATUSES.has(status)) {
      doneSet.add(id);
      currentSet.delete(id);
    } else if (EXEC_RUNNING_STATUSES.has(status)) {
      if (!doneSet.has(id)) currentSet.add(id);
    }
  }

  for (const layer of Array.isArray(planningLayers) ? planningLayers : []) {
    for (const tool of layer?.tools || []) {
      const id = String(tool?.id || '').trim();
      if (!id || !catalog.has(id)) continue;
      const status = String(tool?.status || '').trim().toLowerCase();
      if (DONE_TOOL_STATUSES.has(status)) {
        doneSet.add(id);
        currentSet.delete(id);
      } else if (LAYER_RUNNING_STATUSES.has(status)) {
        if (!doneSet.has(id)) currentSet.add(id);
      }
      // layer status `pending` = not started → ignore for current
    }
    for (const raw of layer?.activeToolIds || []) {
      const id = String(raw || '').trim();
      if (!id || !catalog.has(id) || doneSet.has(id)) continue;
      currentSet.add(id);
    }
  }

  if (!currentSet.size && Array.isArray(activeStepIds)) {
    for (const raw of activeStepIds) {
      const id = String(raw || '').trim();
      if (!id || !catalog.has(id) || doneSet.has(id)) continue;
      currentSet.add(id);
    }
  }

  const order = flatPlanningToolIds();
  return {
    done: order.filter((id) => doneSet.has(id)).length,
    total: order.length,
    currentIds: order.filter((id) => currentSet.has(id)),
  };
}

/**
 * HOW Engines (macro 2): done = succeeded|skipped among catalog tools; currentIds = in-flight only.
 *
 * @param {{ planningLayers?: object[], toolExecutions?: object[], activeStepIds?: string[]|null }} input
 * @returns {{ done: number, total: number, currentIds: string[] }}
 */
export function countHowEnginesProgress({
  planningLayers = [],
  toolExecutions = [],
  activeStepIds = null,
} = {}) {
  return collectEnginesIds(planningLayers, toolExecutions, activeStepIds);
}

/**
 * HOW prepare / wrap-up macros: same index rule as WHAT.
 *
 * @param {{ activeMacroSubsteps?: string[], activeStepId?: string|null, activeStepIds?: string[]|null }} input
 * @returns {{ done: number, total: number, currentIds: string[] }}
 */
export function countHowSignalMacroProgress({
  activeMacroSubsteps = [],
  activeStepId = null,
  activeStepIds = null,
} = {}) {
  const steps = Array.isArray(activeMacroSubsteps)
    ? activeMacroSubsteps.filter(Boolean)
    : [];
  const total = steps.length;
  if (total === 0) {
    return { done: 0, total: 0, currentIds: [] };
  }

  const parallel = Array.isArray(activeStepIds)
    ? activeStepIds.map((id) => String(id || '').trim()).filter(Boolean)
    : [];
  const primary = String(activeStepId || parallel[0] || '').trim();
  const index = primary ? steps.indexOf(primary) : -1;

  const currentIds = [];
  const seen = new Set();
  const candidates = parallel.length ? parallel : primary ? [primary] : [];
  for (const id of candidates) {
    if (!steps.includes(id) || seen.has(id)) continue;
    seen.add(id);
    currentIds.push(id);
  }

  if (index < 0) {
    return { done: 0, total, currentIds };
  }
  return { done: index, total, currentIds };
}

/**
 * Dispatch HOW progress by macroStep (1 prepare, 2 engines, 3 wrap-up).
 *
 * @param {{
 *   macroStep?: number,
 *   activeMacroSubsteps?: string[],
 *   activeStepId?: string|null,
 *   activeStepIds?: string[]|null,
 *   planningLayers?: object[],
 *   toolExecutions?: object[],
 * }} input
 */
export function countHowMacroProgress(input = {}) {
  const macroStep = Number(input.macroStep) || 0;
  if (macroStep === 2) {
    return countHowEnginesProgress(input);
  }
  return countHowSignalMacroProgress(input);
}

export default {
  countWhatMacroProgress,
  countHowEnginesProgress,
  countHowSignalMacroProgress,
  countHowMacroProgress,
};
