/**
 * Dashboard snapshot fan-out (S2S) — ghi RM.
 * mode=lite: chỉ org + unread (cold TTFB ngắn).
 * mode=full: + meetings + tasks view=dashboard.
 */

const axios = require('axios');
const { logger } = require('@enterprise/shared');
const { saveSnapshot } = require('./dashboardReadModel.redis');
const { mergeOrgDashboardStats } = require('./dashboardSummary.merge');

const TIMEOUT_MS = Math.min(
  8000,
  Math.max(2000, Number(process.env.DASHBOARD_SNAPSHOT_TIMEOUT_MS || 6000) || 6000)
);

const LITE_TIMEOUT_MS = Math.min(3000, Math.max(800, Number(process.env.DASHBOARD_LITE_TIMEOUT_MS || 2000) || 2000));

function internalHeaders(userId) {
  const token = String(process.env.GATEWAY_INTERNAL_TOKEN || '').trim();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['x-gateway-internal-token'] = token;
  if (userId) headers['x-user-id'] = String(userId);
  return headers;
}

function unwrap(body) {
  if (body == null) return null;
  if (body.data !== undefined) return body.data;
  return body;
}

async function getJson(url, headers, label, timeoutMs = TIMEOUT_MS) {
  try {
    const res = await axios.get(url, {
      headers,
      timeout: timeoutMs,
      validateStatus: () => true,
    });
    if (res.status < 200 || res.status >= 300) {
      logger.warn('[dashboardSnapshot]', label, res.status);
      return { ok: false };
    }
    return { ok: true, data: unwrap(res.data) };
  } catch (e) {
    logger.warn('[dashboardSnapshot]', label, e.message);
    return { ok: false };
  }
}

function unwrapOrgList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.organizations)) return data.organizations;
  return [];
}

function sumOrgMembers(organizations) {
  return (Array.isArray(organizations) ? organizations : []).reduce((sum, org) => {
    const direct =
      org?.memberCount ?? org?.membersCount ?? org?.totalMembers ?? org?.stats?.memberCount;
    if (Number.isFinite(Number(direct))) return sum + Number(direct);
    if (Array.isArray(org?.members)) return sum + org.members.length;
    return sum;
  }, 0);
}

function pickMembershipRole(organizations, statsRole) {
  if (statsRole) return String(statsRole);
  const first = Array.isArray(organizations) ? organizations[0] : null;
  const role = first?.myRole || first?.role || first?.membershipRole;
  return role ? String(role) : null;
}

function pickStructureRole(organizations) {
  const first = Array.isArray(organizations) ? organizations[0] : null;
  const raw = first?.myStructureRole || first?.structureRole || null;
  const v = String(raw || '').trim().toLowerCase();
  return v === 'head' || v === 'leader' ? v : null;
}

function dashboardStatsMaxOrgs() {
  const n = parseInt(process.env.DASHBOARD_STATS_MAX_ORGS || '1', 10);
  return Math.min(8, Math.max(1, Number.isFinite(n) ? n : 1));
}

async function fetchDashboardTaskStats(orgIds, headers, taskBase) {
  if (!taskBase || !orgIds.length) {
    return mergeOrgDashboardStats([]);
  }
  const capped = orgIds.slice(0, dashboardStatsMaxOrgs());
  const perOrg = [];
  await Promise.all(
    capped.map(async (oid) => {
      const url = `${taskBase}/api/tasks/statistics?organizationId=${encodeURIComponent(oid)}&view=dashboard`;
      const res = await getJson(url, headers, `tasks/${oid}`);
      if (!res.ok || !res.data || typeof res.data !== 'object') return;
      perOrg.push({ ...res.data, organizationId: oid });
    })
  );
  return mergeOrgDashboardStats(perOrg);
}

/**
 * @param {string} userId
 * @param {string} [eventId]
 * @param {{ mode?: 'lite'|'full' }} [opts]
 */
