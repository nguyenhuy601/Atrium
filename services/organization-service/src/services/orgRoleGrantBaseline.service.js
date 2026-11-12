/**
 * Tick quyền vai trò tổ chức và gắn 11 vị trí.
 * SoT mã vai trò: UPPER_SNAKE. Chỉ thêm mã còn thiếu. Không gắn DIRECTOR vào vị trí dùng chung.
 */

const OrganizationalRole = require('../models/OrganizationalRole');
const OrganizationalPosition = require('../models/OrganizationalPosition');
const OrgRolePermission = require('../models/OrgRolePermission');
const PositionRoleBinding = require('../models/PositionRoleBinding');
const EmployeePositionAssignment = require('../models/EmployeePositionAssignment');
const UserOrgRoleGrant = require('../models/UserOrgRoleGrant');
const {
  MASTER_POSITIONS,
  LEGACY_ORGANIZATION_ROLE_KEY_ALIASES,
  resolveCanonicalOrganizationRoleKey,
  organizationRoleLookupCodes,
} = require('@enterprise/shared/config/masterData');
const { invalidatePermissionCacheForUsers } = require('./grantPermissionCache');

const MEMBER_CODE = 'MEMBER';
const MEMBER_DISPLAY_NAME = 'Thành viên tổ chức';

const CHAT = [
  ['communication.chat.view', 'ORGANIZATION'],
  ['communication.chat.send', 'ORGANIZATION'],
];

/** PMO — chỉ project/* ; không org/HR admin. */
const PMO_PROJECT_GRANTS = Object.freeze([
  ['project.project.view', 'ORGANIZATION'],
  ['project.project.create', 'ORGANIZATION'],
  ['project.project.update', 'ORGANIZATION'],
  ['project.project.archive', 'ORGANIZATION'],
  ['project.sprint.view', 'ORGANIZATION'],
  ['project.sprint.create', 'ORGANIZATION'],
  ['project.sprint.start', 'ORGANIZATION'],
  ['project.sprint.close', 'ORGANIZATION'],
  ['project.backlog.view', 'ORGANIZATION'],
  ['project.backlog.update', 'ORGANIZATION'],
  ['project.task.view', 'ORGANIZATION'],
  ['project.task.create', 'ORGANIZATION'],
  ['project.task.update', 'ORGANIZATION'],
  ['project.task.assign', 'ORGANIZATION'],
  ['project.task.comment', 'ORGANIZATION'],
  ['project.workflow.view', 'ORGANIZATION'],
  ['project.workflow.update', 'ORGANIZATION'],
  ['project.report.view', 'ORGANIZATION'],
  ['project.change_request.view', 'ORGANIZATION'],
  ['project.change_request.create', 'ORGANIZATION'],
  ['project.change_request.update', 'ORGANIZATION'],
]);

