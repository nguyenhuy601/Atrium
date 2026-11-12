#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Backfill phòng ban + vị trí + vai trò tổ chức từ jobTitle / membership thật.
 *
 * SoT:
 * - preferences.jobTitle (fallback jobTitle) → OrganizationalPosition
 * - Heuristic phòng ban theo chức danh (giữ dept hiện tại nếu còn khớp)
 * - PositionRoleBinding → OrgRoleAssignment + UserOrgRoleGrant
 * - Trưởng phòng hiện có → DEPARTMENT_MANAGER
 * - membership admin/hr/owner → IT_ADMIN / HR_APPROVER / DIRECTOR bổ sung khi phù hợp
 *
 * Usage (trong container organization-service):
 *   node scripts/backfill-member-placement-from-jobtitle.js --orgId=6a55d5f0888221ae1fca4fcf
 *   node scripts/backfill-member-placement-from-jobtitle.js --orgId=... --dry-run
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('@enterprise/shared');

const Membership = require('../src/models/Membership');
const Department = require('../src/models/Department');
const OrganizationalPosition = require('../src/models/OrganizationalPosition');
const OrganizationalRole = require('../src/models/OrganizationalRole');
const OrgRoleAssignment = require('../src/models/OrgRoleAssignment');
const EmployeePositionAssignment = require('../src/models/EmployeePositionAssignment');

const { assignPositionToUser, replaceUserOrgRoleGrants } = require('../src/services/orgRbacMatrix.service');
const {
  ensureOrgRoleGrantBaseline,
  POSITION_ROLE_CODE,
} = require('../src/services/orgRoleGrantBaseline.service');
const deptMembership = require('../src/services/departmentMembership.service');
const { syncUserOrgRole } = require('../src/services/rolePermissionOrgSync');

const ORG_ID_DEFAULT = '6a55d5f0888221ae1fca4fcf';

/** jobTitle (lowercase) → position code trong catalog org */
const JOB_TITLE_TO_POSITION = Object.freeze({
  'quản trị hệ thống': 'SYSTEM_ADMINISTRATOR',
  'quan tri he thong': 'SYSTEM_ADMINISTRATOR',
  'system administrator': 'SYSTEM_ADMINISTRATOR',
  'it admin': 'SYSTEM_ADMINISTRATOR',
  'product owner': 'PRODUCT_OWNER',
  'product manager': 'PRODUCT_MANAGER',
  'project manager': 'PROJECT_MANAGER',
  'business analyst': 'BUSINESS_ANALYST',
  ba: 'BUSINESS_ANALYST',
  'frontend engineer': 'FRONTEND_ENGINEER',
  'frontend developer': 'FRONTEND_ENGINEER',
  'front end engineer': 'FRONTEND_ENGINEER',
  'front-end engineer': 'FRONTEND_ENGINEER',
  'backend engineer': 'BACKEND_ENGINEER',
  'backend developer': 'BACKEND_ENGINEER',
  'back end engineer': 'BACKEND_ENGINEER',
  'fullstack developer': 'FULLSTACK_ENGINEER',
  'full-stack engineer': 'FULLSTACK_ENGINEER',
  'full stack engineer': 'FULLSTACK_ENGINEER',
  'mobile developer': 'MOBILE_ENGINEER',
  'mobile engineer': 'MOBILE_ENGINEER',
  'devops engineer': 'DEVOPS_ENGINEER',
  devops: 'DEVOPS_ENGINEER',
  'qa engineer': 'QA_ENGINEER',
  qa: 'QA_ENGINEER',
  'manual tester': 'MANUAL_TESTER',
  'ui/ux designer': 'UI_UX_DESIGNER',
  'ui ux designer': 'UI_UX_DESIGNER',
  'ux designer': 'ux_designer',
  'product designer': 'PRODUCT_DESIGNER',
  'data analyst': 'DATA_ANALYST',
  'technical lead': 'technical_lead',
  'tech lead': 'technical_lead',
  'team lead': 'team_lead',
  'engineering manager': 'engineering_manager',
  architect: 'SOFTWARE_ARCHITECT',
  'software architect': 'SOFTWARE_ARCHITECT',
  'scrum master': 'SCRUM_MASTER',
  junior: 'JUNIOR_SOFTWARE_ENGINEER',
  intern: 'SOFTWARE_ENGINEER_INTERN',
  'thực tập': 'SOFTWARE_ENGINEER_INTERN',
  hr: 'HR_SPECIALIST',
  'hr specialist': 'HR_SPECIALIST',
  'nhân sự': 'HR_SPECIALIST',
});

