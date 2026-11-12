/**
 * 16 domain quản trị — khung sidebar + route.
 * `implementation` trỏ tới màn đã có; còn lại hiển thị placeholder.
 */

export { ADMIN_SUITE_COLOR, ADMIN_SUITE_ACCENT } from './adminSuiteTokens';

export const ADMIN_DOMAIN_STORAGE_KEY = 'vh_admin_active_domain';

/**
 * @typedef {{
 *   id: string,
 *   path: string,
 *   labelKey: string,
 *   end?: boolean,
 *   implementation?: string,
 *   badgeKey?: string,
 *   settingsTab?: string,
 *   nav?: 'link' | 'action' | 'hidden',
 *   actionGroup?: string,
 *   requiredGrant?: string,
 * }} AdminNavItem
 */
/** @typedef {{ id: string, labelKey?: string, items: AdminNavItem[] }} AdminNavSection */

/** Nhóm verb trên sidebar — Users / Accounts / Org / RBAC / Channels / Chat / Voice / Files / Backup. Route không đổi. */
export const ADMIN_NAV_ACTION_GROUPS = {
  peopleOps: { labelKey: 'adminDomains.users.actionGroup' },
  accountOps: { labelKey: 'adminDomains.accounts.actionGroup' },
  deptOps: { labelKey: 'adminDomains.orgStructure.deptActionGroup' },
  teamOps: { labelKey: 'adminDomains.orgStructure.teamActionGroup' },
  divisionOps: { labelKey: 'adminDomains.orgStructure.divisionActionGroup' },
  branchOps: { labelKey: 'adminDomains.orgStructure.branchActionGroup' },
  posOps: { labelKey: 'adminDomains.rbac.posActionGroup' },
  orgRoleOps: { labelKey: 'adminDomains.rbac.orgRoleActionGroup' },
  projectRoleOps: { labelKey: 'adminDomains.rbac.projectRoleActionGroup' },
  permPackOps: { labelKey: 'adminDomains.rbac.permPackActionGroup' },
  channelOps: { labelKey: 'adminDomains.channels.actionGroup' },
  chatOps: { labelKey: 'adminDomains.chat.actionGroup' },
  voiceOps: { labelKey: 'adminDomains.voice.actionGroup' },
  fileOps: { labelKey: 'adminDomains.files.actionGroup' },
};

/**
 * Giữ thứ tự config: link hiện thẳng; `nav:'action'` gom theo actionGroup; `nav:'hidden'` không lên sidebar (bookmark vẫn resolve).
 * @param {AdminNavItem[]} items
 * @returns {Array<{ type: 'item', item: AdminNavItem } | { type: 'group', id: string, labelKey: string, items: AdminNavItem[] }>}
 */
export function splitNavSectionItems(items = []) {
  const rows = [];
  const groups = new Map();
  for (const item of items) {
    if (item?.nav === 'hidden') continue;
    const groupId = item?.nav === 'action' ? String(item.actionGroup || '').trim() : '';
    if (!groupId) {
      rows.push({ type: 'item', item });
      continue;
    }
    let group = groups.get(groupId);
    if (!group) {
      const meta = ADMIN_NAV_ACTION_GROUPS[groupId];
      group = {
        type: 'group',
        id: groupId,
        labelKey: meta?.labelKey || item.labelKey,
        items: [],
      };
      groups.set(groupId, group);
      rows.push(group);
    }
    group.items.push(item);
  }
  return rows;
}

/**
 * @type {Array<{
 *   id: string,
 *   path: string,
 *   labelKey: string,
 *   icon: string,
 *   adminOnly?: boolean,
 *   navAccordion?: boolean,
 *   sections: AdminNavSection[]
 * }>}
 */
