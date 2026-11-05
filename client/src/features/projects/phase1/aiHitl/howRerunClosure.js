/**
 * FE preview of HOW selective re-run closure (server re-expands — SoT).
 * Mirror HOW_TOOL_DEPENDENCIES from APS howToolDag.
 */

export const HOW_REACT_CATALOG = Object.freeze([
  'WbsTool',
  'DependencyTool',
  'RiskTool',
  'QualityPlanTool',
  'ScheduleTool',
]);

const HOW_TOOL_DEPENDENCIES = Object.freeze({
  WbsTool: Object.freeze([]),
  DependencyTool: Object.freeze(['WbsTool']),
  RiskTool: Object.freeze(['DependencyTool']),
  QualityPlanTool: Object.freeze(['RiskTool']),
  ScheduleTool: Object.freeze(['DependencyTool']),
});

const TOOL_LABELS = Object.freeze({
  WbsTool: 'WBS',
  DependencyTool: 'Phụ thuộc',
  RiskTool: 'Rủi ro',
  QualityPlanTool: 'Chất lượng',
  ScheduleTool: 'Lịch / Sprint',
});

export function howToolLabel(toolName) {
  return TOOL_LABELS[toolName] || toolName;
}

function buildDependentIndex() {
  const index = new Map();
  for (const [toolName, prereqs] of Object.entries(HOW_TOOL_DEPENDENCIES)) {
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
export function resolveHowRerunClosure(seedTools) {
  const known = new Set(HOW_REACT_CATALOG);
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
