const mongoose = require('../db');
const Project = require('../models/Project');
const ProjectMembership = require('../models/ProjectMembership');
const TaskBoard = require('../models/TaskBoard');
const { fetchTaskWorkspaceScope } = require('./taskWorkspaceScope');
const { fetchProjectVisibilityContext } = require('../clients/orgVisibility.client');
const { createTtlCoalesceCache } = require('../utils/ttlCoalesceCache');
const {
  isProjectRbacEnabled,
  unionPermissionsFromRoles,
  matrixPermissionsFromRoleKeys,
  applyInformationLevelToPermissions,
  permissionsToBoardCapabilities,
  hasPermission,
  assertPermission,
  normalizePermissionList,
  VIEW_ONLY,
  PROJECT_PERMISSION_KEYS,
} = require('../utils/project/projectPermissionMatrix');
const { resolveProjectAccess } = require('../utils/project/projectVisibility');
const { readStoredSystemAdminState } = require('../clients/storedSystemRole.client');
const logger = require('@enterprise/shared/utils/logger');

/**
 * systemRole=admin (IT / platform) — cao hơn org membership admin / org roles.
 * Xác minh DB rồi bypass: cấp đủ PROJECT_PERMISSION_KEYS (không gán từng grant vào profile).
 */
async function resolveStoredPlatformAdmin(userId) {
  const stored = await readStoredSystemAdminState(userId);
  if (stored.state === 'unavailable') {
    logger.warn('[projectAccess] stored systemRole lookup unavailable user=%s', String(userId || ''));
    return false;
  }
  return stored.state === 'admin';
}

const RESOLVE_CACHE_TTL_MS = 60_000;
const resolveCache = createTtlCoalesceCache({ ttlMs: RESOLVE_CACHE_TTL_MS });
const MEMBERSHIP_BUNDLE_TTL_MS = 60_000;
const membershipBundleCache = createTtlCoalesceCache({ ttlMs: MEMBERSHIP_BUNDLE_TTL_MS });

function resolvePermissionsCacheKey({ userId, projectId, boardId } = {}) {
  const uid = String(userId || '').trim();
  if (!uid) return '';
  const pid = String(projectId || '').trim();
  if (pid) return `${uid}|p:${pid}`;
  const bid = String(boardId || '').trim();
  if (bid) return `${uid}|b:${bid}`;
  return '';
}

function membershipBundleCacheKey(projectId, userId) {
  const pid = String(projectId || '').trim();
  const uid = String(userId || '').trim();
  if (!pid || !uid) return '';
  return `${pid}|${uid}`;
}

function isOrgTemplateRoleDoc(role) {
  return Boolean(role) && (role.projectId == null || role.projectId === undefined);
}

async function loadMembershipRolesForUserUncached(projectId, userId) {
  const pid = String(projectId || '').trim();
  const uid = String(userId || '').trim();
  if (!pid || !uid || !mongoose.isValidObjectId(pid) || !mongoose.isValidObjectId(uid)) {
    return { memberships: [], roles: [] };
  }
  // One round-trip: memberships + role docs (avoids find + find $in).
  const rows = await ProjectMembership.aggregate([
    {
      $match: {
        projectId: new mongoose.Types.ObjectId(pid),
        userId: new mongoose.Types.ObjectId(uid),
      },
    },
    { $project: { projectRoleId: 1 } },
    {
      $lookup: {
        from: 'projectroles',
        let: { rid: '$projectRoleId' },
        pipeline: [
          { $match: { $expr: { $eq: ['$_id', '$$rid'] } } },
          { $project: { key: 1, permissions: 1, canAssign: 1, projectId: 1 } },
        ],
        as: 'roleDocs',
      },
    },
  ]);
  const memberships = (rows || []).map((r) => ({ projectRoleId: r.projectRoleId }));
  const roles = [];
  const seen = new Set();
  for (const row of rows || []) {
    const role = Array.isArray(row.roleDocs) ? row.roleDocs[0] : null;
    if (!role || !role._id) continue;
    const id = String(role._id);
    if (seen.has(id)) continue;
    seen.add(id);
    roles.push(role);
  }
  return { memberships, roles };
}

async function loadMembershipRolesForUser(projectId, userId) {
  const key = membershipBundleCacheKey(projectId, userId);
  if (!key) return loadMembershipRolesForUserUncached(projectId, userId);
  return membershipBundleCache.getOrLoad(key, () =>
    loadMembershipRolesForUserUncached(projectId, userId)
  );
}

/**
 * Resolve effective project permissions for a user on a project (uncached).
 * @param {{
 *   userId?: string,
 *   projectId?: string,
 *   boardId?: string,
 *   project?: object|null,
 *   visibilityCtx?: object|null,
 *   membershipBundle?: { memberships?: object[], roles?: object[] }|null,
 * }} [opts]
 *   `project` / `visibilityCtx` / `membershipBundle` — optional reuse from getProject hot path
 *   (skip re-fetch / S2S / duplicate membership+roles queries).
 */