export const ADMIN_DOMAINS = [
  {
    id: 'users',
    path: '/admin/users',
    labelKey: 'adminDomains.users.title',
    icon: 'Users',
    sections: [
      {
        id: 'main',
        items: [
          { id: 'list', path: '/admin/users', labelKey: 'adminDomains.users.list', end: true, implementation: 'people', requiredGrant: 'organization.employee.view' },
          { id: 'import', path: '/admin/users/import', labelKey: 'adminDomains.users.import', implementation: 'users-import-hub', requiredGrant: 'organization.employee.invite' },
          {
            id: 'people-ops',
            path: '/admin/users/people-ops',
            labelKey: 'adminDomains.users.peopleOpsHub',
            implementation: 'users-people-ops',
            requiredGrant: 'organization.employee.update',
          },
          {
            id: 'edit',
            path: '/admin/users/edit',
            labelKey: 'adminDomains.users.edit',
            implementation: 'users-edit',
            nav: 'hidden',
            requiredGrant: 'organization.employee.update',
          },
          {
            id: 'assign-org',
            path: '/admin/users/assign-org',
            labelKey: 'adminDomains.users.assignOrg',
            implementation: 'users-assign-org',
            nav: 'hidden',
            requiredGrant: 'organization.employee.update',
          },
          {
            id: 'delete',
            path: '/admin/users/delete',
            labelKey: 'adminDomains.users.delete',
            implementation: 'users-delete',
            nav: 'hidden',
            requiredGrant: 'organization.employee.delete',
          },
        ],
      },
    ],
  },
  {
    id: 'accounts',
    path: '/admin/accounts',
    labelKey: 'adminDomains.accounts.title',
    icon: 'KeyRound',
    sections: [
      {
        id: 'main',
        items: [
          { id: 'list', path: '/admin/accounts', labelKey: 'adminDomains.accounts.list', end: true, implementation: 'accounts-list', requiredGrant: 'organization.employee.view' },
          {
            id: 'password-hub',
            path: '/admin/accounts/password',
            labelKey: 'adminDomains.accounts.passwordHub',
            implementation: 'accounts-password-hub',
            requiredGrant: 'organization.employee.reset_password',
          },
          {
            id: 'access-hub',
            path: '/admin/accounts/access',
            labelKey: 'adminDomains.accounts.accessHub',
            implementation: 'accounts-access-hub',
            requiredGrant: 'organization.employee.disable',
          },
          {
            id: 'verification-hub',
            path: '/admin/accounts/verification',
            labelKey: 'adminDomains.accounts.verificationHub',
            implementation: 'accounts-verification-hub',
            requiredGrant: 'organization.employee.update',
          },
          {
            id: 'detail',
            path: '/admin/accounts/detail',
            labelKey: 'adminDomains.accounts.detail',
            implementation: 'accounts-detail',
            nav: 'hidden',
            requiredGrant: 'organization.employee.view',
          },
          {
            id: 'login-history',
            path: '/admin/accounts/login-history',
            labelKey: 'adminDomains.accounts.loginHistory',
            implementation: 'accounts-login-history',
            nav: 'hidden',
            requiredGrant: 'organization.employee.view',
          },
          {
            id: 'resend-verification',
            path: '/admin/accounts/resend-verification',
            labelKey: 'adminDomains.accounts.resendVerification',
            implementation: 'accounts-resend-verification',
            nav: 'hidden',
            requiredGrant: 'organization.employee.update',
          },
          {
            id: 'activate',
            path: '/admin/accounts/activate',
            labelKey: 'adminDomains.accounts.activate',
            implementation: 'accounts-activate',
            nav: 'hidden',
            requiredGrant: 'organization.employee.update',
          },
          {
            id: 'reset-password',
            path: '/admin/accounts/reset-password',
            labelKey: 'adminDomains.accounts.resetPassword',
            implementation: 'accounts-reset-password',
            nav: 'hidden',
            requiredGrant: 'organization.employee.reset_password',
          },
          {
            id: 'force-password',
            path: '/admin/accounts/force-password',
            labelKey: 'adminDomains.accounts.forcePassword',
            implementation: 'accounts-force-password',
            nav: 'hidden',
            requiredGrant: 'organization.employee.reset_password',
          },
          {
            id: 'set-password',
            path: '/admin/accounts/set-password',
            labelKey: 'adminDomains.accounts.setPassword',
            implementation: 'accounts-set-password',
            nav: 'hidden',
            requiredGrant: 'organization.employee.reset_password',
          },
          {
            id: 'revoke-sessions',
            path: '/admin/accounts/revoke-sessions',
            labelKey: 'adminDomains.accounts.revokeSessions',
            implementation: 'accounts-revoke-sessions',
            nav: 'hidden',
            requiredGrant: 'organization.employee.disable',
          },
          {
            id: 'lock',
            path: '/admin/accounts/lock',
            labelKey: 'adminDomains.accounts.lock',
            implementation: 'accounts-lock',
            nav: 'hidden',
            requiredGrant: 'organization.employee.disable',
          },
        ],
      },
    ],
  },
  {
    id: 'org-structure',
    path: '/admin/org-structure',
    labelKey: 'adminDomains.orgStructure.title',
    icon: 'Building2',
    navAccordion: true,
    // Huy: Domain Cơ cấu tổ chức — implementation ids cho từng màn
    sections: [
      {
        id: 'dynamic',
        labelKey: 'adminDomains.orgStructure.sectionDynamic',
        items: [
          { id: 'levels', path: '/admin/org-structure/levels', labelKey: 'adminDomains.orgStructure.levels', end: true, implementation: 'org-levels', requiredGrant: 'organization.structure.view' },
          { id: 'unit-tree', path: '/admin/org-structure/units', labelKey: 'adminDomains.orgStructure.unitTree', implementation: 'org-unit-tree', requiredGrant: 'organization.structure.view' },
        ],
      },
      {
        id: 'departments',
        labelKey: 'adminDomains.orgStructure.sectionDepartments',
        items: [
          { id: 'dept-list', path: '/admin/org-structure/departments', labelKey: 'adminDomains.orgStructure.deptList', end: true, implementation: 'org-dept-list', requiredGrant: 'organization.department.view' },
          { id: 'dept-create', path: '/admin/org-structure/departments/create', labelKey: 'adminDomains.orgStructure.deptCreate', implementation: 'org-dept-create', requiredGrant: 'organization.department.create' },
          {
            id: 'dept-manage',
            path: '/admin/org-structure/departments/manage',
            labelKey: 'adminDomains.orgStructure.deptManageHub',
            implementation: 'org-dept-manage',
            requiredGrant: 'organization.department.view',
          },
          { id: 'dept-edit', path: '/admin/org-structure/departments/edit', labelKey: 'adminDomains.orgStructure.deptEdit', implementation: 'org-dept-edit', nav: 'hidden', requiredGrant: 'organization.department.update' },
          { id: 'dept-disable', path: '/admin/org-structure/departments/disable', labelKey: 'adminDomains.orgStructure.deptDisable', implementation: 'org-dept-disable', nav: 'hidden', requiredGrant: 'organization.department.update' },
          { id: 'dept-parent', path: '/admin/org-structure/departments/parent', labelKey: 'adminDomains.orgStructure.deptParent', implementation: 'org-dept-parent', nav: 'hidden', requiredGrant: 'organization.department.update' },
          { id: 'dept-head', path: '/admin/org-structure/departments/head', labelKey: 'adminDomains.orgStructure.deptHead', implementation: 'org-dept-head', nav: 'hidden', requiredGrant: 'organization.department.update' },
          { id: 'dept-members', path: '/admin/org-structure/departments/members', labelKey: 'adminDomains.orgStructure.deptMembers', implementation: 'org-dept-members', nav: 'hidden', requiredGrant: 'organization.department.update' },
          { id: 'dept-org-roles', path: '/admin/org-structure/departments/org-roles', labelKey: 'adminDomains.orgStructure.deptOrgRoles', implementation: 'org-dept-org-roles', nav: 'hidden', requiredGrant: 'organization.department.update' },
          { id: 'dept-transfer', path: '/admin/org-structure/departments/transfer', labelKey: 'adminDomains.orgStructure.deptTransfer', implementation: 'org-dept-transfer', requiredGrant: 'organization.department.update' },
        ],
      },
      {
        id: 'teams',
        labelKey: 'adminDomains.orgStructure.sectionTeams',
        items: [
          { id: 'team-list', path: '/admin/org-structure/teams', labelKey: 'adminDomains.orgStructure.teamList', end: true, implementation: 'org-team-list', requiredGrant: 'organization.team.view' },
          { id: 'team-create', path: '/admin/org-structure/teams/create', labelKey: 'adminDomains.orgStructure.teamCreate', implementation: 'org-team-create', requiredGrant: 'organization.team.create' },
          {
            id: 'team-manage',
            path: '/admin/org-structure/teams/manage',
            labelKey: 'adminDomains.orgStructure.teamManageHub',
            implementation: 'org-team-manage',
            requiredGrant: 'organization.team.view',
          },
          { id: 'team-edit', path: '/admin/org-structure/teams/edit', labelKey: 'adminDomains.orgStructure.teamEdit', implementation: 'org-team-edit', nav: 'hidden', requiredGrant: 'organization.team.update' },
          { id: 'team-archive', path: '/admin/org-structure/teams/archive', labelKey: 'adminDomains.orgStructure.teamArchive', implementation: 'org-team-archive', nav: 'hidden', requiredGrant: 'organization.team.update' },
          { id: 'team-members', path: '/admin/org-structure/teams/members', labelKey: 'adminDomains.orgStructure.teamMembers', implementation: 'org-team-members', nav: 'hidden', requiredGrant: 'organization.team.update' },
          { id: 'team-leader', path: '/admin/org-structure/teams/leader', labelKey: 'adminDomains.orgStructure.teamLeader', implementation: 'org-team-leader', nav: 'hidden', requiredGrant: 'organization.team.update' },
          { id: 'team-dept', path: '/admin/org-structure/teams/department', labelKey: 'adminDomains.orgStructure.teamDept', implementation: 'org-team-dept', nav: 'hidden', requiredGrant: 'organization.team.update' },
        ],
      },
      {
        id: 'divisions',
        labelKey: 'adminDomains.orgStructure.sectionDivisions',
        items: [
          { id: 'division-list', path: '/admin/org-structure/divisions', labelKey: 'adminDomains.orgStructure.divisionList', end: true, implementation: 'org-division-list', requiredGrant: 'organization.division.view' },
          { id: 'division-create', path: '/admin/org-structure/divisions/create', labelKey: 'adminDomains.orgStructure.divisionCreate', implementation: 'org-division-create', requiredGrant: 'organization.division.create' },
          {
            id: 'division-manage',
            path: '/admin/org-structure/divisions/manage',
            labelKey: 'adminDomains.orgStructure.divisionManageHub',
            implementation: 'org-division-manage',
            requiredGrant: 'organization.division.view',
          },
          { id: 'division-edit', path: '/admin/org-structure/divisions/edit', labelKey: 'adminDomains.orgStructure.divisionEdit', implementation: 'org-division-edit', nav: 'hidden', requiredGrant: 'organization.division.update' },
          { id: 'division-disable', path: '/admin/org-structure/divisions/disable', labelKey: 'adminDomains.orgStructure.divisionDisable', implementation: 'org-division-disable', nav: 'hidden', requiredGrant: 'organization.division.update' },
          { id: 'division-dept', path: '/admin/org-structure/divisions/departments', labelKey: 'adminDomains.orgStructure.divisionDept', implementation: 'org-division-dept', nav: 'hidden', requiredGrant: 'organization.division.update' },
        ],
      },
      {
        id: 'branches',
        labelKey: 'adminDomains.orgStructure.sectionBranches',
        items: [
          { id: 'branch-list', path: '/admin/org-structure/branches', labelKey: 'adminDomains.orgStructure.branchList', end: true, implementation: 'org-branch-list', requiredGrant: 'organization.branch.view' },
          { id: 'branch-create', path: '/admin/org-structure/branches/create', labelKey: 'adminDomains.orgStructure.branchCreate', implementation: 'org-branch-create', requiredGrant: 'organization.branch.create' },
          {
            id: 'branch-manage',
            path: '/admin/org-structure/branches/manage',
            labelKey: 'adminDomains.orgStructure.branchManageHub',
            implementation: 'org-branch-manage',
            requiredGrant: 'organization.branch.view',
          },
          { id: 'branch-edit', path: '/admin/org-structure/branches/edit', labelKey: 'adminDomains.orgStructure.branchEdit', implementation: 'org-branch-edit', nav: 'hidden', requiredGrant: 'organization.branch.update' },
          { id: 'branch-disable', path: '/admin/org-structure/branches/disable', labelKey: 'adminDomains.orgStructure.branchDisable', implementation: 'org-branch-disable', nav: 'hidden', requiredGrant: 'organization.branch.update' },
          { id: 'branch-dept', path: '/admin/org-structure/branches/departments', labelKey: 'adminDomains.orgStructure.branchDept', implementation: 'org-branch-dept', nav: 'hidden', requiredGrant: 'organization.branch.update' },
        ],
      },
      {
        id: 'backup',
        labelKey: 'adminDomains.backup.title',
        items: [
          {
            id: 'backup',
            path: '/admin/backup',
            labelKey: 'adminDomains.backup.backup',
            end: true,
            implementation: 'backup-ops',
            adminOnly: true,
          },
        ],
      },
      {
        id: 'system-config',
        labelKey: 'adminDomains.systemConfig.title',
        items: [
          {
            id: 'config-hub',
            path: '/admin/system-config',
            labelKey: 'adminDomains.systemConfig.configHub',
            end: true,
            implementation: 'system-config-hub',
            // Cấu hình tổ chức — chỉ DIRECTOR (policy.update), không mở bằng policy.view (AUDITOR).
            requiredGrant: 'organization.policy.update',
          },
          {
            id: 'company',
            path: '/admin/system-config/company',
            labelKey: 'adminDomains.systemConfig.company',
            implementation: 'settings-general',
            settingsTab: 'general',
            nav: 'hidden',
            requiredGrant: 'organization.policy.update',
          },
          {
            id: 'retention',
            path: '/admin/system-config/retention',
            labelKey: 'adminDomains.systemConfig.retention',
            implementation: 'governance-retention',
            nav: 'hidden',
            requiredGrant: 'organization.policy.update',
          },
          {
            id: 'structure',
            path: '/admin/system-config/structure',
            labelKey: 'adminDomains.systemConfig.structure',
            implementation: 'settings-structure',
            settingsTab: 'structure',
            nav: 'hidden',
            requiredGrant: 'organization.structure.update',
          },
        ],
      },
    ],
  },
  {
    id: 'rbac',
    path: '/admin/rbac',
    labelKey: 'adminDomains.rbac.title',
    icon: 'Shield',
    navAccordion: true,
    sections: [
      {
        id: 'overview',
        labelKey: 'adminDomains.rbac.sectionOverview',
        items: [
          {
            id: 'taxonomy',
            path: '/admin/rbac',
            labelKey: 'adminDomains.rbac.taxonomy',
            end: true,
            implementation: 'rbac-taxonomy',
            requiredGrant: 'organization.organization_role.view',
          },
          {
            id: 'permissions-by-domain',
            path: '/admin/rbac/permissions-by-domain',
            labelKey: 'adminDomains.rbac.permissionsByDomain',
            implementation: 'rbac-permissions-by-domain',
            requiredGrant: 'organization.organization_role.view',
          },
          // master-data Catalog — tắt (SoT mới = entity tạo thực)
          {
            id: 'master-data',
            path: '/admin/rbac/master-data',
            labelKey: 'adminDomains.rbac.masterData',
            implementation: 'rbac-master-data',
            nav: 'hidden',
            requiredGrant: 'organization.master_data.view',
          },
        ],
      },
      {
        id: 'orgRoles',
        labelKey: 'adminDomains.rbac.sectionOrgRoles',
        items: [
          {
            id: 'org-role-list',
            path: '/admin/rbac/org-roles',
            labelKey: 'adminDomains.rbac.orgRoleCatalog',
            end: true,
            implementation: 'rbac-org-role-list',
            requiredGrant: 'organization.organization_role.view',
          },
          {
            id: 'org-role-create',
            path: '/admin/rbac/org-roles/create',
            labelKey: 'adminDomains.rbac.orgRoleCreate',
            implementation: 'rbac-org-role-create',
            requiredGrant: 'organization.organization_role.update',
          },
          {
            id: 'org-role-permission-matrix',
            path: '/admin/rbac/org-roles/permissions',
            labelKey: 'adminDomains.rbac.orgRolePermissionMatrix',
            implementation: 'rbac-org-role-permission-matrix',
            requiredGrant: 'organization.organization_role.update',
          },
          {
            id: 'org-role-manage',
            path: '/admin/rbac/org-roles/manage',
            labelKey: 'adminDomains.rbac.orgRoleManageHub',
            implementation: 'rbac-org-role-manage',
            requiredGrant: 'organization.organization_role.view',
          },
          { id: 'org-role-edit', path: '/admin/rbac/org-roles/edit', labelKey: 'adminDomains.rbac.orgRoleEdit', implementation: 'rbac-org-role-edit', nav: 'hidden', requiredGrant: 'organization.organization_role.update' },
          { id: 'org-role-delete', path: '/admin/rbac/org-roles/delete', labelKey: 'adminDomains.rbac.orgRoleDelete', implementation: 'rbac-org-role-delete', nav: 'hidden', requiredGrant: 'organization.organization_role.update' },
          {
            id: 'org-role-lookup',
            path: '/admin/rbac/org-roles/lookup',
            labelKey: 'adminDomains.rbac.orgRoleLookup',
            implementation: 'rbac-org-role-lookup',
            nav: 'hidden',
            requiredGrant: 'organization.organization_role.view',
          },
          {
            id: 'org-role-assign',
            path: '/admin/rbac/org-roles/assign',
            labelKey: 'adminDomains.rbac.orgRoleAssign',
            implementation: 'rbac-org-role-assign',
            nav: 'hidden',
            requiredGrant: 'organization.organization_role.update',
          },
          {
            id: 'org-role-directory',
            path: '/admin/rbac/org-roles/directory',
            labelKey: 'adminDomains.rbac.orgRoleDirectory',
            implementation: 'rbac-org-role-directory',
            nav: 'hidden',
            requiredGrant: 'organization.organization_role.view',
          },
        ],
      },
      {
        id: 'positions',
        labelKey: 'adminDomains.rbac.sectionPositions',
        items: [
          {
            id: 'pos-list',
            path: '/admin/rbac/positions',
            labelKey: 'adminDomains.rbac.posList',
            end: true,
            implementation: 'rbac-pos-list',
            requiredGrant: 'organization.position.view',
          },
          {
            id: 'pos-create',
            path: '/admin/rbac/positions/create',
            labelKey: 'adminDomains.rbac.posCreate',
            implementation: 'rbac-pos-create',
            requiredGrant: 'organization.position.create',
          },
          {
            id: 'pos-manage',
            path: '/admin/rbac/positions/manage',
            labelKey: 'adminDomains.rbac.posManageHub',
            implementation: 'rbac-pos-manage',
            requiredGrant: 'organization.position.view',
          },
          {
            id: 'pos-role-bind',
            path: '/admin/rbac/positions/roles',
            labelKey: 'adminDomains.rbac.positionRoleBind',
            implementation: 'rbac-pos-role-bind',
            requiredGrant: 'organization.position.update',
          },
          { id: 'pos-assign', path: '/admin/rbac/positions/assign', labelKey: 'adminDomains.rbac.posAssign', implementation: 'rbac-pos-assign', requiredGrant: 'organization.position.update' },
          { id: 'pos-edit', path: '/admin/rbac/positions/edit', labelKey: 'adminDomains.rbac.posEdit', implementation: 'rbac-pos-edit', nav: 'hidden', requiredGrant: 'organization.position.update' },
          { id: 'pos-disable', path: '/admin/rbac/positions/disable', labelKey: 'adminDomains.rbac.posDisable', implementation: 'rbac-pos-disable', nav: 'hidden', requiredGrant: 'organization.position.update' },
        ],
      },
      {
        id: 'projectRoles',
        labelKey: 'adminDomains.rbac.sectionProjectRoles',
        items: [
          {
            id: 'project-role-list',
            path: '/admin/rbac/project-roles',
            labelKey: 'adminDomains.rbac.projectRoleCatalog',
            implementation: 'rbac-project-role-list',
            end: true,
            adminOnly: true,
            requiredGrant: 'organization.master_data.view',
          },
          {
            id: 'project-role-create',
            path: '/admin/rbac/project-roles/create',
            labelKey: 'adminDomains.rbac.projectRoleCreate',
            implementation: 'rbac-project-role-create',
            adminOnly: true,
            requiredGrant: 'organization.master_data.update',
          },
          {
            id: 'project-role-board',
            path: '/admin/rbac/project-roles/board',
            labelKey: 'adminDomains.rbac.projectRoleBoard',
            implementation: 'rbac-project-role-board',
            adminOnly: true,
            requiredGrant: 'organization.master_data.view',
          },
          {
            id: 'project-role-manage',
            path: '/admin/rbac/project-roles/manage',
            labelKey: 'adminDomains.rbac.projectRoleManageHub',
            implementation: 'rbac-project-role-manage',
            adminOnly: true,
            requiredGrant: 'organization.master_data.view',
          },
          {
            id: 'project-role-edit',
            path: '/admin/rbac/project-roles/edit',
            labelKey: 'adminDomains.rbac.projectRoleEdit',
            implementation: 'rbac-project-role-edit',
            nav: 'hidden',
            adminOnly: true,
            requiredGrant: 'organization.master_data.update',
          },
          {
            id: 'project-role-delete',
            path: '/admin/rbac/project-roles/delete',
            labelKey: 'adminDomains.rbac.projectRoleDelete',
            implementation: 'rbac-project-role-delete',
            nav: 'hidden',
            adminOnly: true,
            requiredGrant: 'organization.master_data.update',
          },
        ],
      },
      {
        // id path giữ systemRoles (URL /rbac/roles); copy UI = Permission / Gói quyền.
        id: 'systemRoles',
        labelKey: 'adminDomains.rbac.sectionSystemRoles',
        items: [
          { id: 'roles', path: '/admin/rbac/roles', labelKey: 'adminDomains.rbac.roles', implementation: 'rbac-list', nav: 'hidden', requiredGrant: 'system.permission_group.view' },
          { id: 'create', path: '/admin/rbac/create', labelKey: 'adminDomains.rbac.create', implementation: 'rbac-create', nav: 'hidden', requiredGrant: 'system.permission_group.clone' },
          { id: 'permissions', path: '/admin/rbac/permissions', labelKey: 'adminDomains.rbac.permissions', implementation: 'rbac-permissions', nav: 'hidden', requiredGrant: 'system.permission_group.update_grant' },
          { id: 'hierarchy', path: '/admin/rbac/hierarchy', labelKey: 'adminDomains.rbac.hierarchy', implementation: 'rbac-hierarchy', nav: 'hidden', requiredGrant: 'system.permission_group.view' },
          { id: 'matrix', path: '/admin/rbac/matrix', labelKey: 'adminDomains.rbac.matrix', implementation: 'rbac-matrix', nav: 'hidden', requiredGrant: 'system.permission_group.view' },
          {
            id: 'perm-pack-manage',
            path: '/admin/rbac/roles/manage',
            labelKey: 'adminDomains.rbac.permPackManageHub',
            implementation: 'rbac-perm-pack-manage',
            nav: 'hidden',
            requiredGrant: 'system.permission_group.view',
          },
          { id: 'assign', path: '/admin/rbac/assign', labelKey: 'adminDomains.rbac.assign', implementation: 'rbac-assign', nav: 'hidden', requiredGrant: 'system.permission_group.assign' },
          { id: 'revoke', path: '/admin/rbac/revoke', labelKey: 'adminDomains.rbac.revoke', implementation: 'rbac-revoke', nav: 'hidden', requiredGrant: 'system.permission_group.assign' },
          { id: 'delete', path: '/admin/rbac/delete', labelKey: 'adminDomains.rbac.delete', implementation: 'rbac-delete', nav: 'hidden', requiredGrant: 'system.permission_group.clone' },
          {
            id: 'edit',
            path: '/admin/rbac/edit',
            labelKey: 'adminDomains.rbac.edit',
            implementation: 'rbac-edit',
            nav: 'hidden',
            requiredGrant: 'system.permission_group.rename',
          },
        ],
      },
    ],
  },
  {
    id: 'channels',
    path: '/admin/channels',
    labelKey: 'adminDomains.channels.title',
    icon: 'Hash',
    nav: 'hidden',
    sections: [
      {
        id: 'main',
        items: [
          { id: 'list', path: '/admin/channels', labelKey: 'adminDomains.channels.list', end: true, implementation: 'channels-list', requiredGrant: 'communication.channel.view' },
        ],
      },
    ],
  },
  {
    id: 'chat',
    path: '/admin/chat',
    labelKey: 'adminDomains.chat.title',
    icon: 'MessageSquare',
    sections: [
      {
        id: 'main',
        items: [
          {
            id: 'config-hub',
            path: '/admin/chat',
            labelKey: 'adminDomains.chat.configHub',
            end: true,
            requiredGrant: 'communication.chat.view',
          },
        ],
      },
    ],
  },
  {
    id: 'voice',
    path: '/admin/voice',
    labelKey: 'adminDomains.voice.title',
    icon: 'Mic',
    sections: [
      {
        id: 'main',
        items: [
          { id: 'rooms', path: '/admin/voice', labelKey: 'adminDomains.voice.rooms', end: true, implementation: 'voice-rooms', requiredGrant: 'meeting.meeting.view' },
          {
            id: 'manage-rooms',
            path: '/admin/voice/manage-rooms',
            labelKey: 'adminDomains.voice.manageRooms',
            implementation: 'voice-manage-rooms',
            requiredGrant: 'meeting.meeting.view',
          },
          {
            id: 'meetings',
            path: '/admin/voice/meetings',
            labelKey: 'adminDomains.voice.meetings',
            implementation: 'voice-meetings',
            requiredGrant: 'meeting.meeting.view',
          },
          {
            id: 'history',
            path: '/admin/voice/history',
            labelKey: 'adminDomains.voice.history',
            implementation: 'voice-history',
            requiredGrant: 'meeting.meeting.view_recording',
          },
          {
            id: 'meeting-ops',
            path: '/admin/voice/meeting-ops',
            labelKey: 'adminDomains.voice.meetingOpsHub',
            implementation: 'voice-meeting-ops',
            requiredGrant: 'meeting.meeting.view',
          },
          { id: 'moderate', path: '/admin/voice/moderate', labelKey: 'adminDomains.voice.moderate', implementation: 'voice-moderate', nav: 'hidden', requiredGrant: 'meeting.meeting.end' },
          { id: 'end-meeting', path: '/admin/voice/end-meeting', labelKey: 'adminDomains.voice.endMeeting', implementation: 'voice-end-meeting', nav: 'hidden', requiredGrant: 'meeting.meeting.end' },
        ],
      },
    ],
  },
  {
    id: 'projects',
    path: '/admin/projects',
    labelKey: 'adminDomains.projects.title',
    icon: 'Kanban',
    navAccordion: true,
    sections: [
      {
        id: 'governance',
        labelKey: 'adminDomains.projects.sectionGovernance',
        items: [
          {
            id: 'overview',
            path: '/admin/projects',
            labelKey: 'adminDomains.projects.overview',
            end: true,
            implementation: 'tasks-projects-overview',
            requiredGrant: 'project.project.view',
          },
          {
            id: 'settings',
            path: '/admin/projects/settings',
            labelKey: 'adminDomains.projects.settings',
            implementation: 'tasks-project-settings',
            requiredGrant: 'project.project.update',
          },
          {
            id: 'project-team',
            path: '/admin/projects/project-team',
            labelKey: 'adminDomains.projects.members',
            implementation: 'tasks-project-team',
            requiredGrant: 'project.project.update',
          },
          {
            id: 'delegation',
            path: '/admin/projects/delegation',
            labelKey: 'adminDomains.projects.delegation',
            implementation: 'tasks-delegation',
            requiredGrant: 'project.project.update',
          },
        ],
      },
      {
        id: 'boards-delivery',
        labelKey: 'adminDomains.projects.sectionBoards',
        items: [
          {
            id: 'boards',
            path: '/admin/projects/boards',
            labelKey: 'adminDomains.projects.boards',
            implementation: 'tasks-boards',
            requiredGrant: 'project.task.view',
          },
          {
            id: 'workflow',
            path: '/admin/projects/workflow',
            labelKey: 'adminDomains.projects.workflow',
            implementation: 'tasks-workflow',
            requiredGrant: 'project.workflow.view',
          },
          {
            id: 'sprints',
            path: '/admin/projects/sprints',
            labelKey: 'adminDomains.projects.sprints',
            implementation: 'tasks-sprints',
            requiredGrant: 'project.sprint.view',
          },
        ],
      },
      {
        id: 'work-items',
        labelKey: 'adminDomains.projects.sectionWorkItems',
        items: [
          {
            id: 'manage-tasks',
            path: '/admin/projects/manage',
            labelKey: 'adminDomains.projects.manageTasks',
            implementation: 'tasks-manage',
            requiredGrant: 'project.task.view',
          },
          {
            id: 'change-requests',
            path: '/admin/projects/change-requests',
            labelKey: 'adminDomains.projects.changeRequests',
            implementation: 'tasks-change-requests',
            requiredGrant: 'project.change_request.view',
          },
          {
            id: 'briefs',
            path: '/admin/projects/briefs',
            labelKey: 'adminDomains.projects.briefs',
            implementation: 'tasks-briefs',
            requiredGrant: 'project.backlog.view',
          },
          {
            id: 'requirements',
            path: '/admin/projects/requirements',
            labelKey: 'adminDomains.projects.requirements',
            implementation: 'tasks-requirements',
            requiredGrant: 'project.backlog.view',
          },
          {
            id: 'export',
            path: '/admin/projects/export',
            labelKey: 'adminDomains.projects.export',
            implementation: 'tasks-export',
            requiredGrant: 'project.report.view',
          },
          {
            id: 'status',
            path: '/admin/projects/status',
            labelKey: 'adminDomains.projects.statusPriority',
            implementation: 'tasks-status-priority',
            requiredGrant: 'project.workflow.update',
          },
          {
            id: 'labels',
            path: '/admin/projects/labels',
            labelKey: 'adminDomains.projects.labels',
            implementation: 'tasks-labels',
            requiredGrant: 'project.workflow.update',
          },
        ],
      },
      {
        id: 'ops',
        labelKey: 'adminDomains.projects.sectionOps',
        items: [
          {
            id: 'transfer',
            path: '/admin/projects/transfer',
            labelKey: 'adminDomains.projects.transfer',
            implementation: 'tasks-transfer',
            requiredGrant: 'project.project.update',
          },
          {
            id: 'policies',
            path: '/admin/projects/policies',
            labelKey: 'adminDomains.projects.policies',
            implementation: 'tasks-project-visibility-policy',
            requiredGrant: 'organization.policy.view',
          },
          {
            id: 'capacity',
            path: '/admin/projects/capacity',
            labelKey: 'adminDomains.projects.capacity',
            implementation: 'tasks-department-capacity',
            requiredGrant: 'project.report.view',
          },
          {
            id: 'planner',
            path: '/admin/projects/planner',
            labelKey: 'adminDomains.projects.planner',
            implementation: 'tasks-resource-planner',
            requiredGrant: 'project.report.view',
          },
          {
            id: 'role-effort-budget-template',
            path: '/admin/projects/role-effort-budget-template',
            labelKey: 'adminDomains.projects.roleEffortBudgetTemplate',
            implementation: 'tasks-role-effort-budget-template',
            requiredGrant: 'project.report.view',
          },
          {
            id: 'utilization',
            path: '/admin/projects/utilization',
            labelKey: 'adminDomains.projects.utilization',
            implementation: 'tasks-utilization',
            requiredGrant: 'project.report.view',
          },
          {
            id: 'performance',
            path: '/admin/projects/performance',
            labelKey: 'adminDomains.projects.performance',
            implementation: 'tasks-user-performance',
            requiredGrant: 'project.report.view',
          },
          {
            id: 'approval-policies',
            path: '/admin/projects/approval-policies',
            labelKey: 'adminDomains.projects.approvalPolicies',
            implementation: 'tasks-approval-policies',
            requiredGrant: 'organization.policy.update',
          },
        ],
      },
    ],
  },
  {
    id: 'files',
    path: '/admin/files',
    labelKey: 'adminDomains.files.title',
    icon: 'FolderOpen',
    sections: [
      {
        id: 'main',
        items: [
          {
            id: 'list',
            path: '/admin/files',
            labelKey: 'adminDomains.files.list',
            end: true,
            implementation: 'files-list',
            requiredGrant: 'file.file.download',
          },
        ],
      },
    ],
  },
  {
    id: 'notifications',
    path: '/admin/notifications',
    labelKey: 'adminDomains.notifications.title',
    icon: 'Bell',
    sections: [
      {
        id: 'main',
        items: [
          {
            id: 'config-hub',
            path: '/admin/notifications',
            labelKey: 'adminDomains.notifications.configHub',
            end: true,
            requiredGrant: 'notification.notification.view',
          },
        ],
      },
    ],
  },
  {
    id: 'ai',
    path: '/admin/ai',
    labelKey: 'adminDomains.ai.title',
    icon: 'Sparkles',
    nav: 'hidden',
    adminOnly: true,
    sections: [
      {
        id: 'main',
        items: [
          { id: 'provider', path: '/admin/ai', labelKey: 'adminDomains.ai.provider', end: true, adminOnly: true },
          { id: 'api-key', path: '/admin/ai/api-key', labelKey: 'adminDomains.ai.apiKey', adminOnly: true },
          { id: 'toggle', path: '/admin/ai/toggle', labelKey: 'adminDomains.ai.toggle', adminOnly: true },
          { id: 'chat', path: '/admin/ai/chat', labelKey: 'adminDomains.ai.chat', adminOnly: true },
          { id: 'prompts', path: '/admin/ai/prompts', labelKey: 'adminDomains.ai.prompts', adminOnly: true },
          { id: 'limits', path: '/admin/ai/limits', labelKey: 'adminDomains.ai.limits', adminOnly: true },
        ],
      },
    ],
  },
  {
    id: 'security',
    path: '/admin/security',
    labelKey: 'adminDomains.security.title',
    icon: 'Lock',
    sections: [
      {
        id: 'main',
        items: [
          {
            id: 'settings-hub',
            path: '/admin/security',
            labelKey: 'adminDomains.security.settingsHub',
            end: true,
            implementation: 'security-settings-hub',
            requiredGrant: 'organization.policy.view',
          },
          {
            id: 'sessions-hub',
            path: '/admin/security/sessions',
            labelKey: 'adminDomains.security.loginHistory',
            implementation: 'security-sessions-hub',
            // Không dùng employee.view — HR/mọi người có view nhân sự sẽ lọt security.
            requiredGrant: 'organization.organization_role.view',
          },
          {
            id: 'password-policy',
            path: '/admin/security/password-policy',
            labelKey: 'adminDomains.security.passwordPolicy',
            implementation: 'settings-security',
            settingsTab: 'security',
            nav: 'hidden',
            requiredGrant: 'organization.policy.update',
          },
          {
            id: 'mfa',
            path: '/admin/security/mfa',
            labelKey: 'adminDomains.security.mfa',
            implementation: 'security-wave-c',
            nav: 'hidden',
            adminOnly: true,
            requiredGrant: 'organization.policy.update',
          },
          {
            id: 'ip-whitelist',
            path: '/admin/security/ip-whitelist',
            labelKey: 'adminDomains.security.ipWhitelist',
            implementation: 'security-wave-c',
            nav: 'hidden',
            adminOnly: true,
            requiredGrant: 'organization.policy.update',
          },
        ],
      },
    ],
  },
  {
    id: 'audit',
    path: '/admin/audit',
    labelKey: 'adminDomains.audit.title',
    icon: 'ScrollText',
    sections: [
      {
        id: 'main',
        items: [
          { id: 'log', path: '/admin/audit', labelKey: 'adminDomains.audit.log', implementation: 'audit-log', requiredGrant: 'system.audit.view' },
          {
            id: 'search',
            path: '/admin/audit/search',
            labelKey: 'adminDomains.audit.search',
            implementation: 'audit-log',
            nav: 'hidden',
            requiredGrant: 'system.audit.view',
          },
          {
            id: 'permissions',
            path: '/admin/audit/permissions',
            labelKey: 'adminDomains.audit.permissions',
            implementation: 'audit-log',
            nav: 'hidden',
            requiredGrant: 'system.audit.view',
          },
          {
            id: 'login',
            path: '/admin/audit/login',
            labelKey: 'adminDomains.audit.login',
            implementation: 'audit-log',
            nav: 'hidden',
            requiredGrant: 'system.audit.view',
          },
          {
            id: 'activity',
            path: '/admin/audit/activity',
            labelKey: 'adminDomains.audit.activity',
            implementation: 'audit-log',
            nav: 'hidden',
            requiredGrant: 'system.audit.view',
          },
          {
            id: 'export',
            path: '/admin/audit/export',
            labelKey: 'adminDomains.audit.export',
            implementation: 'audit-log',
            nav: 'hidden',
            requiredGrant: 'system.audit.view',
          },
        ],
      },
    ],
  },
  {
    id: 'backup',
    path: '/admin/backup',
    labelKey: 'adminDomains.backup.title',
    icon: 'Database',
    adminOnly: true,
    nav: 'hidden',
    sections: [],
  },
  {
    id: 'system-config',
    path: '/admin/system-config',
    labelKey: 'adminDomains.systemConfig.title',
    icon: 'Settings',
    adminOnly: true,
    nav: 'hidden',
    sections: [],
  },
  {
    id: 'monitoring',
    path: '/admin/monitoring',
    labelKey: 'adminDomains.monitoring.title',
    icon: 'Activity',
    adminOnly: true,
    nav: 'hidden',
    sections: [
      {
        id: 'main',
        items: [
          { id: 'services', path: '/admin/monitoring', labelKey: 'adminDomains.monitoring.services', end: true, adminOnly: true },
          { id: 'database', path: '/admin/monitoring/database', labelKey: 'adminDomains.monitoring.database', adminOnly: true },
          { id: 'queue', path: '/admin/monitoring/queue', labelKey: 'adminDomains.monitoring.queue', adminOnly: true },
          { id: 'storage', path: '/admin/monitoring/storage', labelKey: 'adminDomains.monitoring.storage', adminOnly: true },
          { id: 'online-users', path: '/admin/monitoring/online-users', labelKey: 'adminDomains.monitoring.onlineUsers', adminOnly: true },
          { id: 'voice-active', path: '/admin/monitoring/voice-active', labelKey: 'adminDomains.monitoring.voiceActive', adminOnly: true },
        ],
      },
    ],
  },
  {
    id: 'reports',
    path: '/admin/reports/tasks',
    labelKey: 'adminDomains.reports.title',
    icon: 'BarChart3',
    sections: [
      {
        id: 'main',
        items: [
          {
            id: 'tasks',
            path: '/admin/reports/tasks',
            labelKey: 'adminDomains.reports.tasks',
            implementation: 'director-project-health',
            requiredGrant: 'project.report.view',
          },
        ],
      },
    ],
  },
];

