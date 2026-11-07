/**
 * FE mirror of project-service deliveryPhase nav matrix.
 * Keep in sync with services/project-service/src/constants/projectDeliveryPhase.js
 */

import { canAccessProjectModule } from '../features/projects/projectCapabilities.js';

export const DELIVERY_PHASES = Object.freeze([
  'requirement_analysis',
  'delivery_planning',
  'development',
  'qa_uat',
  'release_handover',
]);

export const DEFAULT_DELIVERY_PHASE_EXISTING = 'development';

/**
 * Chat / calendar / documents / members / settings — collab/ops suite modules.
 * Nav + route vẫn gate theo canAccessProjectModule (view perm); không còn “luôn hiện”.
 */
export const PROJECT_COLLAB_OPS_MODULES = Object.freeze([
  'chat',
  'calendar',
  'documents',
  'settings',
  'members',
  'delivery-phase',
]);

const COLLAB_MIN = PROJECT_COLLAB_OPS_MODULES;

export const DEVELOPMENT_MODULES = Object.freeze([
  'overview',
  'list',
  'planning',
  'board',
  'chat',
  'timeline',
  'change-requests',
  'execution-control',
  'test-cases',
  'members',
  'files',
  'activity',
  'settings',
  'calendar',
  'documents',
  'delivery-phase',
]);

export const PLANNING_SUBMODULES = Object.freeze([
  'planning-overview',
  'planning-wbs',
  'planning-architecture',
  'planning-resources',
  'planning-dependencies',
  'planning-schedule',
  'planning-milestones',
  'planning-releases',
  'planning-risks',
  'planning-test-cases',
  'planning-approval',
  'planning/overview',
  'planning/wbs',
  'planning/architecture',
  'planning/resources',
  'planning/resources/wbs',
  'planning/resources/effort',
  'planning/resources/match',
  'planning/resources/capacity',
  'planning/resources/schedule',
  'planning/dependencies',
  'planning/schedule',
  'planning/milestones',
  'planning/releases',
  'planning/risks',
  'planning/test-cases',
  'planning/approval',
]);

export const PHASE_NAV_MODULES = Object.freeze({
  requirement_analysis: Object.freeze([
    'overview',
    'customer-documents',
    'analysis-bg',
    'analysis-br',
    'analysis-bpm',
    'analysis-fr',
    'analysis-uc',
    'analysis-nfr',
    'analysis-scope',
    'analysis-interface',
    'analysis-data',
    'analysis-glossary',
    'analysis-assumption',
    'traceability',
    'analysis-reviews',
    'srs-baselines',
    'ai-hitl',
    ...PLANNING_SUBMODULES,
    ...COLLAB_MIN,
  ]),
  delivery_planning: Object.freeze([
    'overview',
    'customer-documents',
    'analysis-bg',
    'analysis-br',
    'analysis-bpm',
    'analysis-fr',
    'analysis-uc',
    'analysis-nfr',
    'analysis-scope',
    'analysis-interface',
    'analysis-data',
    'analysis-glossary',
    'analysis-assumption',
    'srs-baselines',
    'ai-hitl',
    'traceability',
    'analysis-reviews',
    'delivery-planning',
    ...PLANNING_SUBMODULES,
    'planning',
    'timeline',
    ...COLLAB_MIN,
    'activity',
  ]),
  development: DEVELOPMENT_MODULES,
  qa_uat: Object.freeze([
    'overview',
    'list',
    'board',
    'test-cases',
    'change-requests',
    'execution-control',
    'files',
    ...COLLAB_MIN,
    'activity',
  ]),
  release_handover: Object.freeze([
    'overview',
    'handover',
    'deploy-evidence',
    'release-notes',
    'list',
    'board',
    'test-cases',
    'change-requests',
    'execution-control',
    'files',
    ...COLLAB_MIN,
    'activity',
  ]),
});

/** FE mirror of BE RELEASE_HANDOVER_CHECKLIST item ids (static checklist UX). */
export const RELEASE_HANDOVER_CHECKLIST_IDS = Object.freeze([
  'release_notes',
  'deployment_verified',
  'acceptance_signed_off',
  'handover_completed',
]);

/** Forward-only advances used by hub delivery phase panel. */
export const DELIVERY_PHASE_FORWARD = Object.freeze({
  development: Object.freeze(['qa_uat']),
  qa_uat: Object.freeze(['release_handover']),
});

export const PHASE_MODULE_LABEL_KEYS = Object.freeze({
  'customer-documents': 'workspace.phaseNavCustomerDocuments',
  'analysis-bg': 'workspace.phaseNavAnalysisBg',
  'analysis-br': 'workspace.phaseNavAnalysisBr',
  'analysis-bpm': 'workspace.phaseNavAnalysisBpm',
  'analysis-fr': 'workspace.phaseNavAnalysisFr',
  'analysis-uc': 'workspace.phaseNavAnalysisUc',
  'analysis-nfr': 'workspace.phaseNavAnalysisNfr',
  'analysis-scope': 'workspace.phaseNavAnalysisScope',
  'analysis-interface': 'workspace.phaseNavAnalysisInterface',
  'analysis-data': 'workspace.phaseNavAnalysisData',
  'analysis-glossary': 'workspace.phaseNavAnalysisGlossary',
  'analysis-assumption': 'workspace.phaseNavAnalysisAssumption',
  traceability: 'workspace.phaseNavTraceability',
  'analysis-reviews': 'workspace.phaseNavAnalysisReviews',
  'srs-baselines': 'workspace.phaseNavSrsBaselines',
  'delivery-planning': 'workspace.phaseNavDeliveryPlanning',
  'planning-overview': 'workspace.phaseNavPlanningOverview',
  'planning-wbs': 'workspace.phaseNavPlanningWbs',
  'planning-architecture': 'workspace.phaseNavPlanningArchitecture',
  'planning-resources': 'workspace.phaseNavPlanningResources',
  'planning-dependencies': 'workspace.phaseNavPlanningDependencies',
  'planning-schedule': 'workspace.phaseNavPlanningSchedule',
  'planning-milestones': 'workspace.phaseNavPlanningMilestones',
  'planning-releases': 'workspace.phaseNavPlanningReleases',
  'planning-risks': 'workspace.phaseNavPlanningRisks',
  'planning-test-cases': 'workspace.phaseNavPlanningTestCases',
  'planning-approval': 'workspace.phaseNavPlanningApproval',
  handover: 'workspace.phaseNavHandover',
  'deploy-evidence': 'workspace.phaseNavDeployEvidence',
  acceptance: 'workspace.phaseNavAcceptance',
  'release-notes': 'workspace.phaseNavReleaseNotes',
  'delivery-phase': 'workspace.phaseNavDeliveryPhase',
});