const ROLE_GRANTS = Object.freeze({
  MEMBER: [
    ['organization.employee.view', 'SELF'],
    ...CHAT,
  ],
  TEAM_LEAD: [
    ['organization.employee.view', 'DEPARTMENT'],
    ['organization.department.view', 'DEPARTMENT'],
    ['organization.team.view', 'DEPARTMENT'],
    ...CHAT,
  ],
  DEPARTMENT_MANAGER: [
    ['organization.employee.view', 'DEPARTMENT'],
    ['organization.department.view', 'DEPARTMENT'],
    ['organization.team.view', 'DEPARTMENT'],
    ['organization.employee.invite', 'DEPARTMENT'],
    ['organization.employee.update', 'DEPARTMENT'],
    ['organization.structure.view', 'DEPARTMENT'],
    ['project.project.create', 'ORGANIZATION'],
    ...CHAT,
  ],
  /** Cấu hình tổ chức (structure/policy update) — chỉ DIRECTOR. */
  DIRECTOR: [
    ['organization.employee.view', 'ORGANIZATION'],
    ['organization.employee.update', 'ORGANIZATION'],
    ['organization.department.view', 'ORGANIZATION'],
    ['organization.department.update', 'ORGANIZATION'],
    ['organization.team.view', 'ORGANIZATION'],
    ['organization.team.update', 'ORGANIZATION'],
    ['organization.position.view', 'ORGANIZATION'],
    ['organization.position.update', 'ORGANIZATION'],
    ['organization.organization_role.view', 'ORGANIZATION'],
    ['organization.structure.view', 'ORGANIZATION'],
    ['organization.structure.update', 'ORGANIZATION'],
    ['organization.policy.view', 'ORGANIZATION'],
    ['organization.policy.update', 'ORGANIZATION'],
    ['organization.master_data.view', 'ORGANIZATION'],
    ['organization.master_data.update', 'ORGANIZATION'],
    ['system.audit.view', 'ORGANIZATION'],
    ['project.project.create', 'ORGANIZATION'],
  ],
  IT_ADMIN: [
    ['organization.employee.view', 'ORGANIZATION'],
    ['organization.employee.invite', 'ORGANIZATION'],
    ['organization.employee.update', 'ORGANIZATION'],
    ['organization.employee.disable', 'ORGANIZATION'],
    ['organization.employee.reset_password', 'ORGANIZATION'],
    ['organization.organization_role.view', 'ORGANIZATION'],
    ['organization.organization_role.update', 'ORGANIZATION'],
    ['organization.master_data.view', 'ORGANIZATION'],
  ],
  RESOURCE_MANAGER: [
    ['organization.employee.view', 'ORGANIZATION'],
    ['organization.department.view', 'ORGANIZATION'],
    ['organization.team.view', 'ORGANIZATION'],
    ['organization.position.view', 'ORGANIZATION'],
    ['project.project.create', 'ORGANIZATION'],
  ],
  HR_APPROVER: [
    ['organization.employee.view', 'ORGANIZATION'],
    ['organization.employee.invite', 'ORGANIZATION'],
    ['organization.employee.update', 'ORGANIZATION'],
    ['organization.employee.disable', 'ORGANIZATION'],
    // Không department/structure — HR chỉ Suite người dùng / tài khoản.
  ],
  AUDITOR: [
    ['organization.employee.view', 'ORGANIZATION'],
    ['organization.department.view', 'ORGANIZATION'],
    ['organization.team.view', 'ORGANIZATION'],
    ['organization.position.view', 'ORGANIZATION'],
    ['organization.organization_role.view', 'ORGANIZATION'],
    ['organization.structure.view', 'ORGANIZATION'],
    ['organization.policy.view', 'ORGANIZATION'],
    ['system.audit.view', 'ORGANIZATION'],
  ],
  MENTOR: [
    ['organization.employee.view', 'DEPARTMENT'],
    ...CHAT,
  ],
  PMO_MANAGER: [...PMO_PROJECT_GRANTS],
});

const ROLE_NAMES = Object.freeze({
  MEMBER: MEMBER_DISPLAY_NAME,
  TEAM_LEAD: 'Trưởng nhóm',
  DEPARTMENT_MANAGER: 'Trưởng phòng',
  DIRECTOR: 'Giám đốc tổ chức',
  IT_ADMIN: 'Quản trị hệ thống',
  RESOURCE_MANAGER: 'Quản lý nguồn lực',
  HR_APPROVER: 'Nhân sự',
  AUDITOR: 'Kiểm toán',
  MENTOR: 'Người hướng dẫn',
  PMO_MANAGER: 'Quản lý PMO',
});

const ROLE_DESCRIPTIONS = Object.freeze({
  TEAM_LEAD: 'Điều phối nhóm được giao',
  DEPARTMENT_MANAGER: 'Quản lý phòng ban được giao',
  DIRECTOR: 'Sở hữu, cấu hình tổ chức và chịu trách nhiệm cấp tổ chức',
  IT_ADMIN: 'Quản lý tài khoản và ma trận vai trò tổ chức',
  RESOURCE_MANAGER: 'Điều phối nhân sự giữa các dự án',
  HR_APPROVER: 'Phê duyệt nghiệp vụ nhân sự',
  AUDITOR: 'Kiểm tra tuân thủ và audit tổ chức',
  MENTOR: 'Hướng dẫn chuyên môn cho nhân viên',
  MEMBER: 'Nhân viên trong doanh nghiệp',
  PMO_MANAGER: 'Quản trị quy trình và tiêu chuẩn quản lý dự án (không HR/org admin)',
});

