/**
 * HOW selective re-run closure — mirror of APS resolveHowRerunClosure
 * (project-service must not import APS internals).
 * Edges: prerequisite → dependent (same as HOW_TOOL_DEPENDENCIES).
 */

const HOW_TOOL_DEPENDENCIES = Object.freeze({
  WbsTool: Object.freeze([]),
  DependencyTool: Object.freeze(['WbsTool']),
  RiskTool: Object.freeze(['DependencyTool']),
  QualityPlanTool: Object.freeze(['RiskTool']),
  ScheduleTool: Object.freeze(['DependencyTool']),
});

const HOW_REACT_CATALOG = Object.freeze([
  'WbsTool',
  'DependencyTool',
  'RiskTool',
  'QualityPlanTool',
  'ScheduleTool',
]);

function buildDependentIndex(deps = HOW_TOOL_DEPENDENCIES) {
  const index = new Map();
  for (const [toolName, prereqs] of Object.entries(deps || {})) {
    if (!index.has(toolName)) index.set(toolName, new Set());
    for (const dep of prereqs || []) {
      if (!index.has(dep)) index.set(dep, new Set());
      index.get(dep).add(toolName);
    }
  }
  return index;
}

/**
 * @param {string[]} seedTools
 * @returns {string[]}
 */
function resolveHowRerunClosure(seedTools) {
  const known = new Set([...Object.keys(HOW_TOOL_DEPENDENCIES), ...HOW_REACT_CATALOG]);
  const seeds = [];
  const seen = new Set();
  for (const raw of Array.isArray(seedTools) ? seedTools : []) {
    const name = String(raw || '').trim();
    if (!name || seen.has(name) || !known.has(name)) continue;
    seen.add(name);
    seeds.push(name);
  }
  if (!seeds.length) return [];

  const dependentsOf = buildDependentIndex();
  const closure = new Set(seeds);
  const queue = [...seeds];
  while (queue.length) {
    const cur = queue.shift();
    for (const child of dependentsOf.get(cur) || []) {
      if (closure.has(child)) continue;
      closure.add(child);
      queue.push(child);
    }
  }

  const orderIndex = new Map(HOW_REACT_CATALOG.map((n, i) => [n, i]));
  return [...closure].sort(
    (a, b) => (orderIndex.get(a) ?? 999) - (orderIndex.get(b) ?? 999)
  );
}

/**
 * @param {{ force?: boolean, rerunTools?: string[] }} opts
 * @returns {string[]}
 */
function resolveForceRerunSet({ force = false, rerunTools = [] } = {}) {
  const seeds = Array.isArray(rerunTools)
    ? rerunTools.map((s) => String(s || '').trim()).filter(Boolean)
    : [];
  if (seeds.length) return resolveHowRerunClosure(seeds);
  if (force) return [...HOW_REACT_CATALOG];
  return [];
}

module.exports = {
  HOW_TOOL_DEPENDENCIES,
  HOW_REACT_CATALOG,
  resolveHowRerunClosure,
  resolveForceRerunSet,
};
