const UserProjectMembership = require('../models/UserProjectMembership');

function asId(raw) {
  return String(raw || '').trim();
}

async function listProjectIdsForUser(userId, organizationId) {
  const uid = asId(userId);
  const oid = asId(organizationId);
  if (!uid || !oid) return [];
  const row = await UserProjectMembership.findOne({ userId: uid, organizationId: oid })
    .select('projectIds')
    .lean();
  const cached = Array.isArray(row?.projectIds) ? row.projectIds.map(String).filter(Boolean) : [];
  if (cached.length) return cached;

  // Fallback S2S + backfill — tránh chat trống khi Rabbit MEMBER_CHANGED chưa sync.
  try {
    const { fetchUserProjectIdsInOrg } = require('../clients/projectMembership.client');
    const remote = await fetchUserProjectIdsInOrg(oid, uid);
    if (!remote.length) return [];
    await UserProjectMembership.findOneAndUpdate(
      { userId: uid, organizationId: oid },
      {
        $addToSet: { projectIds: { $each: remote } },
        $set: { updatedAt: new Date() },
        $setOnInsert: { userId: uid, organizationId: oid },
      },
      { upsert: true }
    );
    return remote;
  } catch {
    return [];
  }
}

async function applyMemberChanged({ organizationId, projectId, userId, status }) {
  const oid = asId(organizationId);
  const pid = asId(projectId);
  const uid = asId(userId);
  const st = String(status || '').trim().toLowerCase();
  if (!oid || !pid || !uid) return null;
  if (st !== 'active' && st !== 'inactive') return null;

  const op =
    st === 'active'
      ? { $addToSet: { projectIds: pid }, $set: { updatedAt: new Date() } }
      : { $pull: { projectIds: pid }, $set: { updatedAt: new Date() } };

  return UserProjectMembership.findOneAndUpdate(
    { userId: uid, organizationId: oid },
    { ...op, $setOnInsert: { userId: uid, organizationId: oid } },
    { upsert: true, returnDocument: 'after' }
  ).lean();
}

module.exports = {
  listProjectIdsForUser,
  applyMemberChanged,
};
