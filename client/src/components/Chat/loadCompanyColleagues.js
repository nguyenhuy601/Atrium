import { organizationAPI } from '../../services/api/organizationAPI';
import {
  enrichMembershipsWithProfiles,
  memberUserId,
} from '../../features/search/enrichOrgMembers';
import { memberDepartmentId } from '../../utils/filterTeamMembers';

function unwrapMembers(payload) {
  const body = payload?.data !== undefined ? payload.data : payload;
  if (Array.isArray(body?.members)) return body.members;
  if (Array.isArray(body?.data?.members)) return body.data.members;
  if (Array.isArray(body?.data)) return body.data;
  if (Array.isArray(body)) return body;
  return [];
}

/**
 * Đồng nghiệp cùng phòng ban (rule X — kể cả Owner/Admin/HR không có phòng → list trống).
 * Dùng getMembersWithRoles để luôn có placement department.
 *
 * @param {string} orgId
 * @param {string} currentUserId
 * @param {{ fallback?: string, departmentId?: string }} [options]
 * @returns {Promise<{ colleagues: object[], emptyReason: null|'no_department'|'none' }>}
 */
export async function loadCompanyColleagues(orgId, currentUserId, options = {}) {
  const oid = String(orgId || '').trim();
  if (!oid) return { colleagues: [], emptyReason: 'none' };

  const optionDeptId = String(options.departmentId || '').trim();
  const res = await organizationAPI.getMembersWithRoles(oid, {
    view: 'directory',
    ...(optionDeptId ? { departmentId: optionDeptId } : {}),
  });
  const raw = unwrapMembers(res).filter((m) => String(m?.status || 'active') === 'active');
  const enriched = await enrichMembershipsWithProfiles(raw, {
    fallback: options.fallback || '—',
  });

  const me = String(currentUserId || '').trim();
  const myDeptIds = new Set();
  if (optionDeptId) {
    myDeptIds.add(optionDeptId);
  }
  for (const row of enriched) {
    const uid = String(row.userId || memberUserId(row.raw) || '').trim();
    if (!uid || uid !== me) continue;
    const dept = memberDepartmentId(row);
    if (dept) myDeptIds.add(dept);
  }

  if (myDeptIds.size === 0) {
    return { colleagues: [], emptyReason: 'no_department' };
  }

  const list = enriched
    .filter((row) => {
      const uid = String(row.userId || memberUserId(row.raw) || '').trim();
      if (!uid || uid === me) return false;
      const dept = memberDepartmentId(row);
      return dept && myDeptIds.has(dept);
    })
    .map((row) => ({
      userId: String(row.userId),
      displayName: String(row.displayName || '').trim() || String(row.userId).slice(-6),
      email: String(row.email || '').trim(),
      avatar: row.avatar || '',
      departmentId: memberDepartmentId(row),
    }));

  list.sort((a, b) => a.displayName.localeCompare(b.displayName, 'vi'));
  return {
    colleagues: list,
    emptyReason: list.length ? null : 'none',
  };
}
