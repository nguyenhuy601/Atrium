/**
 * Phase 1 gate policy — Tech optional, SoD between stamps (DEC D6–D8).
 */

const {
  hasPermission,
  unionPermissionsFromRoles,
} = require('../utils/project/projectPermissionMatrix');
const { createTtlCoalesceCache } = require('./ttlCoalesceCache');

const GATE_SOD_ERROR = 'GATE_SOD_DENIED';
const TECH_FLAGS_TTL_MS = 30_000;
const techFlagsCache = createTtlCoalesceCache({ ttlMs: TECH_FLAGS_TTL_MS });

function isGateSodEnabled() {
  const v = String(process.env.PHASE1_GATE_SOD_ENABLED || '').trim().toLowerCase();
  if (v === '0' || v === 'false') return false;
  if (v === '1' || v === 'true') return true;
  return true;
}

/**
 * Batch “có tech reviewer trên project?” từ role docs (không N+1 resolve per member).
 * @param {Array<{ key?: string, permissions?: string[] }>} roles
 * @returns {{ hasAnalysisTechReviewer: boolean, hasPlanningTechReviewer: boolean }}
 */
function computeTechReviewerFlagsFromRoleDocs(roles = []) {
  const perms = unionPermissionsFromRoles(roles);
  return {
    hasAnalysisTechReviewer: hasPermission(perms, 'analysis:tech_review'),
    hasPlanningTechReviewer: hasPermission(perms, 'planning:tech_review'),
  };
}

/**
 * @param {string} projectId
 * @param {{ ProjectMembership?: object, ProjectRole?: object }} [deps]
 */
async function projectTechReviewerFlagsUncached(projectId, deps = {}) {
  const pid = String(projectId || '').trim();
  if (!pid) {
    return { hasAnalysisTechReviewer: false, hasPlanningTechReviewer: false };
  }
  const ProjectMembership = deps.ProjectMembership || require('../models/ProjectMembership');
  const ProjectRole = deps.ProjectRole || require('../models/ProjectRole');
  const memberships = await ProjectMembership.find({ projectId: pid }).select('projectRoleId').lean();
  const roleIds = [
    ...new Set(
      (memberships || [])
        .map((m) => m?.projectRoleId)
        .filter(Boolean)
        .map((id) => String(id))
    ),
  ];
  const roles = roleIds.length
    ? await ProjectRole.find({ _id: { $in: roleIds } }).select('key permissions').lean()
    : [];
  return computeTechReviewerFlagsFromRoleDocs(roles);
}

/**
 * Process-local TTL + coalesce — 1 memberships query + 1 roles query per project cold miss.
 * @param {string} projectId
 * @param {{ ProjectMembership?: object, ProjectRole?: object }} [deps]
 */
async function projectTechReviewerFlags(projectId, deps = {}) {
  const pid = String(projectId || '').trim();
  if (!pid) {
    return { hasAnalysisTechReviewer: false, hasPlanningTechReviewer: false };
  }
  if (deps.ProjectMembership || deps.ProjectRole) {
    return projectTechReviewerFlagsUncached(pid, deps);
  }
  return techFlagsCache.getOrLoad(`techFlags:${pid}`, () => projectTechReviewerFlagsUncached(pid));
}

/**
 * @param {string} projectId
 * @returns {Promise<boolean>}
 */
async function projectHasAnalysisTechReviewer(projectId) {
  const flags = await projectTechReviewerFlags(projectId);
  return Boolean(flags.hasAnalysisTechReviewer);
}

/**
 * Planning uses planning:tech_review (same people usually = tech_lead).
 * @param {string} projectId
 */
async function projectHasPlanningTechReviewer(projectId) {
  const flags = await projectTechReviewerFlags(projectId);
  return Boolean(flags.hasPlanningTechReviewer);
}

function clearTechReviewerFlagsCache() {
  techFlagsCache.clear();
}

/**
 * @param {{ actorUserId: string, priorStamps?: Array<{ userId?: unknown } | null | undefined>, bypass?: boolean }} args
 */
function assertGateStampSoD({ actorUserId, priorStamps = [], bypass = false }) {
  if (!isGateSodEnabled() || bypass) return;
  const actor = String(actorUserId || '').trim();
  if (!actor) return;
  for (const stamp of priorStamps) {
    const prev = stamp?.userId != null ? String(stamp.userId).trim() : '';
    if (prev && prev === actor) {
      const err = new Error(
        'Separation of duties: cùng tài khoản không được duyệt liên tiếp / nhiều cổng — đổi account đúng role'
      );
      err.statusCode = 403;
      err.errorCode = GATE_SOD_ERROR;
      throw err;
    }
  }
}