async function refreshDashboardSnapshot(userId, eventId, opts = {}) {
  const uid = String(userId || '').trim();
  if (!uid) return { ok: false, reason: 'missing_user' };
  const mode = String(opts.mode || 'full').toLowerCase() === 'lite' ? 'lite' : 'full';
  const t0 = Date.now();

  const headers = internalHeaders(uid);
  const orgBase = String(process.env.ORGANIZATION_SERVICE_URL || '')
    .trim()
    .replace(/\/+$/, '');
  const notifBase = String(process.env.NOTIFICATION_SERVICE_URL || '')
    .trim()
    .replace(/\/+$/, '');
  const voiceBase = String(process.env.VOICE_SERVICE_URL || '')
    .trim()
    .replace(/\/+$/, '');
  const taskBase = String(process.env.PROJECT_SERVICE_URL || '')
    .trim()
    .replace(/\/+$/, '');

  const httpTimeout = mode === 'lite' ? LITE_TIMEOUT_MS : TIMEOUT_MS;

  const [orgRes, notifRes] = await Promise.all([
    orgBase
      ? getJson(`${orgBase}/api/organizations/my`, headers, 'orgs', httpTimeout)
      : Promise.resolve({ ok: false }),
    notifBase
      ? getJson(
          `${notifBase}/api/notifications?scope=personal&limit=1`,
          headers,
          'notif',
          httpTimeout
        )
      : Promise.resolve({ ok: false }),
  ]);

  const orgList = orgRes.ok ? unwrapOrgList(orgRes.data) : [];
  const orgIds = orgList
    .map((o) => String(o?._id || o?.id || '').trim())
    .filter((id) => /^[a-f\d]{24}$/i.test(id));

  let unread = 0;
  if (notifRes.ok) unread = Number(notifRes.data?.unreadCount) || 0;

  const membershipRole = pickMembershipRole(orgList, null);
  const structureRole = pickStructureRole(orgList);
  const totalMembers = sumOrgMembers(orgList);

  if (mode === 'lite') {
    const patch = {
      orgCount: orgList.length,
      friendsTotal: null,
      pendingCount: 0,
      unread,
      taskDone: null,
      openCount: 0,
      overdue: 0,
      dueThisWeek: 0,
      myOpen: 0,
      myOverdue: 0,
      myDueThisWeek: 0,
      boards: [],
      overdueItems: [],
      membershipRole,
      structureRole,
      primaryOrgId: orgIds[0] || null,
      totalMembers: Number.isFinite(totalMembers) ? totalMembers : null,
      upcomingMeetings: [],
      refreshPending: true,
      partial: {
        organizations: !orgRes.ok,
        friends: true,
        pending: false,
        notifications: !notifRes.ok,
        meetings: true,
        tasks: true,
      },
      asOf: new Date().toISOString(),
    };
    await saveSnapshot(uid, patch, eventId);
    logger.info('[dashboardSnapshot] lite_ms', Date.now() - t0, { userId: uid });
    return { ok: true, patch, mode: 'lite' };
  }

  const startFrom = new Date();
  const startTo = new Date(startFrom.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [meetingsRes, taskBundle] = await Promise.all([
    voiceBase
      ? getJson(
          `${voiceBase}/api/meetings?startFrom=${encodeURIComponent(startFrom.toISOString())}&startTo=${encodeURIComponent(startTo.toISOString())}&limit=8`,
          headers,
          'meetings'
        )
      : Promise.resolve({ ok: false }),
    fetchDashboardTaskStats(orgIds, headers, taskBase),
  ]);

  const membershipFromTasks = pickMembershipRole(orgList, taskBundle.membershipRole);

  let upcomingMeetings = [];
  if (meetingsRes.ok) {
    const meetings = meetingsRes.data?.meetings ?? meetingsRes.data?.data?.meetings;
    if (Array.isArray(meetings)) {
      upcomingMeetings = meetings.slice(0, 5).map((m) => ({
        id: m._id,
        title: m.title,
        startTime: m.startTime,
        participants: Array.isArray(m.participants) ? m.participants.length : 0,
      }));
    }
  }

  const patch = {
    orgCount: orgList.length,
    friendsTotal: null,
    pendingCount: 0,
    unread,
    taskDone: taskBundle.failed ? null : taskBundle.taskDone,
    openCount: taskBundle.openCount,
    overdue: taskBundle.overdue,
    dueThisWeek: taskBundle.dueThisWeek,
    myOpen: taskBundle.myOpen,
    myOverdue: taskBundle.myOverdue,
    myDueThisWeek: taskBundle.myDueThisWeek,
    boards: taskBundle.boards,
    overdueItems: Array.isArray(taskBundle.overdueItems) ? taskBundle.overdueItems : [],
    membershipRole: membershipFromTasks,
    structureRole,
    primaryOrgId: orgIds[0] || null,
    totalMembers: Number.isFinite(totalMembers) ? totalMembers : null,
    upcomingMeetings,
    refreshPending: false,
    partial: {
      organizations: !orgRes.ok,
      friends: true,
      pending: false,
      notifications: !notifRes.ok,
      meetings: !meetingsRes.ok,
      tasks: taskBundle.failed,
    },
    asOf: new Date().toISOString(),
  };

  await saveSnapshot(uid, patch, eventId);
  logger.info('[dashboardSnapshot] full_ms', Date.now() - t0, {
    userId: uid,
    orgCount: patch.orgCount,
    tasksPartial: patch.partial.tasks,
  });
  return { ok: true, patch, mode: 'full' };
}

module.exports = {
  refreshDashboardSnapshot,
};
