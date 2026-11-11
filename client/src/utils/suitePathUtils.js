/** Suite-based routing — Company + Projects (Collaborate deprecated → redirect). */

export const SUITE = {
  COMMUNICATE: 'COMMUNICATE',
  COMPANY: 'COMPANY',
  PROJECTS: 'PROJECTS',
  ME: 'ME',
  /** Suite Quản trị — cấu hình org theo grant (không phải system admin). */
  MANAGE: 'MANAGE',
  /** Admin hạ tầng — chỉ systemRole=admin. */
  ADMIN: 'ADMIN',
  /** @deprecated Use COMPANY — kept for stored localStorage / legacy callers */
  COLLABORATE: 'COLLABORATE',
};

export const SUITE_STORAGE_KEY = 'atrium:current-suite';
export const LAST_ORG_ID_KEY = 'atrium:last-organization-id';

/** Canonical shell prefix — empty (legacy `/app` stripped via redirect + normalize). */
export const APP_SHELL_PREFIX = '';

const LEGACY_APP_SHELL_PREFIX = '/app';

/**
 * Build absolute suite path from a segment path (must start with `/` or be empty).
 * @param {string} segmentPath e.g. `/projects`, `/company/home`
 */
export function appPath(segmentPath = '/') {
  const raw = String(segmentPath || '/').trim() || '/';
  const normalized = raw.startsWith('/') ? raw : `/${raw}`;
  if (!APP_SHELL_PREFIX) return normalized === '' ? '/' : normalized;
  if (normalized === '/') return APP_SHELL_PREFIX || '/';
  return `${APP_SHELL_PREFIX}${normalized}`;
}

/** Strip legacy `/app` prefix for comparisons / redirects (idempotent). */
export function stripLegacyAppPrefix(pathname = '') {
  const path = String(pathname || '');
  if (path === LEGACY_APP_SHELL_PREFIX || path === `${LEGACY_APP_SHELL_PREFIX}/`) {
    return '/';
  }
  if (path.startsWith(`${LEGACY_APP_SHELL_PREFIX}/`)) {
    return path.slice(LEGACY_APP_SHELL_PREFIX.length) || '/';
  }
  return path;
}

const SUITE_SEGMENT = {
  [SUITE.COMMUNICATE]: 'communicate',
  [SUITE.COMPANY]: 'company',
  [SUITE.PROJECTS]: 'projects',
  [SUITE.ME]: 'me',
  [SUITE.MANAGE]: 'manage',
  [SUITE.ADMIN]: 'admin',
  [SUITE.COLLABORATE]: 'collaborate',
};

const SEGMENT_TO_SUITE = {
  communicate: SUITE.COMMUNICATE,
  company: SUITE.COMPANY,
  projects: SUITE.PROJECTS,
  me: SUITE.ME,
  manage: SUITE.MANAGE,
  admin: SUITE.ADMIN,
  /** Legacy URL segment maps to COMPANY for storage/navigation */
  collaborate: SUITE.COMPANY,
};

export const SUITE_DEFAULT_PATH = {
  [SUITE.COMMUNICATE]: appPath('/communicate/overview'),
  [SUITE.COMPANY]: appPath('/company/home'),
  [SUITE.PROJECTS]: appPath('/projects'),
  [SUITE.ME]: appPath('/me/dashboard'),
  [SUITE.MANAGE]: appPath('/manage'),
  [SUITE.ADMIN]: appPath('/admin'),
  [SUITE.COLLABORATE]: appPath('/company/home'),
};

export function normalizeSuite(value) {
  const raw = String(value || '').trim().toUpperCase();
  if (raw === 'COLLABORATE') return SUITE.COMPANY;
  // Suite Cá nhân đã ẩn — hồ sơ/tổng quan mở qua avatar, chrome = Communicate.
  if (raw === 'ME') return SUITE.COMMUNICATE;
  if (Object.values(SUITE).includes(raw) && raw !== 'COLLABORATE' && raw !== 'ME') return raw;
  const fromSegment = SEGMENT_TO_SUITE[String(value || '').trim().toLowerCase()];
  if (fromSegment === SUITE.ME) return SUITE.COMMUNICATE;
  return fromSegment || SUITE.COMMUNICATE;
}

