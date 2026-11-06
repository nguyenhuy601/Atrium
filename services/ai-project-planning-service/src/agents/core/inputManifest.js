/**
 * Immutable input manifest for one Send. Refs only — no full WBS or snapshot.
 */

const { hashValue } = require('./agentResult');

function buildInputManifest({
  runId,
  phase,
  toolName,
  inputRefs = {},
  promptVersion = 'v1',
} = {}) {
  const refs = {
    snapshotId: inputRefs.snapshotId != null ? String(inputRefs.snapshotId) : '',
    wbsRevisionId: inputRefs.wbsRevisionId != null ? String(inputRefs.wbsRevisionId) : '',
    requirementContextRef:
      inputRefs.requirementContextRef != null ? String(inputRefs.requirementContextRef) : '',
    dependencyArtifactRef:
      inputRefs.dependencyArtifactRef != null ? String(inputRefs.dependencyArtifactRef) : '',
    architectureContextRef:
      inputRefs.architectureContextRef != null ? String(inputRefs.architectureContextRef) : '',
  };
  const name = String(toolName || '');
  const inputHash = hashValue({
    toolName: name,
    phase: phase || '',
    promptVersion: String(promptVersion || ''),
    refs,
  });
  return {
    runId: runId != null ? String(runId) : '',
    phase: phase || '',
    toolName: name,
    inputRefs: Object.freeze(refs),
    inputHash,
    promptVersion: String(promptVersion || ''),
  };
}

function sameManifestIdentity(left, right) {
  if (!left || !right) return false;
  return left.inputHash === right.inputHash && left.toolName === right.toolName;
}

module.exports = {
  buildInputManifest,
  sameManifestIdentity,
};