/** Vai trò legacy — gộp assignment/grant sang DIRECTOR rồi disable. */
const DEPRECATED_MERGE_INTO_DIRECTOR = Object.freeze(['ORG_OWNER', 'ORG_ADMIN']);

/**
 * Vị trí → vai trò tổ chức UPPER.
 * Gồm master lowercase + catalog UPPER đang dùng trên org thật.
 * DIRECTOR chỉ gắn C-level; không gắn IC.
 */
const POSITION_ROLE_CODE = Object.freeze({
  // Master lowercase
  engineering_manager: 'DEPARTMENT_MANAGER',
  team_lead: 'TEAM_LEAD',
  product_manager: 'RESOURCE_MANAGER',
  business_analyst: MEMBER_CODE,
  software_developer: MEMBER_CODE,
  qa_engineer: MEMBER_CODE,
  ux_designer: MEMBER_CODE,
  devops_engineer: MEMBER_CODE,
  scrum_master: MEMBER_CODE,
  technical_lead: 'TEAM_LEAD',
  intern: MEMBER_CODE,
  // Catalog UPPER / leadership
  CEO: 'DIRECTOR',
  CTO: 'DIRECTOR',
  COO: 'DIRECTOR',
  ENGINEERING_MANAGER: 'DEPARTMENT_MANAGER',
  TECHNICAL_MANAGER: 'DEPARTMENT_MANAGER',
  PRODUCT_MANAGER: 'RESOURCE_MANAGER',
  PROJECT_MANAGER: 'RESOURCE_MANAGER',
  SENIOR_PROJECT_MANAGER: 'RESOURCE_MANAGER',
  DELIVERY_MANAGER: 'RESOURCE_MANAGER',
  PRODUCT_OWNER: 'RESOURCE_MANAGER',
  HR_MANAGER: 'HR_APPROVER',
  HR_SPECIALIST: 'HR_APPROVER',
  TECHNICAL_RECRUITER: 'HR_APPROVER',
  SALES_MANAGER: 'DEPARTMENT_MANAGER',
  FINANCE_MANAGER: 'DEPARTMENT_MANAGER',
  QA_MANAGER: 'DEPARTMENT_MANAGER',
  QA_LEAD: 'TEAM_LEAD',
  SYSTEM_ADMINISTRATOR: 'IT_ADMIN',
  IT_SUPPORT_SPECIALIST: 'IT_ADMIN',
  // IC / engineers → MEMBER
  SOFTWARE_ENGINEER_INTERN: MEMBER_CODE,
  JUNIOR_SOFTWARE_ENGINEER: MEMBER_CODE,
  SOFTWARE_ENGINEER: MEMBER_CODE,
  SENIOR_SOFTWARE_ENGINEER: MEMBER_CODE,
  BACKEND_ENGINEER: MEMBER_CODE,
  FRONTEND_ENGINEER: MEMBER_CODE,
  FULLSTACK_ENGINEER: MEMBER_CODE,
  MOBILE_ENGINEER: MEMBER_CODE,
  SOFTWARE_ARCHITECT: MEMBER_CODE,
  SOLUTION_ARCHITECT: MEMBER_CODE,
  BUSINESS_ANALYST: MEMBER_CODE,
  SENIOR_BUSINESS_ANALYST: MEMBER_CODE,
  SYSTEM_ANALYST: MEMBER_CODE,
  UI_UX_DESIGNER: MEMBER_CODE,
  PRODUCT_DESIGNER: MEMBER_CODE,
  PROJECT_COORDINATOR: MEMBER_CODE,
  SCRUM_MASTER: MEMBER_CODE,
  PMO_ANALYST: MEMBER_CODE,
  QA_ENGINEER: MEMBER_CODE,
  SENIOR_QA_ENGINEER: MEMBER_CODE,
  TEST_AUTOMATION_ENGINEER: MEMBER_CODE,
  MANUAL_TESTER: MEMBER_CODE,
  DEVOPS_ENGINEER: MEMBER_CODE,
  SENIOR_DEVOPS_ENGINEER: MEMBER_CODE,
  CLOUD_ENGINEER: MEMBER_CODE,
  DATABASE_ADMINISTRATOR: MEMBER_CODE,
  SECURITY_ENGINEER: MEMBER_CODE,
  DATA_ENGINEER: MEMBER_CODE,
  DATA_ANALYST: MEMBER_CODE,
  DATA_SCIENTIST: MEMBER_CODE,
  AI_ENGINEER: MEMBER_CODE,
  MACHINE_LEARNING_ENGINEER: MEMBER_CODE,
  MLOPS_ENGINEER: MEMBER_CODE,
  ACCOUNTANT: MEMBER_CODE,
  FINANCIAL_ANALYST: MEMBER_CODE,
  SALES_EXECUTIVE: MEMBER_CODE,
  BUSINESS_DEVELOPMENT_EXECUTIVE: MEMBER_CODE,
  ACCOUNT_MANAGER: MEMBER_CODE,
  PRESALES_ENGINEER: MEMBER_CODE,
  CUSTOMER_SUCCESS_SPECIALIST: MEMBER_CODE,
  TECHNICAL_SUPPORT_ENGINEER: MEMBER_CODE,
  ADMINISTRATIVE_SPECIALIST: MEMBER_CODE,
});