export function suiteToSegment(suite) {
  const normalized = normalizeSuite(suite);
  return SUITE_SEGMENT[normalized] || 'communicate';
}

export function readStoredSuite() {
  if (typeof window === 'undefined') return SUITE.COMMUNICATE;
  return normalizeSuite(window.localStorage.getItem(SUITE_STORAGE_KEY));
}

export function writeStoredSuite(suite) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SUITE_STORAGE_KEY, normalizeSuite(suite));
}

export function readStoredLastOrganizationId() {
  if (typeof window === 'undefined') return '';
  return String(window.localStorage.getItem(LAST_ORG_ID_KEY) || '').trim();
}

export function writeStoredLastOrganizationId(orgId) {
  if (typeof window === 'undefined') return;
  const id = String(orgId || '').trim();
  if (id) window.localStorage.setItem(LAST_ORG_ID_KEY, id);
  else window.localStorage.removeItem(LAST_ORG_ID_KEY);
}

export function suiteBasePath(suite) {
  return appPath(`/${suiteToSegment(suite)}`);
}

export function getDefaultPathForSuite(suite) {
  const normalized = normalizeSuite(suite);
  return SUITE_DEFAULT_PATH[normalized] || SUITE_DEFAULT_PATH[SUITE.COMMUNICATE];
}

export function detectSuiteFromPath(pathname) {
  const path = stripLegacyAppPrefix(String(pathname || ''));
  if (path.startsWith('/manage')) return SUITE.MANAGE;
  if (path.startsWith('/admin')) return SUITE.ADMIN;
  if (path.startsWith('/communicate')) return SUITE.COMMUNICATE;
  if (path.startsWith('/company')) return SUITE.COMPANY;
  if (path.startsWith('/projects')) return SUITE.PROJECTS;
  if (path.startsWith('/collaborate')) return SUITE.COMPANY;
  if (path.startsWith('/me')) return SUITE.COMMUNICATE;
  return null;
}

/** Inline map — avoid importing adminDomainsConfig (heavy / no .js extension for node --test). */
const LEGACY_ADMIN_TAB_TO_PATH = {
  overview: appPath('/admin'),
  people: appPath('/admin/users'),
  approvals: appPath('/admin/users'),
  general: appPath('/admin/system-config'),
  structure: `${appPath('/admin/system-config')}?tab=structure`,
  roles: appPath('/admin/rbac/roles'),
  policy: appPath('/admin/system-config/policy'),
  join: appPath('/admin/users'),
  security: appPath('/admin/security'),
};

import { normalizeProjectModule } from './suiteNavConfig.js';
import { buildAiHitlPath } from './aiHitlPath.js';

/** Map legacy ?tab= trên /collaborate/admin (hoặc /app/collaborate/admin) sang route admin mới. */
export function mapLegacyAdminTabToPath(tab) {
  const raw = String(tab || 'overview').trim().toLowerCase();
  return LEGACY_ADMIN_TAB_TO_PATH[raw] || LEGACY_ADMIN_TAB_TO_PATH.overview;
}