async function resolveUserProjectPermissionsUncached({
  userId,
  projectId,
  boardId,
  project: projectHint = null,
  visibilityCtx: visibilityCtxHint = null,
  membershipBundle: membershipBundleHint = null,
} = {}) {
  const uid = String(userId || '').trim();
  let project = null;
  if (projectHint && projectHint._id && (!projectId || String(projectHint._id) === String(projectId))) {
    project = projectHint;
  } else if (projectId) {
    project = await Project.findById(projectId).lean();
  } else if (boardId) {
    const board = await TaskBoard.findById(boardId).select('projectId organizationId createdBy').lean();
    if (board?.projectId) {
      project = await Project.findById(board.projectId).lean();
      if (project && !project.createdBy && board.createdBy) {
        project = { ...project, createdBy: board.createdBy };
      }
    }
  }
  if (!project || project.isActive === false) {
    return {
      permissions: [],
      capabilities: permissionsToBoardCapabilities([]),
      isOrgAdmin: false,
      isCreator: false,
      isSystemAdmin: false,
      informationLevel: 'summary',
      rbac: isProjectRbacEnabled(),
    };
  }

  const isCreator = String(project.createdBy || '') === uid;

  const hasMembershipHint =
    membershipBundleHint &&
    typeof membershipBundleHint === 'object' &&
    Array.isArray(membershipBundleHint.memberships) &&
    Array.isArray(membershipBundleHint.roles);

  // Platform admin check + membership load in parallel (membership unused for admin early-return).
  const [isSystemAdmin, membershipBundle] = await Promise.all([
    resolveStoredPlatformAdmin(uid),
    hasMembershipHint
      ? Promise.resolve(membershipBundleHint)
      : loadMembershipRolesForUser(project._id, uid),
  ]);

  if (isSystemAdmin) {
    const perms = normalizePermissionList([...PROJECT_PERMISSION_KEYS]);
    return {
      permissions: perms,
      capabilities: permissionsToBoardCapabilities(perms),
      isOrgAdmin: false,
      isCreator,
      isSystemAdmin: true,
      informationLevel: 'details',
      rbac: isProjectRbacEnabled(),
      project,
      roles: [],
    };
  }

  // Prefer visibilityCtx.membershipRole (already loaded on getProject) — skip task-workspace-scope S2S.
  let isOrgAdmin = false;
  if (visibilityCtxHint && typeof visibilityCtxHint === 'object') {
    const orgRole = String(visibilityCtxHint.membershipRole || '').toLowerCase();
    isOrgAdmin = orgRole === 'owner' || orgRole === 'admin';
  } else {
    const scope = await fetchTaskWorkspaceScope(uid, project.organizationId);
    const orgRole = String(scope?.membershipRole || '').toLowerCase();
    isOrgAdmin = orgRole === 'owner' || orgRole === 'admin';
  }

  if (!isProjectRbacEnabled()) {
    return {
      permissions: [],
      capabilities: permissionsToBoardCapabilities([]),
      isOrgAdmin,
      isCreator,
      isSystemAdmin: false,
      informationLevel: 'details',
      rbac: false,
      project,
      roles: [],
    };
  }

  let { memberships, roles } = membershipBundle;
  let hasMembership = memberships.length > 0;
  const orgScopedRoleCount = roles.filter(isOrgTemplateRoleDoc).length;
  const hasEmptyRolePermissions = roles.some(
    (r) => !Array.isArray(r?.permissions) || r.permissions.length === 0
  );
  // Pure-read fast path: skip ensure when memberships already resolve healthy project-scoped roles.
  // Heal when org-template roles remain, orphan membership, or empty permissions needing hydrate.
  const needsRoleEnsure =
    orgScopedRoleCount > 0 || (hasMembership && roles.length === 0) || hasEmptyRolePermissions;
  if (needsRoleEnsure) {
    try {
      const { ensureProjectRolesCloned } = require('./projectTeam.service');
      await ensureProjectRolesCloned(project._id, project.organizationId);
    } catch (err) {
      logger.warn(
        '[projectAccess] ensureProjectRolesCloned failed project=%s: %s',
        String(project._id),
        err?.message || err
      );
    }
    const refreshed = await loadMembershipRolesForUser(project._id, uid);
    memberships = refreshed.memberships;
    roles = refreshed.roles;
    hasMembership = memberships.length > 0;
    const stillOrgScoped = roles.filter(isOrgTemplateRoleDoc).length;
    if (stillOrgScoped > 0) {
      logger.warn(
        '[projectAccess] membership still resolves org-template roles project=%s user=%s count=%s',
        String(project._id),
        uid,
        stillOrgScoped
      );
    }
  }

  // Board/hub ops: SoT = doc.permissions trên ProjectRole membership.
  // Membership owner/admin và cờ người tạo không nhận full key.

  // Align with getProject: membership row ⇒ member even if role docs failed to resolve.
  let perms = unionPermissionsFromRoles(roles);
  if (hasMembership && roles.length === 0) {
    logger.warn(
      '[projectAccess] orphan membership (no resolvable roles) project=%s user=%s — VIEW_ONLY fallback',
      String(project._id),
      uid
    );
    perms = normalizePermissionList(VIEW_ONLY);
  }

  let informationLevel = 'details';
  try {
    const visibilityCtx =
      visibilityCtxHint && typeof visibilityCtxHint === 'object'
        ? visibilityCtxHint
        : await fetchProjectVisibilityContext(project.organizationId, uid);
    const projectRoleKeys = roles.map((r) => String(r.key || '').trim()).filter(Boolean);
    const access = resolveProjectAccess({
      actor: {
        userId: uid,
        isOrgMember: visibilityCtx.isOrgMember,
        membershipRole: visibilityCtx.membershipRole,
        organizationRoleKeys: visibilityCtx.organizationRoleKeys,
        headedDepartmentIds: visibilityCtx.headedDepartmentIds,
        memberDepartmentIds: visibilityCtx.memberDepartmentIds,
      },
      project,
      membership: {
        isMember: hasMembership || roles.length > 0,
        projectRoleKeys,
      },
      orgPolicy: visibilityCtx.policy,
    });
    informationLevel = access.informationLevel || 'details';
    perms = applyInformationLevelToPermissions(perms, informationLevel);
  } catch {
    /* keep details */
  }

  return {
    permissions: normalizePermissionList(perms),
    capabilities: permissionsToBoardCapabilities(perms),
    isOrgAdmin,
    isCreator,
    isSystemAdmin: false,
    informationLevel,
    rbac: true,
    project,
    roles,
  };
}