const ensuredOrgs = new Set();

const ALLOWLIST_MEMBER_NAME = MEMBER_DISPLAY_NAME;
/** org_member / member / MEMBER và tên hiển thị thành viên → MEMBER. */
function normalizeAllowlistRoleCode(role) {
  const code = String(role?.code || role || '').trim();
  const name = String(role?.name || '').trim();
  if (name === ALLOWLIST_MEMBER_NAME) return MEMBER_CODE;
  const canonical = resolveCanonicalOrganizationRoleKey(code);
  if (canonical) return canonical;
  return code;
}

function roleIsOnAllowlist(role) {
  return Object.prototype.hasOwnProperty.call(ROLE_GRANTS, normalizeAllowlistRoleCode(role));
}

function tickShouldBeRemoved(roleCode, permissionCode) {
  const baselineCode = normalizeAllowlistRoleCode(roleCode);
  const pairs = ROLE_GRANTS[baselineCode];
  if (!pairs) return false;
  const code = String(permissionCode || '').trim().toLowerCase();
  // SoT: mọi tick không nằm baseline đều gỡ (kể cả communication/file/meeting).
  return !pairs.some(([permission]) => String(permission).toLowerCase() === code);
}

function grantsOf(roleCode) {
  const canonical = normalizeAllowlistRoleCode(roleCode);
  return ROLE_GRANTS[canonical] || [];
}

function hasCode(roleCode, permissionCode) {
  return grantsOf(roleCode).some(([code]) => code === permissionCode);
}

/** Legacy / lowercase codes that map to a canonical UPPER code. */
function legacyCodesForCanonical(canonical) {
  const target = String(canonical || '').trim();
  if (!target) return [];
  return Object.entries(LEGACY_ORGANIZATION_ROLE_KEY_ALIASES || {})
    .filter(([, mapped]) => mapped === target)
    .map(([legacy]) => legacy);
}

/**
 * Codes to look up before create: canonical + lowercase + aliases.
 * @returns {{ canonical: string, codes: string[] }}
 */
function lookupCodesForEnsure(code) {
  const raw = String(code || '').trim();
  const canonical = resolveCanonicalOrganizationRoleKey(raw) || raw;
  const fromShared =
    typeof organizationRoleLookupCodes === 'function'
      ? organizationRoleLookupCodes(canonical)
      : [];
  const codes = [
    ...new Set(
      [canonical, raw, canonical.toLowerCase(), ...legacyCodesForCanonical(canonical), ...fromShared].filter(
        Boolean
      )
    ),
  ];
  return { canonical, codes };
}

