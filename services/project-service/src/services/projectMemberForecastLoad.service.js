/**
 * Batch enrich project members with Project Allocation forecastLoad (opt-in view).
 * capacityMode: project_allocation_v1
 */

const mongoose = require('../db');
const Task = require('../models/Task');
const MeetingEvent = require('../models/MeetingEvent');
const { weekKeyFromDate, availableCapacityHours } = require('../engines/allocation/capacity');
const { toDayMs } = require('../utils/staffing/allocationOverlap');
const {
  computeOne,
  scheduledHoursForWeek,
  meetingHoursForWeek,
} = require('../engines/allocation/projectAllocationUtilization');
const { loadCalendarPack } = require('./forecastCapacity.service');

const DAY_MS = 24 * 60 * 60 * 1000;
const WINDOW_WEEKS = 8;

function asOid(id) {
  const s = String(id || '').trim();
  return mongoose.isValidObjectId(s) ? s : '';
}

function memberUserId(row) {
  return String(row?.userId || row?.user?._id || row?.user?.id || row?.id || '').trim();
}

function taskTouchesUser(task, uid) {
  if (String(task.assigneeId || '') === uid) return true;
  const assignees = Array.isArray(task.assignees) ? task.assignees : [];
  return assignees.some((a) => String(a?.userId || '') === uid);
}

function mapTaskRow(t) {
  return {
    effortHours: Number(t.estimateHours) || 0,
    estimateHours: Number(t.estimateHours) || 0,
    startDate: t.startDate,
    dueDate: t.dueDate || t.startDate,
    projectId: t.projectId ? String(t.projectId) : null,
  };
}

function mapMeetingForUser(event, uid) {
  const start = event.startAt ? new Date(event.startAt) : null;
  const end = event.endAt ? new Date(event.endAt) : null;
  const participant = (event.participants || []).find((p) => String(p.userId) === uid);
  let hours = null;
  if (participant?.plannedDurationMinutes != null) {
    hours = Number(participant.plannedDurationMinutes) / 60;
  } else if (start && end) {
    hours = Math.max(0, (end.getTime() - start.getTime()) / 3600000);
  }
  return {
    hours: Number.isFinite(hours) ? hours : 0,
    startAt: start,
    weekKey: start ? weekKeyFromDate(start) : null,
  };
}

/**
 * @param {object} opts
 * @param {string} opts.projectId
 * @param {string} opts.organizationId
 * @param {Array} opts.members
 * @param {string} [opts.weekKey]
 * @returns {Promise<Array>} members with forecastLoad attached
 */
async function enrichMembersWithForecastLoad({
  projectId,
  organizationId,
  members = [],
  weekKey = null,
} = {}) {
  const pid = asOid(projectId);
  const orgId = asOid(organizationId);
  const list = Array.isArray(members) ? members : [];
  if (!pid || !orgId || !list.length) {
    return list.map((m) => ({ ...m, forecastLoad: null }));
  }

  const focusWeek = String(weekKey || '').trim() || weekKeyFromDate(new Date());
  const weekStart = toDayMs(`${focusWeek}T00:00:00.000Z`);
  const fromMs = weekStart != null ? weekStart - WINDOW_WEEKS * 7 * DAY_MS : null;
  const toMs = weekStart != null ? weekStart + WINDOW_WEEKS * 7 * DAY_MS : null;

  const userIds = [
    ...new Set(list.map(memberUserId).filter((id) => mongoose.isValidObjectId(id))),
  ];
  if (!userIds.length) {
    return list.map((m) => ({ ...m, forecastLoad: null }));
  }

  const userOids = userIds.map((id) => new mongoose.Types.ObjectId(id));

  const calPack = await loadCalendarPack(orgId);
  const cap = availableCapacityHours({
    weekKey: focusWeek,
    calendar: calPack.calendar,
    holidays: calPack.holidays,
    requireCalendar: false,
  });
  const workingHours =
    cap.availableHours != null && Number.isFinite(cap.availableHours)
      ? Number(cap.availableHours)
      : 40;

  const taskFilter = {
    isActive: { $ne: false },
    estimateHours: { $gt: 0 },
    $or: [{ assigneeId: { $in: userOids } }, { 'assignees.userId': { $in: userOids } }],
  };
  if (fromMs != null && toMs != null) {
    taskFilter.$and = [
      {
        $or: [
          { dueDate: { $gte: new Date(fromMs), $lte: new Date(toMs) } },
          { startDate: { $gte: new Date(fromMs), $lte: new Date(toMs) } },
          { startDate: null },
          { dueDate: null },
        ],
      },
    ];
  }

  const meetingFilter = {
    status: { $nin: ['cancelled'] },
    'participants.userId': { $in: userOids },
  };
  if (fromMs != null && toMs != null) {
    meetingFilter.startAt = { $gte: new Date(fromMs), $lte: new Date(toMs) };
  }

  const [tasks, meetings] = await Promise.all([
    Task.find(taskFilter)
      .select('estimateHours startDate dueDate assigneeId assignees projectId')
      .lean()
      .catch(() => []),
    MeetingEvent.find(meetingFilter)
      .select('startAt endAt participants')
      .lean()
      .catch(() => []),
  ]);

  const projectTasksByUser = new Map();
  const otherTasksByUser = new Map();
  for (const uid of userIds) {
    projectTasksByUser.set(uid, []);
    otherTasksByUser.set(uid, []);
  }

  for (const raw of tasks || []) {
    const mapped = mapTaskRow(raw);
    if (!(mapped.effortHours > 0)) continue;
    const taskProjectId = mapped.projectId;
    for (const uid of userIds) {
      if (!taskTouchesUser(raw, uid)) continue;
      if (taskProjectId && taskProjectId === pid) {
        projectTasksByUser.get(uid).push(mapped);
      } else {
        // Other project OR null projectId (internal / unscoped)
        otherTasksByUser.get(uid).push(mapped);
      }
    }
  }

  const meetingsByUser = new Map();
  for (const uid of userIds) meetingsByUser.set(uid, []);
  for (const ev of meetings || []) {
    const participants = Array.isArray(ev.participants) ? ev.participants : [];
    for (const p of participants) {
      const uid = String(p?.userId || '').trim();
      if (!meetingsByUser.has(uid)) continue;
      meetingsByUser.get(uid).push(mapMeetingForUser(ev, uid));
    }
  }

  const calOpts = { calendar: calPack.calendar, holidays: calPack.holidays };

  return list.map((row) => {
    const uid = memberUserId(row);
    if (!uid || !projectTasksByUser.has(uid)) {
      return { ...row, forecastLoad: null };
    }
    const projectSched = scheduledHoursForWeek(
      projectTasksByUser.get(uid) || [],
      focusWeek,
      calOpts
    );
    const otherSched = scheduledHoursForWeek(
      otherTasksByUser.get(uid) || [],
      focusWeek,
      calOpts
    );
    const meetingHours = meetingHoursForWeek(meetingsByUser.get(uid) || [], focusWeek);
    const partial =
      projectSched.partialSchedule || otherSched.partialSchedule
        ? 'partial_schedule'
        : 'ok';

    const forecastLoad = computeOne({
      weekKey: focusWeek,
      workingHours,
      leaveHours: 0,
      meetingHours,
      otherCommitmentHours: otherSched.hours,
      projectWorkloadHours: projectSched.hours,
      leaveExcluded: true,
      dataQuality: partial,
    });

    return { ...row, forecastLoad };
  });
}

module.exports = {
  enrichMembersWithForecastLoad,
};
