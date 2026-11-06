import {
  buildProjectsModulePath,
  buildProjectsPickerPath,
  mapCollaboratePathToDualSuite,
  stripLegacyAppPrefix,
} from './suitePathUtils.js';
import { normalizeAiHitlActionPath } from './aiHitlPath.js';

/** @typedef {{ actionUrl?: string, data?: Record<string, unknown>, organizationId?: string, projectId?: string }} NotificationLike */

const SUITE_ROOTS = [
  '/communicate',
  '/company',
  '/projects',
  '/admin',
  '/me',
  '/collaborate',
];

function isInAppSuitePath(pathname) {
  const path = stripLegacyAppPrefix(String(pathname || '').replace(/\/+/g, '/'));
  return SUITE_ROOTS.some((root) => path === root || path.startsWith(`${root}/`));
}

/**
 * Normalize legacy in-app paths (collaborate → dual suite, /voice → communicate, strip /app).
 * @param {string} pathname
 * @param {string} [search]
 * @returns {string | null}
 */
export function normalizeLegacyAppPath(pathname, search = '') {
  let path = stripLegacyAppPrefix(String(pathname || '').replace(/\/+/g, '/').trim());
  const qsRaw = typeof search === 'string' ? search.replace(/^\?/, '') : '';
  const qs = qsRaw ? `?${qsRaw}` : '';

  if (path.startsWith('/collaborate')) {
    return mapCollaboratePathToDualSuite(path, qs);
  }

  const voiceMatch = path.match(/^\/voice\/([^/]+)\/?$/);
  if (voiceMatch) {
    return `/communicate/voice/${encodeURIComponent(voiceMatch[1])}${qs}`;
  }

  return `${path}${qs}`;
}

function buildProjectHubPath(projectId, query = {}) {
  const pid = String(projectId || '').trim();
  if (!pid) return buildProjectsPickerPath(query?.organizationId || query?.orgId || '');
  return buildProjectsModulePath(pid, 'overview', {
    organizationId: query?.organizationId || query?.orgId,
    boardId: query?.boardId,
  });
}

export function isVoiceRoomInviteNotification(notif) {
  const kind = String(notif?.data?.kind || '').trim();
  return kind === 'voice_room_invite' || kind === 'voice_invite';
}

/**
 * Đường dẫn in-app tới màn prejoin xin vào phòng (VoiceRoomPage ?join=1).
 * @param {NotificationLike | null | undefined} notif
 * @returns {string | null}
 */
export function resolveVoiceRoomInvitePath(notif) {
  if (!notif) return null;

  const data = notif.data && typeof notif.data === 'object' ? notif.data : {};
  const actionUrl = String(notif.actionUrl || '').trim();

  if (actionUrl) {
    try {
      const parsed = actionUrl.startsWith('http') || actionUrl.startsWith('//')
        ? new URL(actionUrl)
        : new URL(actionUrl, typeof window !== 'undefined' ? window.location.origin : 'https://atrium.dev');
      const normalized = normalizeLegacyAppPath(parsed.pathname, parsed.search || '');
      if (normalized && stripLegacyAppPrefix(normalized.split('?')[0]).startsWith('/communicate/voice')) {
        const [pathOnly, qsRaw] = normalized.split('?');
        const params = new URLSearchParams(qsRaw || '');
        if (!params.has('join')) params.set('join', '1');
        const qs = params.toString();
        return qs ? `${pathOnly}?${qs}` : pathOnly;
      }
    } catch {
      /* fall through */
    }
  }

  const roomId = String(data.roomId || '').trim();
  if (roomId) {
    return `/communicate/voice/${encodeURIComponent(roomId)}?join=1`;
  }

  return null;
}

/**
 * Chỉ nhận path in-app suite (canonical hoặc legacy `/...`). Bỏ URL ngoài / legacy `/tasks/:id`.
 * @param {string} [actionUrl]
 * @returns {string | null}
 */
export function parseSafeAppPath(actionUrl) {
  const raw = String(actionUrl || '').trim();
  if (!raw) return null;
  if (/^[a-zA-Z][a-zA-Z+\-.]*:/.test(raw) || raw.startsWith('//')) return null;
  try {
    const parsed = new URL(raw, 'https://atrium.dev');
    const path = String(parsed.pathname || '').trim();
    if (!isInAppSuitePath(path)) return null;
    const canonicalPath = stripLegacyAppPrefix(path);
    const qs = parsed.search || '';
    return `${canonicalPath}${qs}`;
  } catch {
    const noHash = raw.split('#')[0];
    if (!noHash.startsWith('/')) return null;
    const qIdx = noHash.indexOf('?');
    const pathOnly = qIdx >= 0 ? noHash.slice(0, qIdx) : noHash;
    const qs = qIdx >= 0 ? noHash.slice(qIdx) : '';
    if (!isInAppSuitePath(pathOnly)) return null;
    return `${stripLegacyAppPrefix(pathOnly)}${qs}`;
  }
}

/**
 * Ưu tiên actionUrl suite path, không thì Hub Project theo projectId.
 * @param {NotificationLike | null | undefined} notif
 * @returns {string | null}
 */
export function resolveNotificationAppPath(notif) {
  if (!notif) return null;
  const fromAction = parseSafeAppPath(notif.actionUrl || notif.data?.actionUrl);
  if (fromAction) {
    const qIdx = fromAction.indexOf('?');
    const pathOnly = qIdx >= 0 ? fromAction.slice(0, qIdx) : fromAction;
    const search = qIdx >= 0 ? fromAction.slice(qIdx) : '';
    if (pathOnly.startsWith('/collaborate')) {
      return mapCollaboratePathToDualSuite(pathOnly, search);
    }
    if (/\/ai-hitl/i.test(pathOnly)) {
      return normalizeAiHitlActionPath(fromAction);
    }
    return fromAction;
  }
  const data = notif.data && typeof notif.data === 'object' ? notif.data : {};
  const projectId = String(data.projectId || notif.projectId || '').trim();
  if (!projectId) return null;
  return buildProjectHubPath(projectId, {
    organizationId: data.organizationId || notif.organizationId,
    boardId: data.boardId,
  });
}