/**
 * requirement:* is org/persona auth — NOT in project role matrix.
 * Map to matrix keys so gate notify finds BA/PM/PO on the project.
 * @see requirementAccess.service.js + projectPermissionMatrix.js
 */
const GATE_NOTIFY_PERM_ALIASES = Object.freeze({
  'requirement:submit': 'analysis:submit_ba_review',
  'requirement:approve': 'analysis:po_review',
  /** HOW done / Gate2 PM lane — PM chủ trì, không phải PO run-ai-planning */
  'requirement:run-ai-planning': 'planning:pm_review',
});

/**
 * @param {string} permission
 * @returns {string}
 */
function resolveGateNotifyPermission(permission) {
  const raw = String(permission || '').trim();
  if (!raw) return '';
  return GATE_NOTIFY_PERM_ALIASES[raw] || raw;
}

/**
 * Collect membership userIds that hold a permission.
 * @param {string} projectId
 * @param {string} permission
 * @returns {Promise<string[]>}
 */
async function userIdsWithProjectPermission(projectId, permission) {
  const matrixPerm = resolveGateNotifyPermission(permission);
  if (!matrixPerm) return [];
  const ProjectMembership = require('../models/ProjectMembership');
  const { resolveUserProjectPermissions } = require('../services/projectAccess.service');
  const memberships = await ProjectMembership.find({ projectId }).select('userId').lean();
  const out = [];
  for (const m of memberships) {
    const uid = String(m.userId || '').trim();
    if (!uid) continue;
    const resolved = await resolveUserProjectPermissions({ userId: uid, projectId });
    if (hasPermission(resolved.permissions, matrixPerm)) out.push(uid);
  }
  return [...new Set(out)];
}

/**
 * After a forward gate, notify next reviewers.
 */
async function notifyNextGateReviewers({
  projectId,
  organizationId,
  actorUserId,
  nextPermission,
  title,
  content,
  kind,
  actionPath = 'phase1/analysis-reviews',
  packId = '',
}) {
  if (!nextPermission) return;
  try {
    const { notifySystemKind, projectHubActionUrl } = require('../clients/notification.client');
    const userIds = await userIdsWithProjectPermission(projectId, nextPermission);
    if (!userIds.length) return;
    const pid = String(packId || '').trim();
    const basePath = String(actionPath || 'ai-hitl').replace(/^\/+/, '');
    const actionUrl = pid
      ? projectHubActionUrl({
          projectId,
          organizationId,
          // Gate 1 sequential review: open Duyệt tab directly
          pathSuffix: `${basePath}?packId=${encodeURIComponent(pid)}&tab=review`,
        })
      : projectHubActionUrl({
          projectId,
          organizationId,
          module: actionPath,
        });
    await notifySystemKind({
      userIds,
      kind: kind || 'phase1_gate_pending',
      title: title || 'Có mục chờ duyệt',
      content: content || 'Bạn có quyền duyệt cổng tiếp theo.',
      data: {
        projectId: String(projectId),
        organizationId: String(organizationId || ''),
        packId: pid,
        kind: kind || 'phase1_gate_pending',
        nextPermission,
      },
      actionUrl,
      excludeUserId: actorUserId,
    });
  } catch {
    /* non-blocking */
  }
}

const AI_HITL_ACTION_PATH = 'ai-hitl';

/**
 * AI HITL pack gates — deep-link to ai-hitl workspace.
 */
async function notifyAiHitlGateReviewers({
  projectId,
  organizationId,
  actorUserId,
  packId,
  nextPermission,
  title,
  content,
  kind,
}) {
  if (!projectId || !nextPermission) return;
  await notifyNextGateReviewers({
    projectId,
    organizationId,
    actorUserId,
    nextPermission,
    title,
    content,
    kind: kind || 'ai_hitl_gate_pending',
    actionPath: AI_HITL_ACTION_PATH,
    packId,
  });
}

module.exports = {
  GATE_SOD_ERROR,
  GATE_NOTIFY_PERM_ALIASES,
  TECH_FLAGS_TTL_MS,
  isGateSodEnabled,
  computeTechReviewerFlagsFromRoleDocs,
  projectTechReviewerFlags,
  projectTechReviewerFlagsUncached,
  projectHasAnalysisTechReviewer,
  projectHasPlanningTechReviewer,
  clearTechReviewerFlagsCache,
  assertGateStampSoD,
  resolveGateNotifyPermission,
  userIdsWithProjectPermission,
  notifyNextGateReviewers,
  notifyAiHitlGateReviewers,
  AI_HITL_ACTION_PATH,
};