/**
 * Prefer canonical UPPER row when both legacy/lowercase and canonical exist.
 * @param {Array<{ code?: string }>} rows
 * @param {string} canonical
 */
function pickRoleRowPreferCanonical(rows, canonical) {
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) return null;
  const want = String(canonical || '').trim();
  return list.find((row) => String(row?.code || '').trim() === want) || list[0];
}

async function reassignGrantsFromAliasRoles(organizationId, keepRoleId, aliasRoleIds) {
  const keepId = keepRoleId;
  const dropIds = (aliasRoleIds || []).filter((id) => String(id) !== String(keepId));
  for (const aliasId of dropIds) {
    const grants = await UserOrgRoleGrant.find({ organizationId, roleId: aliasId })
      .select('_id userId')
      .lean();
    for (const grant of grants) {
      const exists = await UserOrgRoleGrant.findOne({
        organizationId,
        userId: grant.userId,
        roleId: keepId,
      })
        .select('_id')
        .lean();
      if (exists) {
        await UserOrgRoleGrant.deleteOne({ _id: grant._id });
      } else {
        await UserOrgRoleGrant.updateOne({ _id: grant._id }, { $set: { roleId: keepId } });
      }
    }
    const bindings = await PositionRoleBinding.find({ organizationId, roleId: aliasId })
      .select('_id positionId')
      .lean();
    for (const binding of bindings) {
      const exists = await PositionRoleBinding.findOne({
        organizationId,
        positionId: binding.positionId,
        roleId: keepId,
      })
        .select('_id')
        .lean();
      if (exists) {
        await PositionRoleBinding.deleteOne({ _id: binding._id });
      } else {
        await PositionRoleBinding.updateOne({ _id: binding._id }, { $set: { roleId: keepId } });
      }
    }
    await OrgRolePermission.deleteMany({ organizationId, roleId: aliasId });
    await OrganizationalRole.deleteOne({ _id: aliasId, organizationId });
  }
}

async function ensureRole(organizationId, code, sortOrder) {
  const { canonical, codes } = lookupCodesForEnsure(code);
  const name = ROLE_NAMES[canonical] || code;
  const description = ROLE_DESCRIPTIONS[canonical] || '';
  let matches = await OrganizationalRole.find({
    organizationId,
    code: { $in: codes },
  }).lean();
  let row = pickRoleRowPreferCanonical(matches, canonical);
  if (!row && canonical === MEMBER_CODE) {
    row = await OrganizationalRole.findOne({
      organizationId,
      name: { $in: ['Member', 'member', 'Thành viên', MEMBER_DISPLAY_NAME] },
    }).lean();
    if (row) matches = [...matches, row];
  }
  if (!row) {
    row = (
      await OrganizationalRole.create({
        organizationId,
        code: canonical,
        name,
        description,
        status: 'active',
        sortOrder,
      })
    ).toObject();
    return { row, created: true };
  }

  const aliasIds = matches
    .map((m) => m._id)
    .filter((id) => String(id) !== String(row._id));
  if (aliasIds.length) {
    await reassignGrantsFromAliasRoles(organizationId, row._id, aliasIds);
  }

  const expectedName = ROLE_NAMES[canonical] || (canonical === MEMBER_CODE ? MEMBER_DISPLAY_NAME : null);
  const $set = {};
  if (expectedName && row.name !== expectedName) $set.name = expectedName;
  if (description && String(row.description || '').trim() !== description) {
    $set.description = description;
  }
  if (String(row.code || '') !== canonical && ROLE_GRANTS[canonical]) {
    const conflict = await OrganizationalRole.findOne({
      organizationId,
      code: canonical,
      _id: { $ne: row._id },
    })
      .select('_id')
      .lean();
    if (!conflict) $set.code = canonical;
  }
  if (Object.keys($set).length) {
    row = await OrganizationalRole.findOneAndUpdate(
      { _id: row._id },
      { $set },
      { returnDocument: 'after' }
    ).lean();
  }
  return { row, created: false };
}

