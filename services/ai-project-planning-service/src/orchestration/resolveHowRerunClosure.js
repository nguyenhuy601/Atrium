/**
 * Expand seed HOW tools → transitive dependents (HOW_TOOL_DEPENDENCIES).
 * Server SoT for selective re-run — FE preview must re-expand on server.
 */

const { HOW_TOOL_DEPENDENCIES, CANONICAL_ORDER } = require('./howToolDag');

/**
 * Reverse edges: prerequisite → Set of direct dependents.
 * @param {Readonly<Record<string, readonly string[]>>} [deps]
 * @returns {Map<string, Set<string>>}
 */
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
 * @param {string[]|Set<string>|null|undefined} seedTools
 * @param {{
 *   dependencies?: Readonly<Record<string, readonly string[]>>,
 *   catalog?: string[],
 * }} [opts]
 * @returns {string[]} canonical-ordered unique closure (seeds ∪ transitive dependents)
 */
function resolveHowRerunClosure(seedTools, opts = {}) {
  const deps = opts.dependencies || HOW_TOOL_DEPENDENCIES;
  const catalog = Array.isArray(opts.catalog)
    ? opts.catalog
    : CANONICAL_ORDER.filter((n) => n !== 'ProjectPlanTool');
  const catalogSet = new Set(catalog);
  const known = new Set([...Object.keys(deps || {}), ...catalog]);

  const seeds = [];
  const seenSeed = new Set();
  for (const raw of Array.isArray(seedTools) ? seedTools : seedTools ? [...seedTools] : []) {
    const name = String(raw || '').trim();
    if (!name || seenSeed.has(name)) continue;
    if (!known.has(name) && !catalogSet.has(name)) continue;
    seenSeed.add(name);
    seeds.push(name);
  }
  if (!seeds.length) return [];

  const dependentsOf = buildDependentIndex(deps);
  const closure = new Set(seeds);
  const queue = [...seeds];
  while (queue.length) {
    const cur = queue.shift();
    for (const child of dependentsOf.get(cur) || []) {
      if (closure.has(child)) continue;
      if (!known.has(child) && !catalogSet.has(child)) continue;
      closure.add(child);
      queue.push(child);
    }
  }

  const orderIndex = new Map(CANONICAL_ORDER.map((n, i) => [n, i]));
  return [...closure].sort(
    (a, b) => (orderIndex.get(a) ?? 999) - (orderIndex.get(b) ?? 999)
  );
}

/**
 * Normalize forceRerunSet from input: prefer expanded forceRerunSet, else expand rerunTools,
 * else empty (caller may substitute full catalog for force-without-seeds).
 * @param {{ forceRerunSet?: string[], rerunTools?: string[] }|null|undefined} input
 * @param {{ catalog?: string[] }} [opts]
 * @returns {string[]}
 */
function normalizeForceRerunSet(input, opts = {}) {
  const rawSet = Array.isArray(input?.forceRerunSet) ? input.forceRerunSet : null;
  if (rawSet && rawSet.length) {
    return resolveHowRerunClosure(rawSet, opts);
  }
  const seeds = Array.isArray(input?.rerunTools) ? input.rerunTools : [];
  if (!seeds.length) return [];
  return resolveHowRerunClosure(seeds, opts);
}

module.exports = {
  resolveHowRerunClosure,
  normalizeForceRerunSet,
  buildDependentIndex,
};