function argValue(name) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? String(hit.split('=').slice(1).join('=') || '').trim() : '';
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function coalesceJobTitle(profile) {
  const pref = profile?.preferences;
  if (pref && Object.prototype.hasOwnProperty.call(pref, 'jobTitle')) {
    return String(pref.jobTitle || '').trim();
  }
  return String(profile?.jobTitle || '').trim();
}

function normalizeTitle(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function resolvePositionCode(jobTitle, positionsByCode, positionsByName) {
  const norm = normalizeTitle(jobTitle);
  if (!norm) return '';
  if (JOB_TITLE_TO_POSITION[norm]) return JOB_TITLE_TO_POSITION[norm];
  const byName = positionsByName.get(norm);
  if (byName) return byName.code;
  const slug = norm.replace(/[\s/-]+/g, '_').replace(/[^a-z0-9_]/g, '');
  if (positionsByCode.has(slug)) return slug;
  const upper = slug.toUpperCase();
  if (positionsByCode.has(upper)) return upper;
  return '';
}

function resolveOrgRoleForPosition(positionCode) {
  const code = String(positionCode || '').trim();
  if (!code) return 'MEMBER';
  if (POSITION_ROLE_CODE[code]) return POSITION_ROLE_CODE[code];
  const lower = code.toLowerCase();
  if (POSITION_ROLE_CODE[lower]) return POSITION_ROLE_CODE[lower];
  return 'MEMBER';
}

/**
 * Chọn phòng ban theo chức danh; ưu tiên giữ dept hiện tại nếu còn hợp lý.
 */
function resolveDepartmentId({ jobTitle, currentDeptId, currentDeptName, deptsByName }) {
  const title = normalizeTitle(jobTitle);
  const pick = (...names) => {
    for (const n of names) {
      const d = deptsByName.get(String(n).toLowerCase());
      if (d) return String(d._id);
    }
    return '';
  };

  const currentName = String(currentDeptName || '').toLowerCase();
  const keepIf = (...allowed) => {
    if (currentDeptId && allowed.some((a) => currentName === String(a).toLowerCase())) {
      return String(currentDeptId);
    }
    return '';
  };

  if (!title) return currentDeptId ? String(currentDeptId) : '';

  if (/quản trị hệ thống|system admin|it admin/.test(title)) {
    return currentDeptId ? String(currentDeptId) : '';
  }
  if (/^hr\b|nhân sự|human resource/.test(title)) {
    return keepIf('Phòng Nhân sự') || pick('Phòng Nhân sự');
  }
  if (/business analyst|^ba\b/.test(title)) {
    return keepIf('BA', 'Phòng Sản phẩm') || pick('BA', 'Phòng Sản phẩm');
  }
  if (/product owner|product manager|project manager|scrum|delivery|pmo/.test(title)) {
    return (
      keepIf('Phòng Sản phẩm', 'Phòng Phát triển', 'BA', 'Front End', 'Backend') ||
      pick('Phòng Sản phẩm', 'Phòng Phát triển')
    );
  }
  if (/frontend|front-end|front end|ui\/ux|ux designer|product designer|mobile/.test(title)) {
    return keepIf('Front End', 'Phòng Phát triển') || pick('Front End', 'Phòng Phát triển');
  }
  if (/backend|back-end|back end|devops|architect|fullstack|full-stack|full stack|software engineer|junior|intern|thực tập|tech lead|technical lead|team lead|engineering manager/.test(title)) {
    // Không giữ Front End cho backend/devops — chuyển về Backend / Phát triển.
    return keepIf('Backend', 'Phòng Phát triển') || pick('Backend', 'Phòng Phát triển');
  }
  if (/\bqa\b|tester|test automation/.test(title)) {
    return keepIf('Phòng Phát triển', 'BA', 'Backend') || pick('Phòng Phát triển', 'BA');
  }
  if (/data analyst|sales|presales|account manager|business development|customer success/.test(title)) {
    return keepIf('Phòng Kinh doanh') || pick('Phòng Kinh doanh');
  }

  return currentDeptId ? String(currentDeptId) : '';
}

function roleKeysForMember({ membershipRole, positionCode, isDeptHead }) {
  const keys = new Set();
  const fromPos = resolveOrgRoleForPosition(positionCode);
  if (fromPos) keys.add(fromPos);

  if (isDeptHead) keys.add('DEPARTMENT_MANAGER');

  const mem = String(membershipRole || '').toLowerCase();
  if (mem === 'owner') keys.add('DIRECTOR');
  if (mem === 'admin') keys.add('IT_ADMIN');
  if (mem === 'hr') keys.add('HR_APPROVER');

  // POSITION SYSTEM_ADMINISTRATOR luôn IT_ADMIN
  if (String(positionCode) === 'SYSTEM_ADMINISTRATOR') keys.add('IT_ADMIN');

  return [...keys];
}

async function loadProfiles(userIds) {
  const USER_URI = String(process.env.MONGODB_URI || '').replace(/\/[^/?]+(\?|$)/, '/user_db$1');
  const conn = await mongoose.createConnection(USER_URI).asPromise();
  try {
    const oids = userIds.map((id) => new mongoose.Types.ObjectId(String(id)));
    const strs = userIds.map(String);
    const rows = await conn.db
      .collection('userprofiles')
      .find({
        $or: [{ userId: { $in: oids } }, { userId: { $in: strs } }, { user: { $in: oids } }, { user: { $in: strs } }],
      })
      .project({ userId: 1, user: 1, displayName: 1, firstName: 1, lastName: 1, jobTitle: 1, preferences: 1, employeeCode: 1 })
      .toArray();
    const map = new Map();
    for (const row of rows) {
      map.set(String(row.userId || row.user || ''), row);
    }
    return map;
  } finally {
    await conn.close();
  }
}

async function setOrgRoles(organizationId, userId, roleKeys, actorUserId) {
  const oid = new mongoose.Types.ObjectId(String(organizationId));
  const uid = new mongoose.Types.ObjectId(String(userId));
  const keys = [...new Set((roleKeys || []).map((k) => String(k).trim()).filter(Boolean))];

  await OrgRoleAssignment.deleteMany({ organizationId: oid, userId: uid });

  if (!keys.length) {
    await replaceUserOrgRoleGrants(organizationId, userId, []);
    return [];
  }

  const roles = await OrganizationalRole.find({
    organizationId: oid,
    status: 'active',
    code: { $in: keys },
  })
    .select('_id code')
    .lean();

  const foundCodes = new Set(roles.map((r) => r.code));
  const missing = keys.filter((k) => !foundCodes.has(k));
  if (missing.length) {
    console.warn(`[warn] missing org roles for ${userId}: ${missing.join(',')}`);
  }

  const now = new Date();
  if (roles.length) {
    await OrgRoleAssignment.insertMany(
      roles.map((r) => ({
        organizationId: oid,
        userId: uid,
        roleKey: r.code,
        assignedBy: actorUserId ? new mongoose.Types.ObjectId(String(actorUserId)) : uid,
        createdAt: now,
        updatedAt: now,
      }))
    );
  }
  await replaceUserOrgRoleGrants(
    organizationId,
    userId,
    roles.map((r) => String(r._id))
  );
  return roles.map((r) => r.code);
}

async function run() {
  const orgId = argValue('orgId') || ORG_ID_DEFAULT;
  const dryRun = hasFlag('dry-run');
  console.log(`[backfill] orgId=${orgId} dryRun=${dryRun}`);

  await connectDB();
  // Baseline (bind position→role) chỉ cần khi ghi; dry-run bỏ qua để inventory nhanh.
  if (!dryRun) {
    console.log('[backfill] ensureOrgRoleGrantBaseline…');
    await ensureOrgRoleGrantBaseline(orgId);
    console.log('[backfill] baseline done');
  }

  const [memberships, departments, positions] = await Promise.all([
    Membership.find({ organization: orgId, status: 'active' }).lean(),
    Department.find({ organization: orgId }).select('_id name members head').lean(),
    OrganizationalPosition.find({ organizationId: orgId, status: 'active' }).select('_id code name').lean(),
  ]);

  const positionsByCode = new Map(positions.map((p) => [String(p.code), p]));
  const positionsByName = new Map(
    positions.map((p) => [String(p.name || '').trim().toLowerCase(), p])
  );
  const deptsByName = new Map(departments.map((d) => [String(d.name || '').trim().toLowerCase(), d]));
  const deptByMember = new Map();
  const headUserIds = new Set();
  for (const d of departments) {
    if (d.head) {
      headUserIds.add(String(d.head));
      deptByMember.set(String(d.head), d);
    }
    for (const m of d.members || []) deptByMember.set(String(m), d);
  }

  const userIds = memberships.map((m) => String(m.user));
  const profiles = await loadProfiles(userIds);

  // Actor = owner hoặc admin đầu tiên
  const actor =
    memberships.find((m) => m.role === 'owner') ||
    memberships.find((m) => m.role === 'admin') ||
    memberships[0];
  const actorUserId = actor ? String(actor.user) : userIds[0];

  const plan = [];
  for (const m of memberships) {
    const userId = String(m.user);
    const profile = profiles.get(userId) || {};
    const jobTitle = coalesceJobTitle(profile);
    const currentDept = deptByMember.get(userId) || null;
    const positionCode =
      resolvePositionCode(jobTitle, positionsByCode, positionsByName) ||
      (String(m.role).toLowerCase() === 'admin' ? 'SYSTEM_ADMINISTRATOR' : '') ||
      (String(m.role).toLowerCase() === 'owner' ? 'PRODUCT_OWNER' : '');

    if (!positionCode || !positionsByCode.has(positionCode)) {
      plan.push({
        userId,
        name: profile.displayName || '',
        jobTitle,
        skip: true,
        reason: positionCode ? `position_missing:${positionCode}` : 'no_job_title',
      });
      continue;
    }

    const departmentId = resolveDepartmentId({
      jobTitle,
      currentDeptId: currentDept?._id ? String(currentDept._id) : '',
      currentDeptName: currentDept?.name || '',
      deptsByName,
    });

    const isDeptHead = headUserIds.has(userId);
    const roleKeys = roleKeysForMember({
      membershipRole: m.role,
      positionCode,
      isDeptHead,
    });

    plan.push({
      userId,
      name: profile.displayName || [profile.firstName, profile.lastName].filter(Boolean).join(' '),
      employeeCode: profile.employeeCode || profile.preferences?.employeeCode || '',
      membershipRole: m.role,
      jobTitle,
      positionCode,
      departmentId,
      departmentName: departmentId
        ? departments.find((d) => String(d._id) === departmentId)?.name || ''
        : '',
      roleKeys,
      isDeptHead,
      skip: false,
    });
  }

  console.log(`[backfill] plan ${plan.length} members; skip=${plan.filter((p) => p.skip).length}`);
  for (const row of plan) {
    if (row.skip) {
      console.log(`  SKIP ${row.userId} ${row.name} JT=${row.jobTitle || '-'} (${row.reason})`);
      continue;
    }
    console.log(
      `  ${row.employeeCode || '-'} | ${row.name || row.userId} | JT=${row.jobTitle} → pos=${row.positionCode} | dept=${row.departmentName || '-'} | roles=${row.roleKeys.join(',')}`
    );
  }

  if (dryRun) {
    console.log('[backfill] dry-run only — no writes');
    await disconnectDB().catch(() => {});
    process.exit(0);
  }

  let ok = 0;
  let fail = 0;
  for (const row of plan) {
    if (row.skip) continue;
    try {
      if (row.departmentId) {
        await deptMembership.addMembers(orgId, row.departmentId, [row.userId], {
          actorUserId,
        });
      }

      await assignPositionToUser(orgId, {
        userId: row.userId,
        positionId: row.positionCode,
        departmentId: row.departmentId || null,
      });

      const assigned = await setOrgRoles(orgId, row.userId, row.roleKeys, actorUserId);
      await syncUserOrgRole(row.userId, orgId, row.membershipRole).catch((err) => {
        console.warn(`[warn] syncUserOrgRole ${row.userId}:`, err.message);
      });

      ok += 1;
      console.log(`  OK ${row.employeeCode || row.userId} roles=${assigned.join(',')}`);
    } catch (err) {
      fail += 1;
      console.error(`  FAIL ${row.employeeCode || row.userId}:`, err.message);
    }
  }

  // End stale assignments that were not refreshed for skipped? leave as-is.
  const active = await EmployeePositionAssignment.countDocuments({
    organizationId: orgId,
    status: 'active',
  });
  console.log(`[backfill] done ok=${ok} fail=${fail} activeAssignments=${active}`);
  await disconnectDB().catch(() => {});
  process.exit(fail ? 1 : 0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
