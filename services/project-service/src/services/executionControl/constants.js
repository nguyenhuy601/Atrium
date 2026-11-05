/**
 * Execution Control — shared enums (SoT with plan §3.16).
 */

const ISSUE_KINDS = Object.freeze([
  'OVERDUE',
  'AT_RISK',
  'BLOCKED',
  'CAPACITY_OVERLOAD',
  'UNASSIGNED',
  'DEPENDENCY_CONFLICT',
  'SPRINT_GOAL_AT_RISK',
  'QUALITY_FAIL',
  'SCOPE_CHANGE',
  'COST_OVERRUN',
  'NEEDS_DATA',
  'STALE_PROGRESS',
  'DONE_NO_EVIDENCE',
  'RISK_OCCURRED',
  'INCIDENT',
]);

const ISSUE_STATUSES = Object.freeze([
  'open',
  'analyzing',
  'awaiting_proposal',
  'awaiting_approval',
  'applying',
  'reconciling',
  'monitoring',
  'needs_input',
  'needs_review',
  'resolved',
  'escalated',
  'cancelled',
]);

const PROPOSAL_STATUSES = Object.freeze([
  'draft',
  'validated',
  'pending_approval',
  'approved',
  'rejected',
  'applying',
  'applied',
  'apply_failed',
  'partially_applied',
  'superseded',
  'invalidated',
  'reconciling',
]);

const ERROR_CATEGORIES = Object.freeze([
  'transient_infra',
  'llm_invalid',
  'business_data',
  'capability_gap',
  'concurrency',
  'apply_unknown',
  'apply_partial',
  'authz_config',
]);

const RECOVERY_STATUSES = Object.freeze([
  'retry_scheduled',
  'needs_input',
  'needs_review',
  'capability_limited',
  'invalidated_reanalyze',
  'reconciling',
  'partial_recovery_pending',
  'stopped_authz',
  'failed_terminal',
  'resolved',
]);

const INTERVENTION_LEVELS = Object.freeze([
  'detect_only',
  'forecast_label',
  'open_issue',
  'propose',
  'auto_safe',
  'approve_required',
]);

/** Default: remaining older than this cannot drive AT_RISK alone. */
const REMAINING_FRESH_HOURS_DEFAULT = 48;
const STALE_PROGRESS_DAYS_DEFAULT = 2;
const EXECUTION_CONTROL_FLAG = 'EXECUTION_CONTROL';

function isExecutionControlEnabled(env = process.env) {
  const v = String(env.EXECUTION_CONTROL ?? '1').trim().toLowerCase();
  return v !== '0' && v !== 'false' && v !== 'off';
}

module.exports = {
  ISSUE_KINDS,
  ISSUE_STATUSES,
  PROPOSAL_STATUSES,
  ERROR_CATEGORIES,
  RECOVERY_STATUSES,
  INTERVENTION_LEVELS,
  REMAINING_FRESH_HOURS_DEFAULT,
  STALE_PROGRESS_DAYS_DEFAULT,
  EXECUTION_CONTROL_FLAG,
  isExecutionControlEnabled,
};