/** Map tab cũ (?tab=) sang path mới. */
export const LEGACY_ADMIN_TAB_TO_PATH = {
  overview: '/admin',
  people: '/admin/users',
  approvals: '/admin/users',
  general: '/admin/system-config',
  structure: '/admin/system-config?tab=structure',
  roles: '/admin/rbac/org-roles',
  policy: '/admin/system-config/policy',
  join: '/admin/users',
  security: '/admin/security',
};

const LEGACY_PATH_REDIRECTS = {
  '/admin/people': '/admin/users',
  '/admin/approvals': '/admin/users',
  '/admin/users/join-approvals': '/admin/users',
  '/admin/system-config/policy': '/admin/system-config',
  '/admin/general': '/admin/system-config',
  '/admin/structure': '/admin/system-config?tab=structure',
  '/admin/roles': '/admin/rbac/org-roles',
  '/admin/rbac/roles': '/admin/rbac/org-roles',
  '/admin/rbac/roles/manage': '/admin/rbac/org-roles',
  '/admin/rbac/create': '/admin/rbac/org-roles/create',
  '/admin/rbac/permissions': '/admin/rbac/org-roles/permissions',
  '/admin/rbac/matrix': '/admin/rbac/org-roles/permissions',
  '/admin/policy': '/admin/system-config/policy',
  '/admin/security': '/admin/security',
  '/admin/org-structure/positions': '/admin/rbac/positions',
  '/admin/org-structure/positions/create': '/admin/rbac/positions/create',
  '/admin/org-structure/positions/edit': '/admin/rbac/positions/edit',
  '/admin/org-structure/positions/disable': '/admin/rbac/positions/disable',
  '/admin/org-structure/positions/assign': '/admin/rbac/positions/assign',

  '/admin/rbac/organization-roles': '/admin/rbac/org-roles',
  '/admin/rbac/organization-roles/directory': '/admin/rbac/org-roles/directory',
  '/admin/rbac/organization-roles/lookup': '/admin/rbac/org-roles/lookup',

  '/admin/users/lock': '/admin/accounts/access?tab=lock',
  '/admin/users/reset-password': '/admin/accounts/password?tab=reset',
  '/admin/users/force-password': '/admin/accounts/password?tab=force',
  '/admin/users/login-history': '/admin/accounts/login-history',
  '/admin/users/edit': '/admin/users/people-ops?tab=edit',
  '/admin/users/assign-org': '/admin/users/people-ops?tab=assign-org',
  '/admin/users/delete': '/admin/users/people-ops?tab=delete',
  '/admin/users/import-excel': '/admin/users/import',
  '/admin/accounts/reset-password': '/admin/accounts/password?tab=reset',
  '/admin/accounts/force-password': '/admin/accounts/password?tab=force',
  '/admin/accounts/set-password': '/admin/accounts/password?tab=set',
  '/admin/accounts/activate': '/admin/accounts/access?tab=activate',
  '/admin/accounts/lock': '/admin/accounts/access?tab=lock',
  '/admin/accounts/revoke-sessions': '/admin/accounts/access?tab=revoke',
  '/admin/accounts/resend-verification': '/admin/accounts/verification?tab=resend',

  '/admin/org-structure/departments/edit': '/admin/org-structure/departments/manage?tab=edit',
  '/admin/org-structure/departments/disable': '/admin/org-structure/departments/manage?tab=disable',
  '/admin/org-structure/departments/parent': '/admin/org-structure/departments/manage?tab=parent',
  '/admin/org-structure/departments/head': '/admin/org-structure/departments/manage?tab=head',
  '/admin/org-structure/departments/members': '/admin/org-structure/departments/manage?tab=members',
  '/admin/org-structure/departments/org-roles': '/admin/org-structure/departments/manage?tab=org-roles',
  '/admin/org-structure/teams/edit': '/admin/org-structure/teams/manage?tab=edit',
  '/admin/org-structure/teams/archive': '/admin/org-structure/teams/manage?tab=archive',
  '/admin/org-structure/teams/members': '/admin/org-structure/teams/manage?tab=members',
  '/admin/org-structure/teams/leader': '/admin/org-structure/teams/manage?tab=leader',
  '/admin/org-structure/teams/department': '/admin/org-structure/teams/manage?tab=department',
  '/admin/org-structure/divisions/edit': '/admin/org-structure/divisions/manage?tab=edit',
  '/admin/org-structure/divisions/disable': '/admin/org-structure/divisions/manage?tab=disable',
  '/admin/org-structure/divisions/departments': '/admin/org-structure/divisions/manage?tab=departments',
  '/admin/org-structure/branches/edit': '/admin/org-structure/branches/manage?tab=edit',
  '/admin/org-structure/branches/disable': '/admin/org-structure/branches/manage?tab=disable',
  '/admin/org-structure/branches/departments': '/admin/org-structure/branches/manage?tab=departments',

  '/admin/rbac/positions/assign': '/admin/rbac/positions/manage?tab=assign',
  '/admin/rbac/positions/edit': '/admin/rbac/positions/manage?tab=edit',
  '/admin/rbac/positions/disable': '/admin/rbac/positions/manage?tab=disable',
  '/admin/rbac/org-roles/edit': '/admin/rbac/org-roles/manage?tab=edit',
  '/admin/rbac/org-roles/assign': '/admin/rbac/org-roles/manage?tab=assign',
  '/admin/rbac/org-roles/delete': '/admin/rbac/org-roles/manage?tab=delete',
  '/admin/rbac/project-roles/edit': '/admin/rbac/project-roles/manage?tab=edit',
  '/admin/rbac/project-roles/delete': '/admin/rbac/project-roles/manage?tab=delete',
  '/admin/projects/priority': '/admin/projects/status',
  '/admin/rbac/assign': '/admin/rbac/roles/manage?tab=assign',
  '/admin/rbac/revoke': '/admin/rbac/roles/manage?tab=revoke',
  '/admin/rbac/delete': '/admin/rbac/roles/manage?tab=delete',

  '/admin/voice/recording': '/admin/voice/meeting-ops',
  '/admin/voice/transcript': '/admin/voice/meeting-ops',
  '/admin/voice/ai-summary': '/admin/voice/meeting-ops',
  '/admin/voice/moderate': '/admin/voice/meeting-ops?tab=moderate',
  '/admin/voice/end-meeting': '/admin/voice/meeting-ops?tab=end',

  '/admin/channels/manage': '/admin/channels',
  '/admin/channels/edit': '/admin/channels',
  '/admin/channels/members': '/admin/channels',
  '/admin/channels/visibility': '/admin/channels',
  '/admin/channels/transfer': '/admin/channels',
  '/admin/channels/archive': '/admin/channels',
  '/admin/channels/restore': '/admin/channels',

  '/admin/files/ops': '/admin/files',
  '/admin/files/storage': '/admin/files',
  '/admin/files/quota': '/admin/files',
  '/admin/files/restore': '/admin/files',
  '/admin/files/export': '/admin/files',
  '/admin/files/delete': '/admin/files',

  '/admin/chat/history': '/admin/chat',
  '/admin/chat/restore': '/admin/chat',
  '/admin/chat/pin': '/admin/chat',
  '/admin/chat/broadcast': '/admin/chat',
  '/admin/chat/search': '/admin/chat',
  '/admin/chat/export': '/admin/chat',
  '/admin/chat/retention': '/admin/chat',
  '/admin/chat/delete': '/admin/chat',

  '/admin/notifications/smtp': '/admin/notifications',
  '/admin/notifications/push': '/admin/notifications',
  '/admin/notifications/webhook': '/admin/notifications',
  '/admin/notifications/broadcast': '/admin/notifications',

  '/admin/ai/summary': '/admin/voice/meeting-ops?tab=summary',

  '/admin/reports': '/admin/reports/tasks',
  '/admin/reports/chat': '/admin/reports/tasks',
  '/admin/reports/voice': '/admin/reports/tasks',
  '/admin/reports/storage': '/admin/reports/tasks',
  '/admin/reports/export': '/admin/reports/tasks',
  '/admin/reports/login': '/admin/security/sessions',

  '/admin/backup/schedule': '/admin/backup',
  '/admin/backup/export': '/admin/backup',
  '/admin/backup/import': '/admin/backup',
  '/admin/backup/restore': '/admin/backup',

  '/admin/security/password-policy': '/admin/security?tab=password',
  '/admin/security/mfa': '/admin/security?tab=mfa',
  '/admin/security/session-timeout': '/admin/security',
  '/admin/security/ip-whitelist': '/admin/security?tab=ip-whitelist',
  '/admin/security/devices': '/admin/security/sessions',
  '/admin/security/login-history': '/admin/security/sessions',
  '/admin/audit/login': '/admin/security/sessions',
  '/admin/audit/search': '/admin/audit',
  '/admin/audit/activity': '/admin/audit',
  '/admin/audit/export': '/admin/audit',
  '/admin/audit/permissions': '/admin/audit',

  '/admin/system-config/company': '/admin/system-config?tab=company',
  '/admin/system-config/logo': '/admin/system-config',
  '/admin/system-config/language': '/admin/system-config',
  '/admin/system-config/timezone': '/admin/system-config',
  '/admin/system-config/work-hours': '/admin/system-config',
  '/admin/system-config/holidays': '/admin/system-config',
  '/admin/system-config/retention': '/admin/system-config?tab=retention',
  '/admin/system-config/structure': '/admin/system-config?tab=structure',
};

