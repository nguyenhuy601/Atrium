import { organizationAPI } from '../services/api/organizationAPI';

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map();

function unwrapList(payload) {
  const body = payload?.data ?? payload;
  const data = body?.data ?? body;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.organizations)) return data.organizations;
  if (Array.isArray(data?.friends)) return data.friends;
  return [];
}

/**
 * Tổ chức chung với một user — GET /organizations/my?mutualWith=
 * (một request; không kéo members từng org).
 * @param {string} friendUserId
 * @param {{ force?: boolean }} [opts]
 */
export async function fetchMutualOrganizations(friendUserId, opts = {}) {
  const fid = String(friendUserId || '').trim();
  if (!fid) return { count: 0, organizations: [] };

  const force = Boolean(opts.force);
  const cached = cache.get(fid);
  if (!force && cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.data;
  }

  const orgResp = await organizationAPI.getOrganizations({ mutualWith: fid });
  const myOrgs = unwrapList(orgResp);
  const organizations = myOrgs.map((org) => {
    const orgId = String(org._id || org.id || '');
    return {
      _id: orgId,
      name: org.name,
      slug: org.slug,
      logo: org.logo ?? null,
      description: org.description ?? '',
      myRole: org.myRole || null,
    };
  }).filter((o) => o._id);

  const data = { count: organizations.length, organizations };
  cache.set(fid, { at: Date.now(), data });
  return data;
}

/** Xóa cache nhóm chung (một friend hoặc toàn bộ). */
export function invalidateMutualOrganizationsCache(friendUserId) {
  if (friendUserId == null || friendUserId === '') {
    cache.clear();
    return;
  }
  cache.delete(String(friendUserId));
}