async function ensureMissingTicks(organizationId, roleId, entries) {
  let inserted = 0;
  for (const [permissionCode, scopeType] of entries) {
    const res = await OrgRolePermission.updateOne(
      { organizationId, roleId, permissionCode },
      {
        $set: { scopeType },
        $setOnInsert: { organizationId, roleId, permissionCode },
      },
      { upsert: true }
    );
    if (res.upsertedCount) inserted += 1;
  }
  return inserted;
}

/**
 * ORG_OWNER / ORG_ADMIN → DIRECTOR: chuyển grant/assignment/binding, disable role cũ, xóa tick.
 */
async function mergeDeprecatedRolesIntoDirector(organizationId, directorRole) {
  if (!directorRole?._id) return { mergedUsers: 0, disabledRoles: 0 };
  const OrgRoleAssignment = require('../models/OrgRoleAssignment');
  const deprecated = await OrganizationalRole.find({
    organizationId,
    code: { $in: [...DEPRECATED_MERGE_INTO_DIRECTOR] },
  })
    .select('_id code')
    .lean();
  if (!deprecated.length) return { mergedUsers: 0, disabledRoles: 0 };

  const aliasIds = deprecated.map((r) => r._id);
  await reassignGrantsFromAliasRoles(organizationId, directorRole._id, aliasIds);

  let mergedUsers = 0;
  for (const row of deprecated) {
    const assignments = await OrgRoleAssignment.find({
      organizationId,
      roleKey: { $in: [row.code, String(row.code || '').toLowerCase()] },
    })
      .select('userId')
      .lean();
    for (const a of assignments) {
      const uid = a.userId;
      const exists = await OrgRoleAssignment.findOne({
        organizationId,
        userId: uid,
        roleKey: 'DIRECTOR',
      })
        .select('_id')
        .lean();
      if (!exists) {
        await OrgRoleAssignment.create({
          organizationId,
          userId: uid,
          roleKey: 'DIRECTOR',
          assignedBy: uid,
        });
        mergedUsers += 1;
      }
    }
    await OrgRoleAssignment.deleteMany({
      organizationId,
      roleKey: { $in: [row.code, String(row.code || '').toLowerCase()] },
    });
  }

  await OrgRolePermission.deleteMany({ organizationId, roleId: { $in: aliasIds } });
  await OrganizationalRole.updateMany(
    { _id: { $in: aliasIds } },
    { $set: { status: 'disabled' } }
  );

  return { mergedUsers, disabledRoles: deprecated.length };
}

async function ensurePositionBinding(organizationId, positionCode, roleId) {
  const def = MASTER_POSITIONS.find((row) => row.key === positionCode);
  let position = await OrganizationalPosition.findOne({ organizationId, code: positionCode }).lean();
  if (!position) {
    position = (
      await OrganizationalPosition.create({
        organizationId,
        code: positionCode,
        name: def?.label || positionCode,
        status: 'active',
        sortOrder: def?.sortOrder || 100,
      })
    ).toObject();
  }
  const existing = await PositionRoleBinding.find({
    organizationId,
    positionId: position._id,
  })
    .select('roleId')
    .lean();
  const already =
    existing.length === 1 && String(existing[0].roleId) === String(roleId);
  if (already) return position._id;
  await PositionRoleBinding.deleteMany({ organizationId, positionId: position._id });
  await PositionRoleBinding.create({
    organizationId,
    positionId: position._id,
    roleId,
    isDefault: true,
  });
  return position._id;
}

async function trimExtraOrgTicks(organizationId, roleId, roleCode) {
  const rows = await OrgRolePermission.find({ organizationId, roleId })
    .select('_id permissionCode')
    .lean();
  const removeIds = rows
    .filter((row) => tickShouldBeRemoved(roleCode, row.permissionCode))
    .map((row) => row._id);
  if (!removeIds.length) return 0;
  const res = await OrgRolePermission.deleteMany({ _id: { $in: removeIds } });
  return res.deletedCount || removeIds.length;
}