/** Redirect kèm query (ví dụ create → import?mode=invite). */
const LEGACY_PATH_REDIRECTS_WITH_SEARCH = {
  '/admin/users/create': '/admin/users/import?mode=invite',
  '/admin/users/import-excel': '/admin/users/import?mode=excel',
};

export function normalizeAdminPath(pathname) {
  let base = String(pathname || '').replace(/\/+$/, '') || '/admin';
  // Suite Quản trị `/manage` ↔ SoT config `/admin`
  if (base === '/manage' || base.startsWith('/manage/')) {
    base = base === '/manage' ? '/admin' : `/admin${base.slice('/manage'.length)}`;
  } else if (base === '/app/manage' || base.startsWith('/app/manage/')) {
    const rest = base === '/app/manage' ? '' : base.slice('/app/manage'.length);
    base = `/admin${rest}`;
  }
  const mapped = LEGACY_PATH_REDIRECTS[base];
  if (mapped) {
    const q = mapped.indexOf('?');
    return q === -1 ? mapped : mapped.slice(0, q);
  }
  // Legacy Admin Tasks → Projects & Delivery (giữ slug con)
  if (base === '/admin/tasks' || base.startsWith('/admin/tasks/')) {
    return base.replace(/^\/(?:app\/)?admin\/tasks/, '/admin/projects');
  }
  return base;
}

