import {
  buildCompanyCalendarPath,
  buildCompanyChatPath,
  buildCompanyDocumentsPath,
  buildCompanyOrgNotificationsPath,
  buildCompanyWorkspacePath,
  isCompanyChatModulePath,
} from './suitePathUtils';

/** @typedef {'chat' | 'voice' | 'announcement' | 'documents' | 'calendar' | 'tasks' | 'members' | 'meetings' | 'notifications'} CompanyModule */

/**
 * Company in-suite navigation — preserves departmentId / teamId on URL (not Communicate / Projects builders).
 * @param {object} opts
 * @param {string} [opts.orgId]
 * @param {string} [opts.departmentId]
 * @param {string} [opts.teamId]
 * @param {CompanyModule} [opts.module]
 * @param {string} [opts.channelId]
 * @param {string} [opts.tab] — override workspace/chat tab
 * @param {string} [opts.pathname] — current route; chat-like modules use /company/chat when already there
 * @param {string} [opts.boardId] — tasks tab deep link
 * @param {string} [opts.messageId] — documents message anchor
 * @param {boolean} [opts.documentsInWorkspace] — dept hub: stay on /workspaces?tab=documents
 */
export function buildCompanyModulePath({
  orgId = '',
  departmentId = '',
  teamId = '',
  module = 'chat',
  channelId = '',
  tab = '',
  pathname = '',
  boardId = '',
  messageId = '',
  documentsInWorkspace = false,
} = {}) {
  const mod = String(module || 'chat').trim().toLowerCase();
  const deptId = String(departmentId || '').trim();
  const tid = String(teamId || '').trim();
  const chId = String(channelId || '').trim();
  const tabOverride = String(tab || '').trim().toLowerCase();

  if (mod === 'notifications') {
    return buildCompanyOrgNotificationsPath(orgId);
  }

  if (mod === 'documents') {
    if (documentsInWorkspace) {
      return buildCompanyWorkspacePath({
        organizationId: orgId,
        departmentId: deptId,
        teamId: tid,
        tab: 'documents',
        channelId: chId,
      });
    }
    const base = buildCompanyDocumentsPath(orgId, {
      departmentId: deptId,
      teamId: tid,
      tab: 'documents',
    });
    return appendDocumentExtras(base, { channelId: chId, messageId });
  }

  if (mod === 'calendar') {
    return buildCompanyCalendarPath(orgId, {
      departmentId: deptId,
      tab: 'calendar',
    });
  }

  if (mod === 'tasks') {
    return appendBoardId(
      buildCompanyWorkspacePath({
        organizationId: orgId,
        departmentId: deptId,
        teamId: tid,
        tab: 'tasks',
      }),
      boardId
    );
  }

  const workspaceTabs = new Set(['members', 'meetings']);
  if (workspaceTabs.has(mod)) {
    return buildCompanyWorkspacePath({
      organizationId: orgId,
      departmentId: deptId,
      teamId: tid,
      tab: mod,
      channelId: chId,
    });
  }

  const chatTab =
    tabOverride ||
    (mod === 'voice' || mod === 'announcement'
      ? 'announcement'
      : mod === 'chat'
        ? tid
          ? 'chat'
          : 'announcement'
        : mod);

  const onCompanyChat = isCompanyChatModulePath(pathname);
  const chatLike =
    mod === 'chat' || mod === 'voice' || mod === 'announcement' || chatTab === 'chat' || chatTab === 'announcement';

  if (onCompanyChat && chatLike) {
    return buildCompanyChatPath(orgId, {
      departmentId: deptId,
      teamId: tid,
      tab: chatTab,
      channelId: chId,
    });
  }

  return buildCompanyWorkspacePath({
    organizationId: orgId,
    departmentId: deptId,
    teamId: tid,
    tab: chatTab,
    channelId: chId,
  });
}

/** @deprecated alias — returns path string for `navigate()` */
export function openCompanyModulePath(opts) {
  return buildCompanyModulePath(opts);
}

function appendBoardId(path, boardId) {
  const bid = String(boardId || '').trim();
  if (!bid) return path;
  const [base, qs = ''] = String(path).split('?');
  const params = new URLSearchParams(qs);
  params.set('boardId', bid);
  return `${base}?${params.toString()}`;
}

function appendDocumentExtras(path, { channelId = '', messageId = '' } = {}) {
  const ch = String(channelId || '').trim();
  const msg = String(messageId || '').trim();
  if (!ch && !msg) return path;
  const [base, qs = ''] = String(path).split('?');
  const params = new URLSearchParams(qs);
  if (ch) params.set('channelId', ch);
  if (msg) params.set('messageId', msg);
  const next = params.toString();
  return next ? `${base}?${next}` : base;
}
