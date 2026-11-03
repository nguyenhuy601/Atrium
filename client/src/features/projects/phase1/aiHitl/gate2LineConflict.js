/**
 * FE helpers for Gate 2 line conflicts (mirror BE audit rules).
 */

export function hasSideAudit(side) {
  const editor = String(side?.editedBy || side?.submittedBy || '').trim();
  const at = String(side?.editedAt || side?.submittedAt || '').trim();
  const version = String(side?.versionLabel || '').trim();
  return Boolean(editor && at && version);
}

export function openLineConflictCount(list) {
  return (Array.isArray(list) ? list : []).filter(
    (row) => String(row?.status || '') === 'open'
  ).length;
}

export function resolvedLineConflictCount(list) {
  return (Array.isArray(list) ? list : []).filter(
    (row) => String(row?.status || '') === 'resolved'
  ).length;
}

export function synthesisDecisionEntries(draft) {
  const decisions = draft?.decisions && typeof draft.decisions === 'object' ? draft.decisions : {};
  return Object.entries(decisions).map(([logicalId, row]) => ({
    logicalId,
    ...(row && typeof row === 'object' ? row : {}),
  }));
}

export function formatEditorLabel(side, nameByUserId = {}) {
  const id = String(side?.editedBy || side?.submittedBy || '').trim();
  if (!id) return '—';
  const named = String(side?.editorDisplayName || nameByUserId[id] || '').trim();
  if (named) return named;
  return id.length > 10 ? `${id.slice(0, 8)}…` : id;
}

export function formatAuditWhen(side) {
  const raw = String(side?.editedAt || side?.submittedAt || '').trim();
  if (!raw) return '—';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  try {
    return d.toLocaleString();
  } catch {
    return raw;
  }
}

export function summarizeSideAction(side) {
  const action = String(side?.action || '').toLowerCase();
  if (action === 'edit') {
    const payload = side?.editedPayload;
    if (payload && typeof payload === 'object') {
      const keys = Object.keys(payload).slice(0, 3);
      if (keys.length) {
        return `edit: ${keys
          .map((key) => `${key}=${String(payload[key] ?? '').slice(0, 40)}`)
          .join(', ')}`;
      }
    }
    return 'edit';
  }
  if (action === 'reject') return 'reject';
  if (action === 'accept') return 'accept';
  return action || '—';
}

export function readGate2LineConflicts(pack) {
  const list = pack?.aiAnalysis?.gate2?.lineConflicts;
  return Array.isArray(list) ? list : [];
}

export function readGate2SynthesisDraft(pack) {
  const draft = pack?.aiAnalysis?.gate2?.synthesisDraft;
  return draft && typeof draft === 'object' ? draft : null;
}