/** @returns {{ pathname: string, search: string } | null} */
export function resolveAdminLegacyRedirect(pathname, currentSearch = '') {
  const raw = String(pathname || '').replace(/\/+$/, '') || '/admin';
  const onManage = raw === '/manage' || raw.startsWith('/manage/') || raw === '/app/manage' || raw.startsWith('/app/manage/');
  const base = normalizeAdminPath(raw);
  const withSearch = LEGACY_PATH_REDIRECTS_WITH_SEARCH[base];
  const toSurface = (adminPath) => {
    if (!onManage) return adminPath;
    if (adminPath === '/admin') return '/manage';
    if (adminPath.startsWith('/admin/')) return `/manage${adminPath.slice('/admin'.length)}`;
    return adminPath;
  };
  if (withSearch) {
    const q = withSearch.indexOf('?');
    if (q === -1) return { pathname: toSurface(withSearch), search: '' };
    return { pathname: toSurface(withSearch.slice(0, q)), search: withSearch.slice(q) };
  }
  const plain = LEGACY_PATH_REDIRECTS[base];
  if (plain && plain !== base) {
    const q = plain.indexOf('?');
    if (q === -1) {
      return { pathname: toSurface(plain), search: String(currentSearch || '') };
    }
    const nextPath = toSurface(plain.slice(0, q));
    const redirectSearch = new URLSearchParams(plain.slice(q + 1));
    const incoming = new URLSearchParams(String(currentSearch || '').replace(/^\?/, ''));
    for (const key of ['userId', 'unitId', 'meetingId', 'roleId', 'roleKey', 'title', 'channelId', 'fileId']) {
      if (incoming.has(key)) redirectSearch.set(key, incoming.get(key));
    }
    const merged = redirectSearch.toString();
    return { pathname: nextPath, search: merged ? `?${merged}` : '' };
  }
  return null;
}