/** Modules that still fall back to placeholder if Phase1Shell not used */
export const ANALYSIS_PLACEHOLDER_MODULES = Object.freeze([]);

export function coerceDeliveryPhase(raw) {
  const value = String(raw || '')
    .trim()
    .toLowerCase();
  if (!value) return DEFAULT_DELIVERY_PHASE_EXISTING;
  if (DELIVERY_PHASES.includes(value)) return value;
  return DEFAULT_DELIVERY_PHASE_EXISTING;
}

/** Closure report tab — only when project status is closed (post-complete). */
export function isClosedProjectStatus(status) {
  const st = String(status || '')
    .trim()
    .toLowerCase();
  return st === 'closed' || st === 'completed';
}

/**
 * @param {string} moduleKey
 * @param {string} deliveryPhase
 * @param {{ projectStatus?: string }} [opts]
 */
export function isModuleAllowedForPhase(moduleKey, deliveryPhase, opts = {}) {
  const mod = String(moduleKey || '')
    .trim()
    .toLowerCase();
  if (mod === 'reports') {
    return isClosedProjectStatus(opts.projectStatus);
  }
  const phase = coerceDeliveryPhase(deliveryPhase);
  const allowed = PHASE_NAV_MODULES[phase] || DEVELOPMENT_MODULES;
  return allowed.includes(mod);
}

export function phaseHomeModule(deliveryPhase) {
  const phase = coerceDeliveryPhase(deliveryPhase);
  if (phase === 'development' || phase === 'qa_uat') return 'board';
  return 'overview';
}

export function deliveryPhaseLabelKey(deliveryPhase) {
  const phase = coerceDeliveryPhase(deliveryPhase);
  return `workspace.deliveryPhase_${phase}`;
}

/**
 * @param {array} items
 * @param {string} deliveryPhase
 * @param {{ projectStatus?: string }} [opts]
 */
export function filterNavItemsByDeliveryPhase(items, deliveryPhase, opts = {}) {
  const phase = coerceDeliveryPhase(deliveryPhase);
  const list = Array.isArray(items) ? items : [];
  return list.filter((item) =>
    isModuleAllowedForPhase(item.module || item.key, phase, {
      projectStatus: opts.projectStatus,
    })
  );
}

/**
 * Modules gated by capabilities.canViewAnalysis.
 * Caps are role-backed (Project Role key → projectPermissionMatrix), not org Permission Group.
 */
export const ANALYSIS_VIEW_MODULES = Object.freeze([
  'customer-documents',
  'analysis-bg',
  'analysis-br',
  'analysis-bpm',
  'analysis-fr',
  'analysis-uc',
  'analysis-nfr',
  'analysis-scope',
  'analysis-interface',
  'analysis-data',
  'analysis-glossary',
  'analysis-assumption',
  'traceability',
  'analysis-reviews',
  'srs-baselines',
]);

/**
 * Modules gated by capabilities.canViewPlanning (same role-backed source as analysis).
 * (planning hub backlog tab uses canViewBacklog — separate).
 */
export function isPlanningViewModule(moduleKey) {
  const mod = String(moduleKey || '')
    .trim()
    .toLowerCase();
  if (!mod) return false;
  if (mod === 'delivery-planning') return true;
  if (mod.startsWith('planning-') || mod.startsWith('planning/')) return true;
  return false;
}

export function isAnalysisViewModule(moduleKey) {
  const mod = String(moduleKey || '')
    .trim()
    .toLowerCase();
  return ANALYSIS_VIEW_MODULES.includes(mod);
}

/**
 * Legacy keys — phase UI may still set lockHintKey for delivery-phase locks (not capability).
 * Capability thiếu view: drop hẳn khỏi nav (không soft-lock).
 */
export const PHASE1_ANALYSIS_CAP_LOCK_HINT_KEY = 'workspace.phase1AnalysisCapLockedHint';
export const PHASE1_PLANNING_CAP_LOCK_HINT_KEY = 'workspace.phase1PlanningCapLockedHint';

/**
 * Drop nav items khi thiếu quyền view của module.
 * capabilities null/undefined → {} fail-closed (ẩn hầu hết trừ khi canAccess cho phép).
 */
export function filterNavItemsByCapabilities(items, capabilities) {
  const list = Array.isArray(items) ? items : [];
  return list.filter((item) => {
    const mod = String(item.module || item.key || '')
      .trim()
      .toLowerCase();
    return canAccessProjectModule(mod, capabilities);
  });
}

export function isPhase1DeliveryPhase(deliveryPhase) {
  const p = coerceDeliveryPhase(deliveryPhase);
  return p === 'requirement_analysis' || p === 'delivery_planning';
}
