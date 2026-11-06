/**
 * Delivery DAG. Approval is not a node.
 * Nodes without an implementation function are not sent.
 */

const DELIVERY_NODES = Object.freeze([
  Object.freeze({
    id: 'testStrategy',
    deps: Object.freeze([]),
    implemented: false,
  }),
  Object.freeze({
    id: 'testCoverage',
    deps: Object.freeze([]),
    implemented: false,
  }),
  Object.freeze({
    id: 'defectAnalyst',
    deps: Object.freeze([]),
    implemented: false,
  }),
  Object.freeze({
    id: 'releaseReadiness',
    deps: Object.freeze([]),
    implemented: true,
    kind: 'tool',
  }),
  Object.freeze({
    id: 'handoverDraft',
    deps: Object.freeze([]),
    implemented: false,
  }),
  Object.freeze({
    id: 'qualityGate',
    deps: Object.freeze(['releaseReadiness']),
    implemented: true,
    kind: 'tool',
  }),
]);

function implementedNodes() {
  return DELIVERY_NODES.filter((node) => node.implemented);
}

module.exports = {
  DELIVERY_NODES,
  implementedNodes,
};
