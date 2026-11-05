/**
 * Follow-up criteria — apply OK ≠ issue resolved (RULE-EC-09).
 */

/**
 * @param {Array<{ type: string, [k: string]: * }>} criteria
 * @param {object} actual — current facts after intervention
 * @returns {{ passed: boolean, results: object[] }}
 */
function evaluateFollowUpCriteria(criteria = [], actual = {}) {
  const list = Array.isArray(criteria) ? criteria : [];
  if (!list.length) {
    return {
      passed: false,
      results: [{ type: 'missing_criteria', passed: false }],
    };
  }
  const results = [];
  for (const c of list) {
    const type = String(c.type || '');
    let passed = false;
    switch (type) {
      case 'remaining_reduced': {
        const before = Number(c.beforeRemaining);
        const now = Number(actual.remainingHours);
        passed =
          Number.isFinite(before) &&
          Number.isFinite(now) &&
          now < before &&
          actual.remainingSource === 'confirmed';
        break;
      }
      case 'blocker_cleared': {
        const open = Array.isArray(actual.openBlockers) ? actual.openBlockers.length : 0;
        passed = open === 0;
        break;
      }
      case 'not_at_risk': {
        passed = !actual.signals?.includes?.('AT_RISK') && !actual.signals?.includes?.('OVERDUE');
        break;
      }
      case 'tc_pass': {
        passed = actual.tcAllPass === true;
        break;
      }
      case 'risk_residual_acceptable': {
        passed = actual.riskResidual === 'acceptable' || actual.riskResidual === 'closed';
        break;
      }
      case 'no_hard_signals': {
        const hard = ['OVERDUE', 'BLOCKED', 'AT_RISK', 'QUALITY_FAIL'];
        const sigs = actual.signals || [];
        passed = !hard.some((h) => sigs.includes(h));
        break;
      }
      default:
        passed = false;
        results.push({ type, passed: false, reason: 'unknown_criterion' });
        continue;
    }
    results.push({ type, passed });
  }
  return {
    passed: results.every((r) => r.passed),
    results,
  };
}

/**
 * Decide issue status after follow-up evaluation.
 */
function decideIssueAfterFollowUp({
  criteriaPassed,
  failCount = 0,
  maxFails = 2,
  hardSignals = [],
}) {
  if (criteriaPassed && !(hardSignals || []).length) {
    return { issueStatus: 'resolved', reopen: false };
  }
  if (failCount + 1 >= maxFails) {
    return { issueStatus: 'escalated', reopen: false };
  }
  return { issueStatus: 'monitoring', reopen: false };
}

module.exports = {
  evaluateFollowUpCriteria,
  decideIssueAfterFollowUp,
};