export function resolveAdminDomainFromPath(pathname) {
  const path = normalizeAdminPath(pathname);
  if (path === '/admin') return null;
  // Ưu tiên domain sở hữu nav item (vd. backup/system-config nằm trong org-structure).
  const navMatch = findAdminNavItem(path);
  if (navMatch?.domain) return navMatch.domain;
  const match = path.match(/^\/(?:app\/)?admin\/([^/]+)/);
  if (!match) return null;
  const slug = match[1];
  if (slug === 'overview') return null;
  return ADMIN_DOMAINS.find((d) => d.id === slug) || null;
}

export function findAdminNavItem(pathname) {
  const path = normalizeAdminPath(pathname).replace(/\/+$/, '');
  let best = null;
  let bestLen = -1;

  for (const domain of ADMIN_DOMAINS) {
    for (const section of domain.sections) {
      for (const item of section.items) {
        const itemPath = String(item.path || '').replace(/\/+$/, '');
        const matches = item.end ? path === itemPath : path === itemPath || path.startsWith(`${itemPath}/`);
        if (matches && itemPath.length > bestLen) {
          best = { domain, section, item };
          bestLen = itemPath.length;
        }
      }
    }
  }
  return best;
}

export function adminSettingsEmbedTabFromItem(item) {
  return item?.settingsTab || null;
}

