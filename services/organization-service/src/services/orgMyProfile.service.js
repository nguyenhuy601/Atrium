/**
 * GET …/my-profile — identity + placement + scope nhẹ (không kèm structure tree).
 * FE: useOrgMyProfile / toShellCompat / personalOverview.
 */
const Organization = require('../models/Organization');
const Membership = require('../models/Membership');
const Department = require('../models/Department');
const Team = require('../models/Team');
const Division = require('../models/Division');
const EmployeePositionAssignment = require('../models/EmployeePositionAssignment');
const OrganizationalPosition = require('../models/OrganizationalPosition');
const { ORGANIZATION_ROLE_KEYS } = require('@enterprise/shared/config/roleTaxonomy');
const { listOrganizationRolesForUser } = require('./effectiveOrgRoles.service');
const { findPlacementByStructureMembers } = require('./structurePlacement.service');
const { getOrgShellVersion } = require('./orgShellRealtime.service');
const {
  buildAccessibleChannelData,
} = require('./orgShellData.service');
const { getCachedAccessibleChannelData } = require('./orgReadCache.service');
const { ensureDefaultOrgRoles, syncUserOrgRole } = require('./rolePermissionOrgSync');
const { fetchUserRolesInOrg } = require('../utils/orgRoles');
const {
  parseIncludeSet,
  weakEtagFromPayload,
  etagMatches,
} = require('../utils/orgMyProfileHelpers');

/**
 * People Graph head/leader → structureRoles (cùng shape FE resolveOrgRolesForUser).
 */
async function listStructureRolesForUser(organizationId, userId) {
  const oid = String(organizationId || '').trim();
  const uid = String(userId || '').trim();
  if (!oid || !uid) return [];

  const [headDepts, leadTeams] = await Promise.all([
    Department.find({ organization: oid, head: uid }).select('_id name').lean(),
    Team.find({ organization: oid, leader: uid, isActive: { $ne: false } })
      .select('_id name')
      .lean(),
  ]);

  const roles = [];
  for (const dep of headDepts || []) {
    const id = String(dep._id);
    roles.push({
      id: `dept-${id}`,
      roleKey: ORGANIZATION_ROLE_KEYS.DEPARTMENT_MANAGER,
      scopeType: 'department',
      scopeName: String(dep.name || '').trim(),
    });
  }
  for (const team of leadTeams || []) {
    const id = String(team._id);
    roles.push({
      id: `team-${id}`,
      roleKey: ORGANIZATION_ROLE_KEYS.TEAM_MANAGER,
      scopeType: 'team',
      scopeName: String(team.name || '').trim(),
    });
  }
  return roles;
}

async function resolveMyPosition(organizationId, userId) {
  const assign = await EmployeePositionAssignment.findOne({
    organizationId,
    userId,
    status: 'active',
  })
    .select('positionId')
    .lean();
  if (!assign?.positionId) return null;

  const position = await OrganizationalPosition.findOne({
    _id: assign.positionId,
    organizationId,
  })
    .select('_id name code status')
    .lean();
  if (!position) return null;

  return {
    id: String(position._id),
    name: String(position.name || '').trim(),
    code: String(position.code || '').trim(),
    status: position.status || 'active',
  };
}

async function buildPlacementPayload(organizationId, userId) {
  const [place, structureRoles] = await Promise.all([
    findPlacementByStructureMembers(organizationId, userId),
    listStructureRolesForUser(organizationId, userId),
  ]);

  const departmentId = place.primaryDepartmentId || null;
  const teamId = place.primaryTeamId || null;
  const divisionId =
    (Array.isArray(place.divisionIds) && place.divisionIds[0]) || null;

  let divisionName = '';
  if (divisionId) {
    const div = await Division.findById(divisionId).select('name').lean();
    divisionName = String(div?.name || '').trim();
  }

  return {
    departmentId,
    departmentName: String(place.departmentName || '').trim(),
    teamId,
    teamName: String(place.teamName || '').trim(),
    divisionId,
    divisionName,
    structureRoles,
  };
}

/**
 * @param {{ userId: string, orgId: string, access: object, include?: string }} args
 */
async function buildOrgMyProfile({ userId, orgId, access, include = '' }) {
  const includeSet = parseIncludeSet(include);

  const existingRoles = await fetchUserRolesInOrg(userId, orgId);
  if (existingRoles.length === 0 && access.membership) {
    await ensureDefaultOrgRoles(orgId);
    await syncUserOrgRole(userId, orgId, access.membership.role || 'member');
  }

  const membershipRole = access.membership?.role
    ? Membership.normalizeRole(access.membership.role)
    : null;

  const [myOrganizationRoles, myPosition, placement, accessData, shellVersion, orgDoc] =
    await Promise.all([
      listOrganizationRolesForUser(orgId, userId),
      resolveMyPosition(orgId, userId),
      buildPlacementPayload(orgId, userId),
      getCachedAccessibleChannelData(userId, orgId, access, buildAccessibleChannelData),
      getOrgShellVersion(orgId),
      includeSet.has('organization')
        ? Organization.findById(orgId).select('name slug logo').lean()
        : Promise.resolve(null),
    ]);

  const scope = accessData?.scope || {};
  const isElevated = ['owner', 'admin', 'hr'].includes(String(membershipRole || ''));
  const hasPlacement =
    Boolean(scope.departmentId) ||
    Boolean(scope.teamId) ||
    Boolean(placement.departmentId) ||
    Boolean(placement.teamId) ||
    (Array.isArray(scope.scopedDepartmentIds) && scope.scopedDepartmentIds.length > 0) ||
    (Array.isArray(scope.scopedTeamIds) && scope.scopedTeamIds.length > 0);
  const memberReady = Boolean(isElevated || scope.canSeeAllStructure || hasPlacement);

  const data = {
    myRole: membershipRole,
    myOrganizationRoles,
    myPosition,
    placement,
    scope,
    memberReady,
    memberReadyCode: memberReady ? null : 'ORG_MEMBER_NOT_READY',
    shellVersion,
  };

  if (includeSet.has('organization')) {
    data.organization = {
      id: String(orgId),
      name: orgDoc?.name || '',
      slug: orgDoc?.slug || '',
      icon: orgDoc?.logo || null,
      myRole: membershipRole,
      myOrganizationRoles,
      myPosition,
    };
  }

  return data;
}

module.exports = {
  buildOrgMyProfile,
  listStructureRolesForUser,
  resolveMyPosition,
};
