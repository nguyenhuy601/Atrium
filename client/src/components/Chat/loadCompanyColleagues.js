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
 * Bắt buộc `departmentId` — không kéo roster cả org rồi lọc client.
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
  if (!optionDeptId) {
    return { colleagues: [], emptyReason: 'no_department' };
  }

  const res = await organizationAPI.getMembersWithRoles(oid, {
    view: 'directory',
    departmentId: optionDeptId,
  });
  const raw = unwrapMembers(res).filter((m) => String(m?.status || 'active') === 'active');
  const enriched = await enrichMembershipsWithProfiles(raw, {
    fallback: options.fallback || '—',
  });

  const me = String(currentUserId || '').trim();
  const list = enriched
    .filter((row) => {
      const uid = String(row.userId || memberUserId(row.raw) || '').trim();
      if (!uid || uid === me) return false;
      const dept = memberDepartmentId(row) || optionDeptId;
      return String(dept) === optionDeptId;
    })
    .map((row) => ({
      userId: String(row.userId),
      displayName: String(row.displayName || '').trim() || String(row.userId).slice(-6),
      email: String(row.email || '').trim(),
      avatar: row.avatar || '',
      departmentId: memberDepartmentId(row) || optionDeptId,
    }));

  list.sort((a, b) => a.displayName.localeCompare(b.displayName, 'vi'));
  return {
    colleagues: list,
    emptyReason: list.length ? null : 'none',
  };
}