/**
 * Resolve effective project permissions for a user on a project.
 * Process-local TTL + in-flight coalesce (key prefers projectId).
 */
async function resolveUserProjectPermissions(opts = {}) {
  const key = resolvePermissionsCacheKey(opts);
  if (!key) return resolveUserProjectPermissionsUncached(opts);
  return resolveCache.getOrLoad(key, () => resolveUserProjectPermissionsUncached(opts));
}

async function assertUserProjectPermission({ userId, projectId, boardId, permission, message }) {
  const resolved = await resolveUserProjectPermissions({ userId, projectId, boardId });
  assertPermission(resolved.permissions, permission, message);
  return resolved;
}

/**
 * BA-only ops (Raw/Analysis import): matrix theo role key hiện tại —
 * bỏ qua permissions array seed cũ trên ProjectRole doc; không creator/org-admin bypass.
 */
async function assertUserProjectRoleMatrixPermission({
  userId,
  projectId,
  boardId,
  permission,
  message,
}) {
  const resolved = await resolveUserProjectPermissions({ userId, projectId, boardId });
  const rolePerms = matrixPermissionsFromRoleKeys(resolved.roles || []);
  assertPermission(rolePerms, permission, message || `Thiếu quyền ${permission}`);
  return resolved;
}

/**
 * Cho phép một trong các key (vd. sprint:start fallback sprint:create).
 */
async function assertUserAnyProjectPermission({
  userId,
  projectId,
  boardId,
  permissions = [],
  message,
} = {}) {
  const resolved = await resolveUserProjectPermissions({ userId, projectId, boardId });
  const keys = (Array.isArray(permissions) ? permissions : [permissions])
    .map((k) => String(k || '').trim())
    .filter(Boolean);
  if (keys.some((k) => hasPermission(resolved.permissions, k))) return resolved;
  assertPermission(resolved.permissions, keys[0] || 'project:view', message);
  return resolved;
}

function _clearResolveUserProjectPermissionsCacheForTests() {
  resolveCache.clear();
  membershipBundleCache.clear();
}

/** Clear all resolve entries (org-default role permission updates affect many projects). */
function clearResolveUserProjectPermissionsCache() {
  resolveCache.clear();
  membershipBundleCache.clear();
}

function _setResolveUserProjectPermissionsCacheTtlForTests(ttlMs) {
  resolveCache.setTtlMs(ttlMs);
  membershipBundleCache.setTtlMs(ttlMs);
}

/** Invalidate all resolve entries for a project (and board keys for that project are harder — clear by projectId suffix). */
function invalidateResolveCacheForProject(projectId) {
  const pid = String(projectId || '').trim();
  if (!pid) return;
  resolveCache.invalidateWhere((k) => k.includes(`|p:${pid}`));
  membershipBundleCache.invalidateWhere((k) => k.startsWith(`${pid}|`));
  try {
    require('../utils/project/projectHubGetCache').invalidateHubGetCacheForProject(pid);
  } catch {
    /* ignore */
  }
}

module.exports = {
  resolveUserProjectPermissions,
  loadMembershipRolesForUser,
  assertUserProjectPermission,
  assertUserProjectRoleMatrixPermission,
  assertUserAnyProjectPermission,
  hasPermission,
  resolveStoredPlatformAdmin,
  invalidateResolveCacheForProject,
  clearResolveUserProjectPermissionsCache,
  _clearResolveUserProjectPermissionsCacheForTests,
  _setResolveUserProjectPermissionsCacheTtlForTests,
};