export function getVisibleAdminDomains() {
  return ADMIN_DOMAINS.filter((d) => d.nav !== 'hidden');
}

export function flattenAdminNavItems(domain) {
  return domain.sections.flatMap((s) => s.items);
}

/** Map OrgLevelSchema.key → admin org-structure section.id */
export const ORG_LEVEL_KEY_TO_SECTION = {
  branch: 'branches',
  division: 'divisions',
  department: 'departments',
  team: 'teams',
};

/**
 * Sections luôn hiện (không gắn org level enabled).
 * `dynamic` = Levels/Units — cần cho Bên bán (structure.view) và setup lại.
 * `departments` giữ trước/sau setup khi actor có grant dept (leaf vẫn lọc grant).
 */
export const ORG_STRUCTURE_ALWAYS_SECTIONS = new Set(['backup', 'system-config', 'dynamic', 'departments']);

/**
 * Lọc sections Cơ cấu tổ chức theo trạng thái setup + levels đã lưu.
 * - Chưa setup: ALWAYS (backup / system-config / dynamic / departments); ẩn branch/division/team.
 * - Đã setup: level enabled + ALWAYS (không ẩn dynamic).
 */
export function filterOrgStructureSections(sections, levels, { setupCompleted } = {}) {
  const list = Array.isArray(sections) ? sections : [];

  if (setupCompleted !== true) {
    return list.filter((section) => ORG_STRUCTURE_ALWAYS_SECTIONS.has(section.id));
  }

  const enabledKeys = (Array.isArray(levels) ? levels : [])
    .filter((l) => l && l.enabled !== false && l.key)
    .map((l) => String(l.key).toLowerCase().trim());

  const allowed = new Set();
  for (const key of enabledKeys) {
    const sectionId = ORG_LEVEL_KEY_TO_SECTION[key];
    if (sectionId) allowed.add(sectionId);
  }

  return list.filter(
    (section) => allowed.has(section.id) || ORG_STRUCTURE_ALWAYS_SECTIONS.has(section.id)
  );
}

/**
 * Domain với sections đã filter (chỉ domain org-structure).
 */
export function applyOrgLevelFilterToDomain(domain, levels, options = {}) {
  if (!domain || domain.id !== 'org-structure') return domain;
  return {
    ...domain,
    sections: filterOrgStructureSections(domain.sections, levels, options),
  };
}