async function dropBindingsOutsideAllowlist(organizationId) {
  const bindings = await PositionRoleBinding.find({ organizationId }).select('_id roleId').lean();
  if (!bindings.length) return 0;
  const roleIds = [...new Set(bindings.map((row) => String(row.roleId)).filter(Boolean))];
  const roles = await OrganizationalRole.find({ _id: { $in: roleIds } })
    .select('_id code name')
    .lean();
  const allowed = new Set(roles.filter((role) => roleIsOnAllowlist(role)).map((role) => String(role._id)));
  const dropIds = bindings.filter((row) => !allowed.has(String(row.roleId))).map((row) => row._id);
  if (!dropIds.length) return 0;
  const res = await PositionRoleBinding.deleteMany({ _id: { $in: dropIds } });
  return res.deletedCount || dropIds.length;
}

async function ensureOrgRoleGrantBaseline(organizationId, { force = false } = {}) {
  const orgKey = String(organizationId || '').trim();
  if (!orgKey) return { skipped: true };
  if (!force && ensuredOrgs.has(orgKey)) return { skipped: true };
  if (force) ensuredOrgs.delete(orgKey);

  const roleByCode = new Map();
  let sort = 10;
  for (const code of Object.keys(ROLE_GRANTS)) {
    const { row } = await ensureRole(organizationId, code, sort);
    sort += 10;
    roleByCode.set(code, row);
    await ensureMissingTicks(organizationId, row._id, ROLE_GRANTS[code]);
  }

  const directorMerge = await mergeDeprecatedRolesIntoDirector(
    organizationId,
    roleByCode.get('DIRECTOR')
  );

  const allowlistedRoles = await OrganizationalRole.find({ organizationId })
    .select('_id code name')
    .lean();
  let removedTicks = 0;
  for (const role of allowlistedRoles) {
    if (!roleIsOnAllowlist(role)) continue;
    removedTicks += await trimExtraOrgTicks(
      organizationId,
      role._id,
      normalizeAllowlistRoleCode(role)
    );
  }
  const removedBindings = await dropBindingsOutsideAllowlist(organizationId);
  if (removedTicks || removedBindings || directorMerge.disabledRoles) {
    const { logger } = require('@enterprise/shared');
    logger.info('[orgRoleGrantBaseline] trimmed leftover grants', {
      organizationId: orgKey,
      removedTicks,
      removedBindings,
      directorMerge,
    });
    const [activeAssignments, personalGrants] = await Promise.all([
      EmployeePositionAssignment.find({ organizationId, status: 'active' }).select('userId').lean(),
      UserOrgRoleGrant.find({ organizationId }).select('userId').lean(),
    ]);
    await invalidatePermissionCacheForUsers(organizationId, [
      ...activeAssignments.map((row) => row.userId),
      ...personalGrants.map((row) => row.userId),
    ]);
  }

  const touchedPositionIds = [];
  for (const [positionCode, roleCode] of Object.entries(POSITION_ROLE_CODE)) {
    const role = roleByCode.get(roleCode);
    if (!role) continue;
    const positionId = await ensurePositionBinding(organizationId, positionCode, role._id);
    touchedPositionIds.push(positionId);
  }

  const assignments = touchedPositionIds.length
    ? await EmployeePositionAssignment.find({
        organizationId,
        positionId: { $in: touchedPositionIds },
        status: 'active',
      })
        .select('userId')
        .lean()
    : [];
  await invalidatePermissionCacheForUsers(
    organizationId,
    assignments.map((row) => row.userId)
  );

  ensuredOrgs.add(orgKey);
  return { skipped: false, directorMerge, removedTicks, removedBindings };
}

module.exports = {
  ROLE_GRANTS,
  ROLE_NAMES,
  ROLE_DESCRIPTIONS,
  POSITION_ROLE_CODE,
  MEMBER_CODE,
  MEMBER_DISPLAY_NAME,
  grantsOf,
  hasCode,
  normalizeAllowlistRoleCode,
  roleIsOnAllowlist,
  tickShouldBeRemoved,
  legacyCodesForCanonical,
  lookupCodesForEnsure,
  pickRoleRowPreferCanonical,
  ensureOrgRoleGrantBaseline,
};
