/**
 * Pure HITL edit helpers for Gate2 Risk / Quality / Sprint (no React).
 */

export function isGate2RiskItemRow(row) {
  return String(row?.level || '').trim().toLowerCase() === 'risk';
}

export function relatedFrIdsToEditorText(value) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean).join(', ');
  return String(value ?? '').trim();
}

export function parseRelatedFrIdsEditorText(value) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  return String(value ?? '')
    .split(/[,;\s]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/** Extra seed fields beyond editable table columns. */
export function enrichGate2HitlSeedPayload(row, payload = {}) {
  const next = { ...(payload && typeof payload === 'object' ? payload : {}) };

  if (row?.recordKind === 'test_case' || row?.section === 'quality') {
    if (row.objective != null) next.objective = String(row.objective);
    if (Array.isArray(row.preconditions)) next.preconditions = [...row.preconditions];
    if (Array.isArray(row.testData)) {
      next.testData = row.testData.map((item) =>
        item && typeof item === 'object' ? { ...item } : item
      );
    }
    if (Array.isArray(row.steps)) {
      next.steps = row.steps.map((step) =>
        step && typeof step === 'object' ? { ...step } : step
      );
    }
  }

  if (isGate2RiskItemRow(row) && row.impactDescription) {
    next.impactDescription = String(row.impactDescription);
  }

  return next;
}

export function patchGate2HitlField(prev, field, value) {
  const next = { ...(prev && typeof prev === 'object' ? prev : {}) };
  if (field === 'relatedFrIds') {
    next.relatedFrIds = parseRelatedFrIdsEditorText(value);
    return next;
  }
  if (field === 'probability' || field === 'impact') {
    const trimmed = String(value ?? '').trim();
    if (!trimmed) {
      next[field] = '';
      return next;
    }
    const n = Number(trimmed);
    next[field] = Number.isFinite(n) ? n : trimmed;
    return next;
  }
  next[field] = value;
  return next;
}
