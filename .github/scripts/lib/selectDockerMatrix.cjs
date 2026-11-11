/**
 * Select Swarm Docker build matrix rows from catalog + change signals.
 * Used by resolve-docker-matrix.sh and unit tests.
 *
 * RULE-03: bootstrapMissing union into selection (main publish gap fill).
 * RULE-04: forceSharedDocker selects all non-client rows (shared/CI infra),
 *          then unions path-selected (so client/** still builds when both).
 */
'use strict';

function unionByImage(a, b) {
  const map = new Map();
  for (const row of a) map.set(row.image, row);
  for (const row of b) map.set(row.image, row);
  return [...map.values()];
}

function selectByPath(catalog, changedPaths) {
  const changed = changedPaths || [];
  return catalog.filter((row) => {
    if (row.image === 'client') {
      return changed.some((p) => p.startsWith('client/'));
    }
    if (row.image === 'api-gateway') {
      return changed.some((p) => p.startsWith('api-gateway/'));
    }
    return changed.some((p) => p.startsWith(`services/${row.image}/`));
  });
}

/**
 * @param {object} opts
 * @param {Array<{image:string,dockerfile:string,context?:string}>} opts.catalog
 * @param {boolean} [opts.forceAll]
 * @param {boolean} [opts.forceSharedDocker]
 * @param {string} [opts.onlyImage]
 * @param {string[]} [opts.changedPaths]
 * @param {string[]} [opts.bootstrapMissing]
 * @param {string} [opts.event]
 * @returns {{ selected: object[], label: string }}
 */
function selectDockerMatrix(opts) {
  const catalog = opts.catalog || [];
  const forceAll = opts.forceAll === true;
  const forceSharedDocker = opts.forceSharedDocker === true;
  const onlyImage = String(opts.onlyImage || '').trim();
  const changedPaths = opts.changedPaths || [];
  const bootstrapMissing = (opts.bootstrapMissing || [])
    .map((s) => String(s).trim())
    .filter(Boolean);
  const event = opts.event || 'pr';

  let selected;
  let label;

  if (onlyImage) {
    selected = catalog.filter((x) => x.image === onlyImage);
    if (!selected.length) {
      throw new Error(`Unknown image: ${onlyImage}`);
    }
    label = `only-image (${event}): ${onlyImage}`;
  } else if (forceAll) {
    selected = [...catalog];
    label = `build all (${event})`;
  } else if (forceSharedDocker) {
    const beAll = catalog.filter((x) => x.image !== 'client');
    const pathSelected = selectByPath(catalog, changedPaths);
    selected = unionByImage(beAll, pathSelected);
    label = `shared-docker BE+path (${event}): ${selected.map((s) => s.image).join(', ')}`;
  } else {
    selected = selectByPath(catalog, changedPaths);
    label = selected.length
      ? `path matrix (${event}): ${selected.map((s) => s.image).join(', ')}`
      : `path matrix (${event}): empty`;
  }

  if (bootstrapMissing.length) {
    const missingRows = catalog.filter((x) => bootstrapMissing.includes(x.image));
    const before = selected.length;
    selected = unionByImage(selected, missingRows);
    if (selected.length > before) {
      label += `; bootstrap: ${missingRows.map((r) => r.image).join(', ')}`;
    }
  }

  return { selected, label };
}

module.exports = {
  selectDockerMatrix,
  selectByPath,
  unionByImage,
};
