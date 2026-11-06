/** Convention Redis org read cache — organization-service ghi, chat-service đọc. */

function orgAclCacheKey(orgId, userId) {
  return `org:${String(orgId)}:acl:${String(userId)}`;
}

function orgStructureSummaryCacheKey(orgId) {
  return `org:${String(orgId)}:structure:summary`;
}

function orgStructureNavCacheKey(orgId) {
  return `org:${String(orgId)}:structure:nav`;
}

function orgAclCachePattern(orgId) {
  return `org:${String(orgId)}:acl:*`;
}

function orgMyProfileCacheKey(orgId, userId) {
  return `org:${String(orgId)}:my-profile:${String(userId)}`;
}

function orgMyProfileCachePattern(orgId) {
  return `org:${String(orgId)}:my-profile:*`;
}

function orgShellVersionCacheKey(orgId) {
  return `org:${String(orgId)}:shell:version`;
}

const DEFAULT_ORG_ACL_CACHE_TTL_SEC = 180;
const DEFAULT_ORG_STRUCTURE_CACHE_TTL_SEC = 600;
const DEFAULT_ORG_MY_PROFILE_CACHE_TTL_SEC = 180;

module.exports = {
  orgAclCacheKey,
  orgStructureSummaryCacheKey,
  orgStructureNavCacheKey,
  orgShellVersionCacheKey,
  orgAclCachePattern,
  orgMyProfileCacheKey,
  orgMyProfileCachePattern,
  DEFAULT_ORG_ACL_CACHE_TTL_SEC,
  DEFAULT_ORG_STRUCTURE_CACHE_TTL_SEC,
  DEFAULT_ORG_MY_PROFILE_CACHE_TTL_SEC,
};
