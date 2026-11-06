/**
 * Canonical frontend suite paths (no `/app` shell prefix).
 * Used by BE actionUrl / invite deep-links — keep in sync with client suitePathUtils / aiHitlPath.
 */

const APP_SHELL_PREFIX = '';

function appPath(segmentPath = '/') {
  const raw = String(segmentPath || '/').trim() || '/';
  const normalized = raw.startsWith('/') ? raw : `/${raw}`;
  if (!APP_SHELL_PREFIX) return normalized === '' ? '/' : normalized;
  if (normalized === '/') return APP_SHELL_PREFIX || '/';
  return `${APP_SHELL_PREFIX}${normalized}`;
}

function appendQuery(base, params = {}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params || {})) {
    if (key === 'organizationId' || key === 'orgId' || key === 'tab') continue;
    const v = String(value || '').trim();
    if (v) search.set(key, v);
  }
  const qs = search.toString();
  return qs ? `${base}?${qs}` : base;
}

/**
 * @param {{ projectId?: string, boardId?: string, organizationId?: string, module?: string, pathSuffix?: string }} opts
 * organizationId is accepted for call-site compat but never written to URL.
 */
function projectHubPath({ projectId, boardId, organizationId, module, pathSuffix } = {}) {
  void organizationId;
  const pid = String(projectId || '').trim();
  if (!pid) return appPath('/projects');
  const suffix = String(pathSuffix || '').trim().replace(/^\/+/, '');
  const mod = String(module || '').trim().replace(/^\/+/, '');
  let base;
  if (suffix) {
    base = appPath(`/projects/${encodeURIComponent(pid)}/${suffix}`);
  } else if (mod) {
    base = appPath(`/projects/${encodeURIComponent(pid)}/${mod}`);
  } else {
    base = appPath(`/projects/${encodeURIComponent(pid)}/overview`);
  }
  if (base.includes('?')) {
    const bid = String(boardId || '').trim();
    if (bid && !/[?&]boardId=/.test(base)) {
      base += `&boardId=${encodeURIComponent(bid)}`;
    }
    // Strip any organizationId that callers embedded in pathSuffix query.
    return base
      .replace(/([?&])organizationId=[^&]*&?/g, '$1')
      .replace(/[?&]$/, '')
      .replace(/\?&/, '?');
  }
  return appendQuery(base, { boardId });
}

/**
 * HITL Review deep-link — path tab, optional packId only.
 * @param {string} projectId
 * @param {{ packId?: string }} [query]
 */
function aiHitlReviewPath(projectId, query = {}) {
  const pid = String(projectId || '').trim();
  if (!pid) return appPath('/projects');
  const base = appPath(`/projects/${encodeURIComponent(pid)}/ai-hitl/review`);
  return appendQuery(base, { packId: query?.packId });
}

/**
 * HITL Monitor (default) deep-link.
 * @param {string} projectId
 * @param {{ packId?: string, startWhat?: string|number }} [query]
 */
function aiHitlMonitorPath(projectId, query = {}) {
  const pid = String(projectId || '').trim();
  if (!pid) return appPath('/projects');
  const base = appPath(`/projects/${encodeURIComponent(pid)}/ai-hitl`);
  const startWhat =
    query?.startWhat === true || query?.startWhat === 1 || query?.startWhat === '1'
      ? '1'
      : query?.startWhat;
  return appendQuery(base, { packId: query?.packId, startWhat });
}

function communicateVoiceJoinPath(roomId) {
  const rid = String(roomId || '').trim();
  if (!rid) return appPath('/communicate/voice');
  return `${appPath(`/communicate/voice/${encodeURIComponent(rid)}`)}?join=1`;
}

function communicateFriendsDmPath(openDmUserId) {
  const uid = String(openDmUserId || '').trim();
  const base = appPath('/communicate/chat/friends');
  if (!uid) return base;
  return `${base}?openDmUserId=${encodeURIComponent(uid)}`;
}

function companyDocumentsPath({ documentId, organizationId } = {}) {
  void organizationId;
  return appendQuery(appPath('/company/documents'), {
    documentId,
  });
}

function companyOrgSettingsPath(orgId, query = {}) {
  const id = String(orgId || '').trim();
  if (!id) return appPath('/company/workspaces');
  return appendQuery(appPath(`/company/organizations/${encodeURIComponent(id)}/settings`), query);
}

function companyWorkspacesPath(query = {}) {
  return appendQuery(appPath('/company/workspaces'), query);
}

function companyChannelPath({ organizationId, channelId } = {}) {
  void organizationId;
  return appendQuery(appPath('/company/chat'), {
    channelId,
  });
}

module.exports = {
  APP_SHELL_PREFIX,
  appPath,
  projectHubPath,
  aiHitlReviewPath,
  aiHitlMonitorPath,
  communicateVoiceJoinPath,
  communicateFriendsDmPath,
  companyDocumentsPath,
  companyOrgSettingsPath,
  companyWorkspacesPath,
  companyChannelPath,
};
