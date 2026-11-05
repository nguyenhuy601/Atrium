/**
 * Project Allocation utilization (Wave: Hub Members forecastLoad).
 * capacityMode: project_allocation_v1
 *
 * Available = Working − Leave − Meetings − OtherCommitments
 * ProjectWorkload = Σ ScheduledHours(tasks in project, week)
 * Utilization = ProjectWorkload / Available × 100
 * OverloadHours = max(0, ProjectWorkload − Available)
 *
 * Meetings are subtracted from Available here (unlike org RULE-CAP-01 numerator).
 */

const { weekKeyFromDate } = require('./capacity');
const { spreadHoursAcrossWeeks } = require('./weekSpread');

const CAPACITY_MODE = 'project_allocation_v1';

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

/**
 * @param {object} input
 * @param {string} [input.weekKey]
 * @param {number} input.workingHours
 * @param {number} [input.leaveHours]
 * @param {number} [input.meetingHours]
 * @param {number} [input.otherCommitmentHours]
 * @param {number} [input.projectWorkloadHours]
 * @param {boolean} [input.leaveExcluded]
 * @param {'ok'|'partial_schedule'} [input.dataQuality]
 * @returns {object} forecastLoad-shaped row
 */
function computeOne({
  weekKey = null,
  workingHours,
  leaveHours = 0,
  meetingHours = 0,
  otherCommitmentHours = 0,
  projectWorkloadHours = 0,
  leaveExcluded = true,
  dataQuality = 'ok',
} = {}) {
  const working = Math.max(0, Number(workingHours) || 0);
  const leave = Math.max(0, Number(leaveHours) || 0);
  const meetings = Math.max(0, Number(meetingHours) || 0);
  const other = Math.max(0, Number(otherCommitmentHours) || 0);
  const workload = Math.max(0, Number(projectWorkloadHours) || 0);

  const availableCapacityHours = round2(Math.max(0, working - leave - meetings - other));
  const overloadHours = round2(Math.max(0, workload - availableCapacityHours));

  let utilizationPct = null;
  let status = 'insufficient_capacity';
  if (availableCapacityHours > 0) {
    utilizationPct = round2((workload / availableCapacityHours) * 100);
    if (utilizationPct > 100) status = 'overloaded';
    else if (utilizationPct === 100) status = 'at_capacity';
    else status = 'ok';
  } else if (workload <= 0) {
    // No capacity and no work — treat as ok (idle / no calendar slice).
    utilizationPct = 0;
    status = 'ok';
  }

  return {
    weekKey: weekKey || null,
    capacityMode: CAPACITY_MODE,
    utilizationPct,
    overloadHours,
    status,
    leaveExcluded: Boolean(leaveExcluded),
    dataQuality: dataQuality === 'partial_schedule' ? 'partial_schedule' : 'ok',
    breakdown: {
      workingHours: round2(working),
      leaveHours: round2(leave),
      meetingHours: round2(meetings),
      otherCommitmentHours: round2(other),
      projectWorkloadHours: round2(workload),
      availableCapacityHours,
    },
  };
}

/**
 * Sum scheduled hours for one weekKey from task-like rows.
 * Tasks without startDate dump into focusWeekKey (or current week) and mark partial.
 *
 * @param {Array<{ effortHours?: number, estimateHours?: number, startDate?: *, dueDate?: *, endDate?: * }>} tasks
 * @param {string} weekKey
 * @param {{ calendar?: object, holidays?: Array }} [opts]
 * @returns {{ hours: number, partialSchedule: boolean }}
 */
function scheduledHoursForWeek(tasks = [], weekKey, { calendar = {}, holidays = [] } = {}) {
  const focus = String(weekKey || '').trim();
  if (!focus) return { hours: 0, partialSchedule: false };

  let hours = 0;
  let partialSchedule = false;
  const fallbackKey = focus || weekKeyFromDate(new Date());

  for (const task of tasks || []) {
    const effort = Number(task.effortHours ?? task.estimateHours ?? task.effortSeedHours) || 0;
    if (!(effort > 0)) continue;
    const start = task.startDate || task.plannedStart || null;
    const end = task.dueDate || task.endDate || task.plannedEnd || start;

    if (!start) {
      partialSchedule = true;
      if (fallbackKey === focus) hours += effort;
      continue;
    }

    const map = spreadHoursAcrossWeeks({
      totalHours: effort,
      startDate: start,
      endDate: end,
      spreadPolicy: 'even_weeks',
      calendar,
      holidays,
    });
    hours += Number(map[focus]) || 0;
  }

  return { hours: round2(hours), partialSchedule };
}

/**
 * Meeting hours already keyed or with startAt → sum for weekKey.
 * @param {Array<{ hours?: number, weekKey?: string, startAt?: * }>} meetings
 * @param {string} weekKey
 */
function meetingHoursForWeek(meetings = [], weekKey, { tzOffsetHours = 7 } = {}) {
  const focus = String(weekKey || '').trim();
  if (!focus) return 0;
  let sum = 0;
  for (const m of meetings || []) {
    const h = Number(m.hours ?? m.plannedHours ?? m.forecastDemandMeet) || 0;
    if (!(h > 0)) continue;
    let key = m.weekKey || null;
    if (!key && m.startAt) key = weekKeyFromDate(m.startAt, { tzOffsetHours });
    if (key === focus) sum += h;
  }
  return round2(sum);
}

module.exports = {
  CAPACITY_MODE,
  computeOne,
  scheduledHoursForWeek,
  meetingHoursForWeek,
  round2,
};