/** Suite paths — org resolved client-side (single-company); do not write organizationId to URL. */
export function buildCommunicateChannelsPath(orgId = '', query = {}) {
  void orgId;
  const base = appPath('/communicate/channels');
  const params = new URLSearchParams();
  const deptId = String(query?.departmentId || '').trim();
  const channelId = String(query?.channelId || '').trim();
  if (deptId) params.set('departmentId', deptId);
  if (channelId) params.set('channelId', channelId);
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

export function isProjectChatTabEnabled() {
  const raw = String(import.meta.env.VITE_PROJECT_CHAT_TAB ?? 'true').toLowerCase();
  return raw !== '0' && raw !== 'false' && raw !== 'off' && raw !== 'no';
}

/** Append non-org query only (orgId kept for call-site compat; unused on URL). */
function appendOrgQuery(base, orgId = '', extra = {}) {
  void orgId;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(extra || {})) {
    if (key === 'organizationId' || key === 'orgId' || key === 'from') continue;
    const v = String(value || '').trim();
    if (v) params.set(key, v);
  }
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

/* ——— Company suite ——— */

export function buildCompanyOverviewPath(orgId = '') {
  return appendOrgQuery(appPath('/company/overview'), orgId);
}

export function buildCompanyHomePath({
  organizationId = '',
  departmentId = '',
  teamId = '',
} = {}) {
  return appendOrgQuery(appPath('/company/home'), organizationId, {
    departmentId,
    teamId,
  });
}

export function buildCompanyWorkspacePath({
  organizationId = '',
  departmentId = '',
  teamId = '',
  tab = '',
  channelId = '',
} = {}) {
  void organizationId;
  const base = appPath('/company/workspaces');
  const params = new URLSearchParams();
  const deptId = String(departmentId || '').trim();
  const tid = String(teamId || '').trim();
  const tabId = String(tab || '').trim().toLowerCase();
  const chId = String(channelId || '').trim();
  if (deptId) params.set('departmentId', deptId);
  if (tid) params.set('teamId', tid);
  if (tabId) params.set('tab', tabId);
  if (chId) params.set('channelId', chId);
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

export function buildCompanyChatPath(orgId = '', query = {}) {
  return appendOrgQuery(appPath('/company/chat'), orgId, {
    departmentId: query?.departmentId,
    teamId: query?.teamId,
    channelId: query?.channelId,
    tab: query?.tab,
  });
}

/** True when pathname is the company suite chat module (not /workspaces). */
export function isCompanyChatModulePath(pathname = '') {
  const p = stripLegacyAppPrefix(String(pathname || '').split('?')[0]).replace(/\/+$/, '') || '';
  return p === appPath('/company/chat');
}

/** True when pathname is the company suite documents module. */
export function isCompanyDocumentsModulePath(pathname = '') {
  const p = stripLegacyAppPrefix(String(pathname || '').split('?')[0]).replace(/\/+$/, '') || '';
  return p === appPath('/company/documents');
}

export function isImmersiveCompanyModulePath(pathname = '') {
  return isCompanyChatModulePath(pathname) || isCompanyDocumentsModulePath(pathname);
}

export function buildCompanyDocumentsPath(orgId = '', query = {}) {
  // Pathname /company/documents already implies documents — omit redundant tab.
  return appendOrgQuery(appPath('/company/documents'), orgId, {
    departmentId: query?.departmentId,
    teamId: query?.teamId,
    tab: query?.tab && query.tab !== 'documents' ? query.tab : '',
  });
}

export function buildCompanyCalendarPath(orgId = '', query = {}) {
  // Pathname /company/calendar already implies calendar — omit redundant tab.
  return appendOrgQuery(appPath('/company/calendar'), orgId, {
    departmentId: query?.departmentId,
    tab: query?.tab && query.tab !== 'calendar' ? query.tab : '',
  });
}

export function buildCompanyApprovalsPath(orgId = '') {
  return appendOrgQuery(appPath('/company/approvals'), orgId);
}

export function buildCompanyOrgNotificationsPath(orgId = '') {
  return appendOrgQuery(appPath('/company/notifications'), orgId);
}

export function buildCompanySettingsPath(orgId) {
  const id = String(orgId || '').trim();
  return id
    ? appPath(`/company/organizations/${encodeURIComponent(id)}/settings`)
    : appPath('/company/workspaces');
}

/* ——— Projects suite ——— */

export function buildProjectsPickerPath(orgId = '') {
  return appendOrgQuery(appPath('/projects'), orgId);
}

export function buildProjectsModulePath(projectId, module = 'overview', query = {}) {
  const pid = String(projectId || '').trim();
  if (!pid) return buildProjectsPickerPath(query?.organizationId || query?.orgId || '');
  let mod = String(module || 'overview').trim();
  if (mod === 'ai-hitl' || mod.startsWith('ai-hitl/')) {
    return buildAiHitlPath(pid, {
      tab: mod.includes('review') || query?.tab === 'review' ? 'review' : 'monitor',
      boardId: query?.boardId,
      packId: query?.packId,
      startWhat: query?.startWhat,
      defaultBoardId: query?.defaultBoardId,
      linkedPackId: query?.linkedPackId,
      packCount: query?.packCount,
    });
  }
  if (mod.startsWith('planning-')) {
    mod = `planning/${mod.replace(/^planning-/, '')}`;
  } else if (!mod.includes('/')) {
    mod = normalizeProjectModule(mod);
  }
  const base = appPath(`/projects/${encodeURIComponent(pid)}/${mod}`);
  const params = new URLSearchParams();
  // organizationId is resolved client-side from project payload / storage — do not write to module URLs.
  const boardId = String(query?.boardId || '').trim();
  const defaultBoardId = String(query?.defaultBoardId || '').trim();
  const channelId = String(query?.channelId || '').trim();
  const packId = String(query?.packId || '').trim();
  const startWhat = String(query?.startWhat || '').trim();
  if (boardId && (!defaultBoardId || boardId !== defaultBoardId)) params.set('boardId', boardId);
  if (channelId) params.set('channelId', channelId);
  if (packId) params.set('packId', packId);
  if (startWhat) params.set('startWhat', startWhat);
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

export function buildProjectsNewPath(orgId = '', query = {}) {
  void orgId;
  const base = appPath('/projects/new');
  const params = new URLSearchParams();
  const title = String(query?.title || '').trim();
  const description = String(query?.description || '').trim();
  const projectCode = String(query?.projectCode || '').trim();
  const briefId = String(query?.briefId || '').trim();
  const analysisMode = String(query?.analysisMode || '').trim().toLowerCase();
  if (title) params.set('title', title);
  if (description) params.set('description', description);
  if (projectCode) params.set('projectCode', projectCode);
  if (briefId) params.set('briefId', briefId);
  if (analysisMode === 'ai' || analysisMode === 'manual') {
    params.set('analysisMode', analysisMode);
  }
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

export function buildProjectsNewAiPath(orgId = '', query = {}) {
  void orgId;
  const base = appPath('/projects/new-ai');
  const params = new URLSearchParams();
  const projectId = String(query?.projectId || '').trim();
  if (projectId) params.set('projectId', projectId);
  const packId = String(query?.packId || '').trim();
  if (packId) params.set('packId', packId);
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

/**
 * AI HITL Phase 0 workspace (in Projects suite shell).
 * /projects/:projectId/ai-hitl[/review]?packId=&startWhat=1
 */
export function buildProjectsAiHitlPath(projectId, query = {}) {
  const pid = String(projectId || '').trim();
  if (!pid) return buildProjectsPickerPath(query?.organizationId || query?.orgId || '');
  return buildAiHitlPath(pid, query);
}

/* ——— Legacy Collaborate builders → new suite paths (compat) ——— */

export function buildCollaborateProjectsChatPath(orgId = '', query = {}) {
  const projectId = String(query?.projectId || '').trim();
  if (projectId) {
    return buildProjectsModulePath(projectId, 'chat', {
      organizationId: orgId || query?.organizationId,
      channelId: query?.channelId,
    });
  }
  return buildProjectsPickerPath(orgId || query?.organizationId);
}

export function buildCollaborateProjectsPath(orgId = '', query = {}) {
  const projectId = String(query?.projectId || '').trim();
  if (projectId) {
    return buildProjectsModulePath(projectId, 'overview', {
      organizationId: orgId || query?.organizationId,
      boardId: query?.boardId,
    });
  }
  return buildProjectsPickerPath(orgId || query?.organizationId);
}

export function buildCollaborateProjectHubPath(projectId, query = {}) {
  const module = query?.module || query?.tab || 'overview';
  return buildProjectsModulePath(projectId, module, {
    ...query,
    defaultBoardId: query?.defaultBoardId,
  });
}

export function buildCollaborateTasksPath(orgId = '', query = {}) {
  return buildCollaborateProjectsPath(orgId, query);
}

export function buildCollaborateDocumentsPath(orgId = '') {
  return buildCompanyDocumentsPath(orgId);
}

export function buildCollaborateCalendarPath(orgId = '') {
  return buildCompanyCalendarPath(orgId);
}

export function buildCollaborateWorkspacePath(opts = {}) {
  return buildCompanyWorkspacePath(opts);
}

/** @deprecated Collaborate Requirements page removed — redirects to project picker. */
export function buildCollaborateRequirementsPath(orgId = '', _query = {}) {
  return buildProjectsPickerPath(orgId);
}

export function buildCollaborateOrgNotificationsPath(orgId = '') {
  return buildCompanyOrgNotificationsPath(orgId);
}

export function buildCollaborateSettingsPath(orgId) {
  return buildCompanySettingsPath(orgId);
}

export function buildCollaborateProjectsNewPath(orgId = '', query = {}) {
  return buildProjectsNewPath(orgId, query);
}

export function buildCollaborateProjectsNewAiPath(orgId = '', query = {}) {
  return buildProjectsNewAiPath(orgId, query);
}

export function orgQueryFromSearch(search) {
  const params = new URLSearchParams(typeof search === 'string' ? search : search || '');
  return String(params.get('organizationId') || params.get('orgId') || '').trim();
}

/** Extract organizationId from GET project hub payload. */
export function organizationIdFromProjectRow(projectRow) {
  if (!projectRow || typeof projectRow !== 'object') return '';
  return String(
    projectRow.organizationId ||
      projectRow.organization?._id ||
      projectRow.organization?.id ||
      projectRow.organization ||
      ''
  ).trim();
}

/**
 * Resolve org for project module routes (URL may omit organizationId).
 * Prefer legacy query, then project payload (avoids stale storage wrong-org), then storage / workspace.
 */
export function resolveProjectOrganizationId({
  search,
  projectRow,
  workspaceOrgId = '',
} = {}) {
  const fromQuery = orgQueryFromSearch(search);
  if (fromQuery) return fromQuery;
  const fromProject = organizationIdFromProjectRow(projectRow);
  if (fromProject) return fromProject;
  const fromStorage = readStoredLastOrganizationId();
  if (fromStorage) return fromStorage;
  return String(workspaceOrgId || '').trim();
}

export function departmentQueryFromSearch(search) {
  const params = new URLSearchParams(typeof search === 'string' ? search : search || '');
  return String(params.get('departmentId') || '').trim();
}

export function teamQueryFromSearch(search) {
  const params = new URLSearchParams(typeof search === 'string' ? search : search || '');
  return String(params.get('teamId') || '').trim();
}

export function boardQueryFromSearch(search) {
  const params = new URLSearchParams(typeof search === 'string' ? search : search || '');
  return String(params.get('boardId') || '').trim();
}

export function projectQueryFromSearch(search) {
  const params = new URLSearchParams(typeof search === 'string' ? search : search || '');
  return String(params.get('projectId') || '').trim();
}

export function channelQueryFromSearch(search) {
  const params = new URLSearchParams(typeof search === 'string' ? search : search || '');
  return String(params.get('channelId') || '').trim();
}

/** Tab module phòng trên workspaces?tab= */
export function workspaceTabQueryFromSearch(search) {
  const params = new URLSearchParams(typeof search === 'string' ? search : search || '');
  return String(params.get('tab') || '').trim().toLowerCase();
}

/** Legacy /w/:slug/:tab → suite route */
export function legacyWorkspaceTabToSuitePath(tab, orgId = '') {
  const t = String(tab || 'chat').trim().toLowerCase();
  const id = String(orgId || '').trim();
  if (t === 'tasks') return buildCollaborateTasksPath(id);
  if (t === 'documents') return buildCompanyDocumentsPath(id);
  if (t === 'notifications') return buildCompanyOrgNotificationsPath(id);
  return buildCommunicateChannelsPath(id);
}

export function parseLegacyWorkspacePath(pathname) {
  const match = String(pathname || '')
    .replace(/\/+/g, '/')
    .match(/^\/w\/([^/]+)(?:\/([^/?]+))?\/?$/);
  if (!match) return null;
  let slug = '';
  try {
    slug = decodeURIComponent(match[1]);
  } catch {
    slug = String(match[1] || '');
  }
  const tab = String(match[2] || 'chat').trim().toLowerCase() || 'chat';
  return { slug, tab };
}

/**
 * Map legacy /collaborate/* (or /app/collaborate/*) pathname + search → new suite path.
 */
export function mapCollaboratePathToDualSuite(pathname, search = '') {
  const path = stripLegacyAppPrefix(String(pathname || '').replace(/\/+/g, '/'));
  const params = new URLSearchParams(
    typeof search === 'string' ? search.replace(/^\?/, '') : ''
  );
  const orgId = String(params.get('organizationId') || params.get('orgId') || '').trim();
  const qs = () => {
    const next = new URLSearchParams(params);
    next.delete('organizationId');
    next.delete('orgId');
    next.delete('from');
    const s = next.toString();
    return s ? `?${s}` : '';
  };

  if (path === '/collaborate' || path === '/collaborate/') {
    return `${appPath('/company/home')}${qs()}`;
  }
  if (path.startsWith('/collaborate/overview')) {
    return `${appPath('/company/overview')}${qs()}`;
  }
  if (path.startsWith('/collaborate/workspaces')) {
    return `${appPath('/company/workspaces')}${qs()}`;
  }
  if (path.startsWith('/collaborate/documents')) {
    return `${appPath('/company/documents')}${qs()}`;
  }
  if (path.startsWith('/collaborate/calendar')) {
    return `${appPath('/company/calendar')}${qs()}`;
  }
  if (path.startsWith('/collaborate/approvals')) {
    return `${appPath('/company/approvals')}${qs()}`;
  }
  if (path.startsWith('/collaborate/notifications')) {
    return `${appPath('/company/notifications')}${qs()}`;
  }
  if (path.startsWith('/collaborate/join/')) {
    return path.replace('/collaborate/join/', `${appPath('/company/join/')}`) + qs();
  }
  if (path.startsWith('/collaborate/organizations/')) {
    return (
      path.replace('/collaborate/organizations/', `${appPath('/company/organizations/')}`) + qs()
    );
  }
  if (path.startsWith('/collaborate/admin')) {
    return mapLegacyAdminTabToPath(params.get('tab'));
  }
  if (path.startsWith('/collaborate/projects/new-ai')) {
    return `${appPath('/projects/new-ai')}${qs()}`;
  }
  if (path.startsWith('/collaborate/projects/new')) {
    return `${appPath('/projects/new')}${qs()}`;
  }
  if (path.startsWith('/collaborate/projects/chat')) {
    const projectId = String(params.get('projectId') || '').trim();
    if (projectId) {
      return buildProjectsModulePath(projectId, 'chat', { organizationId: orgId });
    }
    return buildProjectsPickerPath(orgId);
  }
  const hubMatch = path.match(/^\/collaborate\/projects\/([^/]+)\/?$/);
  if (hubMatch) {
    const projectId = decodeURIComponent(hubMatch[1]);
    const tab = String(params.get('tab') || 'overview').trim();
    const boardId = String(params.get('boardId') || '').trim();
    return buildProjectsModulePath(projectId, tab, { organizationId: orgId, boardId });
  }
  if (path.startsWith('/collaborate/projects') || path.startsWith('/collaborate/tasks')) {
    return buildProjectsPickerPath(orgId);
  }
  if (path.startsWith('/collaborate/requirements')) {
    return buildProjectsPickerPath(orgId);
  }
  return `${appPath('/company/home')}${qs()}`;
}
