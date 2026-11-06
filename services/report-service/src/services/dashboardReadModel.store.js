/**
 * Pure dashboard RM upsert — unit-testable without Redis.
 * Shape parity với legacy BFF buildDashboardSummary (+ asOf).
 */

const { isUsableDashboardSummary } = require('@enterprise/shared/utils/dashboardReadModelShape');

const MAX_PROCESSED_EVENTS = 64;

function getDashboardRmMaxAgeSec() {
  // Default 120s — FE poll ~90s phải HIT/STALE, không sync-refresh mỗi lần.
  const n = parseInt(process.env.DASHBOARD_RM_MAX_AGE_SEC || '120', 10);
  return Math.min(600, Math.max(15, Number.isFinite(n) ? n : 120));
}

function isDashboardSummaryStale(asOf, now = Date.now(), maxAgeSec = getDashboardRmMaxAgeSec()) {
  if (asOf == null || String(asOf).trim() === '') return true;
  const ts = Date.parse(String(asOf));
  if (!Number.isFinite(ts)) return true;
  return now - ts > maxAgeSec * 1000;
}

function emptyDashboardSummary(userId) {
  return {
    userId: userId ? String(userId) : undefined,
    orgCount: 0,
    friendsTotal: 0,
    pendingCount: 0,
    unread: 0,
    taskDone: 0,
    openCount: 0,
    overdue: 0,
    dueThisWeek: 0,
    myOpen: 0,
    myOverdue: 0,
    myDueThisWeek: 0,
    boards: [],
    overdueItems: [],
    membershipRole: null,
    structureRole: null,
    primaryOrgId: null,
    totalMembers: null,
    upcomingMeetings: [],
    refreshPending: false,
    partial: {
      organizations: false,
      friends: false,
      pending: false,
      notifications: false,
      meetings: false,
      tasks: false,
    },
    asOf: null,
    processedEventIds: [],
  };
}

function cloneSummary(doc) {
  return {
    ...emptyDashboardSummary(doc?.userId),
    ...doc,
    upcomingMeetings: Array.isArray(doc?.upcomingMeetings) ? [...doc.upcomingMeetings] : [],
    boards: Array.isArray(doc?.boards) ? [...doc.boards] : [],
    overdueItems: Array.isArray(doc?.overdueItems) ? [...doc.overdueItems] : [],
    partial: { ...emptyDashboardSummary().partial, ...(doc?.partial || {}) },
    processedEventIds: Array.isArray(doc?.processedEventIds) ? [...doc.processedEventIds] : [],
  };
}

/**
 * @param {object} current
 * @param {{ eventId?: string, userId?: string, patch?: object, asOf?: string }} input
 * @returns {{ next: object, applied: boolean }}
 */
function upsertDashboardSummary(current, input = {}) {
  const eventId = String(input.eventId || '').trim();
  const base = cloneSummary(current);
  if (input.userId) base.userId = String(input.userId);

  if (eventId && base.processedEventIds.includes(eventId)) {
    return { next: base, applied: false };
  }

  const patch = input.patch && typeof input.patch === 'object' ? input.patch : {};
  const next = cloneSummary({ ...base, ...patch, userId: base.userId });
  if (patch.partial && typeof patch.partial === 'object') {
    next.partial = { ...base.partial, ...patch.partial };
  }
  if (Array.isArray(patch.upcomingMeetings)) {
    next.upcomingMeetings = patch.upcomingMeetings.slice(0, 5);
  }
  if (Array.isArray(patch.boards)) {
    next.boards = patch.boards.slice(0, 5);
  }
  if (Array.isArray(patch.overdueItems)) {
    next.overdueItems = patch.overdueItems.slice(0, 8);
  }
  next.asOf = input.asOf || patch.asOf || new Date().toISOString();

  if (eventId) {
    next.processedEventIds = [...base.processedEventIds, eventId].slice(-MAX_PROCESSED_EVENTS);
  }
  return { next, applied: true };
}

function applyTaskFactPatch(current, payload = {}) {
  const next = cloneSummary(current);
  if (payload.taskDone != null && Number.isFinite(Number(payload.taskDone))) {
    next.taskDone = Number(payload.taskDone);
    next.partial = { ...next.partial, tasks: false };
    return next;
  }
  const delta = Number(payload.doneDelta);
  if (Number.isFinite(delta) && delta !== 0) {
    const prev = Number.isFinite(Number(next.taskDone)) ? Number(next.taskDone) : 0;
    next.taskDone = Math.max(0, prev + delta);
    next.partial = { ...next.partial, tasks: false };
  }
  return next;
}

function finiteOrNull(value) {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toPublicDashboardSummary(doc) {
  if (!doc) return null;
  return {
    orgCount: Number(doc.orgCount) || 0,
    friendsTotal: Number(doc.friendsTotal) || 0,
    pendingCount: Number(doc.pendingCount) || 0,
    unread: Number(doc.unread) || 0,
    taskDone: doc.taskDone == null ? null : Number(doc.taskDone),
    openCount: Number(doc.openCount) || 0,
    overdue: Number(doc.overdue) || 0,
    dueThisWeek: Number(doc.dueThisWeek) || 0,
    myOpen: Number(doc.myOpen) || 0,
    myOverdue: Number(doc.myOverdue) || 0,
    myDueThisWeek: Number(doc.myDueThisWeek) || 0,
    boards: Array.isArray(doc.boards) ? doc.boards : [],
    overdueItems: Array.isArray(doc.overdueItems) ? doc.overdueItems : [],
    membershipRole: doc.membershipRole ? String(doc.membershipRole) : null,
    structureRole: doc.structureRole ? String(doc.structureRole) : null,
    primaryOrgId: doc.primaryOrgId ? String(doc.primaryOrgId) : null,
    totalMembers: finiteOrNull(doc.totalMembers),
    upcomingMeetings: Array.isArray(doc.upcomingMeetings) ? doc.upcomingMeetings : [],
    refreshPending: Boolean(doc.refreshPending),
    partial: doc.partial || emptyDashboardSummary().partial,
    asOf: doc.asOf || null,
  };
}

module.exports = {
  emptyDashboardSummary,
  isUsableDashboardSummary,
  isDashboardSummaryStale,
  getDashboardRmMaxAgeSec,
  cloneSummary,
  upsertDashboardSummary,
  applyTaskFactPatch,
  toPublicDashboardSummary,
  MAX_PROCESSED_EVENTS,
};
