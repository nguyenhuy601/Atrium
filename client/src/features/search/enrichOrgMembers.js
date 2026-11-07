import userService from '../../services/userService';
import { memberDepartmentId } from '../../utils/filterTeamMembers';
import { resolveEnrichedMemberContact } from './enrichOrgMembersContact';

export { resolveEnrichedMemberContact } from './enrichOrgMembersContact';

const unwrapBody = (payload) => payload?.data ?? payload;

export function memberUserId(m) {
  const u = m?.user;
  if (u && typeof u === 'object') return String(u._id || u.id || u.userId || '');
  return String(u || m?.userId || '').trim();
}

function unwrapProfile(res) {
  const u = unwrapBody(res)?.data ?? unwrapBody(res);
  return u?.data ?? u;
}

function membershipHasEmbeddedContact(m) {
  if (!m || typeof m !== 'object') return false;
  const name = String(m.displayName || m.fullName || '').trim();
  const email = String(m.email || '').trim();
  const avatar = m.avatar != null && String(m.avatar).trim() !== '';
  const username = String(m.username || '').trim();
  return Boolean(name || email || avatar || username);
}

/**
 * Membership (org API) → hàng có displayName / email / avatar.
 * Org members/with-roles đã batch profile phía BE — không gọi N× GET /users/:id khi đã có contact.
 */
export async function enrichMembershipsWithProfiles(members, options = {}) {
  const fallback = String(options.fallback || '—');
  const limit = Number.isFinite(options.limit) ? options.limit : Infinity;
  const forceFetch = Boolean(options.forceFetchProfiles);
  const list = Array.isArray(members) ? members : [];
  const slice = Number.isFinite(limit) ? list.slice(0, Math.max(0, limit)) : list;

  return Promise.all(
    slice.map(async (m) => {
      const uid = memberUserId(m);
      let profile = null;
      const canSkipFetch = !forceFetch && membershipHasEmbeddedContact(m);
      if (uid && !canSkipFetch) {
        try {
          profile = unwrapProfile(await userService.getProfile(uid));
        } catch {
          /* giữ membership / fallback */
        }
      }
      const contact = resolveEnrichedMemberContact(profile, m, {
        fallback,
        userId: uid,
      });
      return {
        membershipId: String(m?._id || m?.id || ''),
        userId: uid,
        role: String(m?.role || 'member').toLowerCase(),
        divisionId: m?.division ? String(m.division) : '',
        departmentId: memberDepartmentId(m),
        teamId: String(m?.teamId || m?.team || '').trim(),
        displayName: contact.displayName,
        email: contact.email,
        username: contact.username,
        avatar: contact.avatar,
        raw: m,
      };
    })
  );
}

/**
 * Membership → hàng search (giữ API cũ).
 */
export async function enrichMembershipsForSearch(members) {
  const rows = await enrichMembershipsWithProfiles(
    Array.isArray(members)
      ? members.filter((m) => String(m?.status || 'active') === 'active')
      : []
  );
  return rows.map((row) => ({
    membershipId: row.membershipId,
    userId: row.userId,
    role: row.role,
    displayName: row.displayName,
    username: row.username,
    avatar: row.avatar,
    raw: row.raw,
  }));
}

/**
 * Batch profile theo danh sách userId (ACL access rows, v.v.).
 * Chỉ fetch khi chưa có tên trong options.seedByUserId.
 */
export async function enrichUserIdsWithProfiles(userIds, options = {}) {
  const fallback = String(options.fallback || '—');
  const seed =
    options.seedByUserId && typeof options.seedByUserId === 'object'
      ? options.seedByUserId
      : {};
  const ids = [...new Set((userIds || []).map((id) => String(id || '').trim()).filter(Boolean))];
  const entries = await Promise.all(
    ids.map(async (uid) => {
      const seeded = seed[uid];
      if (seeded && (seeded.displayName || seeded.email)) {
        return [
          uid,
          {
            displayName: String(seeded.displayName || uid.slice(-6) || fallback),
            email: String(seeded.email || '').trim(),
          },
        ];
      }
      let displayName = uid.slice(-6) || fallback;
      let email = '';
      try {
        const profile = unwrapProfile(await userService.getProfile(uid));
        displayName =
          profile?.displayName ||
          profile?.fullName ||
          profile?.username ||
          displayName;
        email = String(profile?.email || '').trim();
      } catch {
        /* */
      }
      return [uid, { displayName, email }];
    })
  );
  return Object.fromEntries(entries);
}
