/**
 * Format Customer Raw formValidation for UI / tooltip.
 */

export function isCustomerRawFormOk(formValidation) {
  return Boolean(formValidation && formValidation.ok === true);
}

export function readContentWarnings(formValidation) {
  const w = formValidation?.contentWarnings;
  if (!w || typeof w !== 'object') {
    return { missingActor: 0, missingOutcome: 0, rowCount: 0, samples: [] };
  }
  return {
    missingActor: Number(w.missingActor) || 0,
    missingOutcome: Number(w.missingOutcome) || 0,
    rowCount: Number(w.rowCount) || 0,
    samples: Array.isArray(w.samples) ? w.samples : [],
  };
}

export function hasContentWarnings(formValidation) {
  const w = readContentWarnings(formValidation);
  return w.missingActor > 0 || w.missingOutcome > 0;
}

export function formatCustomerRawFormIssues(formValidation, t) {
  if (!formValidation || formValidation.ok) return [];
  const issues = [];
  if (!formValidation.recognizedAsCustomerRaw) {
    issues.push(t('workspace.phase1RawFormNotRecognized'));
  }
  for (const sheet of formValidation.missingSheets || []) {
    issues.push(t('workspace.phase1RawFormMissingSheet').replace('{sheet}', sheet));
  }
  const bySheet = formValidation.missingHeadersBySheet || {};
  for (const [sheet, cols] of Object.entries(bySheet)) {
    issues.push(
      t('workspace.phase1RawFormMissingCols')
        .replace('{sheet}', sheet)
        .replace('{cols}', (cols || []).join(', '))
    );
  }
  return issues;
}

/** Soft content gaps — never block template OK. */
export function formatCustomerRawContentWarnings(formValidation, t) {
  const w = readContentWarnings(formValidation);
  const lines = [];
  if (w.missingActor > 0) {
    lines.push(
      (t('workspace.phase1RawFormWarnMissingActor') || 'Thiếu User/Actor: {count} dòng').replace(
        '{count}',
        String(w.missingActor)
      )
    );
  }
  if (w.missingOutcome > 0) {
    lines.push(
      (
        t('workspace.phase1RawFormWarnMissingOutcome') ||
        'Thiếu mô tả hành vi (Requirement): {count} dòng'
      ).replace('{count}', String(w.missingOutcome))
    );
  }
  return lines;
}

export function formatCustomerRawFormTooltip(formValidation, t) {
  if (isCustomerRawFormOk(formValidation)) {
    const soft = formatCustomerRawContentWarnings(formValidation, t);
    if (soft.length) {
      return `${t('workspace.phase1RawFormOkTooltip')}; ${soft.join('; ')}`;
    }
    return t('workspace.phase1RawFormOkTooltip');
  }
  const issues = formatCustomerRawFormIssues(formValidation, t);
  if (!issues.length) {
    return t('workspace.phase1RawFormInvalidTooltip');
  }
  return issues.join('; ');
}

/**
 * LLM insufficient reasons (runtime empty source).
 */
export function isLlmInsufficientReason(reason) {
  const r = String(reason || '').toUpperCase();
  return r === 'SOURCE_SHEET_EMPTY' || r === 'SOURCE_SHEET_ABSENT' || r === 'SOURCE_UNAVAILABLE';
}

export function labelLlmInsufficientReason(reason, t) {
  const r = String(reason || '').toUpperCase();
  if (r === 'SOURCE_SHEET_ABSENT') {
    return t('requirements.phase1LlmInsufficientAbsent');
  }
  if (r === 'SOURCE_SHEET_EMPTY' || r === 'SOURCE_UNAVAILABLE') {
    return t('requirements.phase1LlmInsufficientEmpty');
  }
  return reason || '';
}
