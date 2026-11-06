/**
 * Pure derive of closure report view from frozen snapshot + selection.
 * Selection: { dimension: 'sprint'|'issueType'|'user'|'crStatus'|null, key: string|null }
 */

export const REPORT_DIMENSIONS = Object.freeze({
  SPRINT: 'sprint',
  ISSUE_TYPE: 'issueType',
  USER: 'user',
  CR_STATUS: 'crStatus',
});

export function emptySelection() {
  return { dimension: null, key: null };
}

export function toggleSelection(prev, dimension, key) {
  const dim = String(dimension || '').trim() || null;
  const k = key == null || key === '' ? null : String(key);
  if (!dim || !k) return emptySelection();
  if (prev?.dimension === dim && String(prev?.key) === k) return emptySelection();
  return { dimension: dim, key: k };
}

/** Select-dropdown set (empty key clears). */
export function applySelection(dimension, key) {
  const dim = String(dimension || '').trim() || null;
  const k = key == null || key === '' ? null : String(key);
  if (!dim || !k) return emptySelection();
  return { dimension: dim, key: k };
}

function asArray(v) {
  return Array.isArray(v) ? v : [];
}

function shortUserLabel(userId) {
  const s = String(userId || '').trim();
  if (!s) return '—';
  if (s.length <= 8) return s;
  return `${s.slice(0, 4)}…${s.slice(-4)}`;
}

/**
 * @param {Record<string, string>|Map<string,string>|null|undefined} nameByUserId
 * @param {string} userId
 */
export function resolveUserLabel(nameByUserId, userId) {
  const id = String(userId || '').trim();
  if (!id) return '—';
  let name = '';
  if (nameByUserId instanceof Map) {
    name = String(nameByUserId.get(id) || '').trim();
  } else if (nameByUserId && typeof nameByUserId === 'object') {
    name = String(nameByUserId[id] || '').trim();
  }
  return name || shortUserLabel(id);
}

/**
 * @param {object|null|undefined} snapshot
 * @param {{ dimension?: string|null, key?: string|null }} [selection]
 * @param {{ nameByUserId?: Record<string, string>|Map<string, string>, issueTypeLabel?: (k:string)=>string, crStatusLabel?: (k:string)=>string }} [labels]
 */
export function deriveClosureReportView(snapshot, selection = emptySelection(), labels = {}) {
  const snap = snapshot && typeof snapshot === 'object' ? snapshot : {};
  const progress = snap.progress && typeof snap.progress === 'object' ? snap.progress : {};
  const performance = snap.performance && typeof snap.performance === 'object' ? snap.performance : {};
  const quality = snap.quality && typeof snap.quality === 'object' ? snap.quality : {};
  const resources = snap.resources && typeof snap.resources === 'object' ? snap.resources : {};
  const personnel = snap.personnel && typeof snap.personnel === 'object' ? snap.personnel : {};
  const process = snap.process && typeof snap.process === 'object' ? snap.process : {};
  const experience = snap.experience && typeof snap.experience === 'object' ? snap.experience : {};
  const techStack = snap.techStack && typeof snap.techStack === 'object' ? snap.techStack : {};

  const nameByUserId = labels?.nameByUserId || null;
  const issueTypeLabel =
    typeof labels?.issueTypeLabel === 'function'
      ? labels.issueTypeLabel
      : (k) => String(k || '');
  const crStatusLabel =
    typeof labels?.crStatusLabel === 'function'
      ? labels.crStatusLabel
      : (k) => String(k || '');

  const dim = selection?.dimension || null;
  const key = selection?.key != null ? String(selection.key) : null;

  const sprints = asArray(progress.sprints);
  const velocityRows = asArray(performance.velocityHoursBySprint);
  const byUserAll = asArray(resources.byUser);
  const membersAll = asArray(personnel.members);
  const byIssueType = performance.byIssueType && typeof performance.byIssueType === 'object'
    ? performance.byIssueType
    : {};
  const crByStatus =
    progress.changeRequests?.byStatus && typeof progress.changeRequests.byStatus === 'object'
      ? progress.changeRequests.byStatus
      : {};

  let work = {
    total: Number(progress.work?.total) || 0,
    doneCount: Number(progress.work?.doneCount) || 0,
    incompleteCount: Number(progress.work?.incompleteCount) || 0,
    overdueCompletedCount: Number(progress.work?.overdueCompletedCount) || 0,
  };
  let onTime = progress.onTime;
  let velocityHoursAverage = performance.velocityHoursAverage;
  let throughputTotal = Number(performance.throughput?.totalDone) || 0;
  let plannedHours = Number(resources.plannedHours) || 0;
  let actualHours = Number(resources.actualHours) || 0;
  let bugCount = Number(quality.bugCount) || 0;
  let defectRate = quality.defectRate;
  let reopenCount = quality.reopenCount;
  let sprintFilterActive = false;
  let userFilterActive = false;
  let resourcesNotLinkedToSprint = false;

  let filteredSprints = sprints;
  let filteredVelocity = velocityRows;
  let filteredByUser = byUserAll;
  let filteredMembers = membersAll;
  let issueTypeRows = ['story', 'task', 'bug'].map((type) => ({
    key: type,
    label: issueTypeLabel(type),
    count: Number(byIssueType[type]?.count) || 0,
    avgLeadTimeHours: byIssueType[type]?.avgLeadTimeHours ?? null,
  }));
  let crStatusRows = Object.entries(crByStatus).map(([status, count]) => ({
    key: status,
    label: crStatusLabel(status),
    count: Number(count) || 0,
  }));

  if (dim === REPORT_DIMENSIONS.SPRINT && key) {
    sprintFilterActive = true;
    resourcesNotLinkedToSprint = true;
    filteredSprints = sprints.filter((s) => String(s.sprintId || s.name) === key);
    filteredVelocity = velocityRows.filter((s) => String(s.sprintId || s.name) === key);
    const sprint = filteredSprints[0];
    if (sprint) {
      work = {
        ...work,
        doneCount: Number(sprint.doneCount) || 0,
        incompleteCount: Number(sprint.incompleteCount) || 0,
        total: (Number(sprint.doneCount) || 0) + (Number(sprint.incompleteCount) || 0),
      };
      velocityHoursAverage = Number(sprint.velocityHours ?? sprint.completedHours) || 0;
      throughputTotal = Number(sprint.doneCount) || 0;
    }
  }

  if (dim === REPORT_DIMENSIONS.USER && key) {
    userFilterActive = true;
    filteredByUser = byUserAll.filter((u) => String(u.userId) === key);
    filteredMembers = membersAll.filter((m) => String(m.userId) === key);
    const row = filteredByUser[0];
    if (row) {
      plannedHours = Number(row.plannedHours) || 0;
      actualHours = Number(row.actualHours) || 0;
      reopenCount = Number(row.reopenCount) || 0;
    }
    const member = filteredMembers[0];
    if (member) {
      throughputTotal = Number(member.tasksDone) || 0;
    }
  }

  if (dim === REPORT_DIMENSIONS.ISSUE_TYPE && key) {
    issueTypeRows = issueTypeRows.map((row) => ({
      ...row,
      dimmed: row.key !== key,
    }));
    const typed = byIssueType[key];
    if (typed) {
      throughputTotal = Number(typed.count) || 0;
    }
    if (key === 'bug') {
      bugCount = Number(byIssueType.bug?.count) || bugCount;
      defectRate =
        work.doneCount > 0 ? Math.round((bugCount / work.doneCount) * 1000) / 1000 : defectRate;
    }
  }

  if (dim === REPORT_DIMENSIONS.CR_STATUS && key) {
    crStatusRows = crStatusRows.map((row) => ({
      ...row,
      dimmed: row.key !== key,
    }));
  }

  const workPie = [
    { key: 'done', count: work.doneCount },
    { key: 'incomplete', count: work.incompleteCount },
  ].filter((r) => r.count > 0);

  const hoursByUser = filteredByUser.map((u) => ({
    key: String(u.userId),
    label: resolveUserLabel(nameByUserId, u.userId),
    plannedHours: Number(u.plannedHours) || 0,
    actualHours: Number(u.actualHours) || 0,
    reopenCount: Number(u.reopenCount) || 0,
  }));

  const velocityChart = filteredVelocity.map((s) => ({
    key: String(s.sprintId || s.name || ''),
    label: String(s.name || s.sprintId || '—').trim() || '—',
    velocityHours: Number(s.velocityHours) || 0,
  }));

  const sprintOptions = sprints.map((s) => ({
    key: String(s.sprintId || s.name || ''),
    label: String(s.name || s.sprintId || '—').trim() || '—',
  }));
  const userOptions = byUserAll.map((u) => ({
    key: String(u.userId),
    label: resolveUserLabel(nameByUserId, u.userId),
  }));
  const issueTypeOptions = ['story', 'task', 'bug'].map((type) => ({
    key: type,
    label: issueTypeLabel(type),
  }));
  const crOptions = Object.keys(crByStatus).map((status) => ({
    key: status,
    label: crStatusLabel(status),
  }));

  const drawerRows = (() => {
    if (dim === REPORT_DIMENSIONS.SPRINT && key) {
      return filteredSprints.map((s) => ({
        kind: 'sprint',
        name: String(s.name || s.sprintId || '—').trim() || '—',
        doneCount: Number(s.doneCount) || 0,
        incompleteCount: Number(s.incompleteCount) || 0,
        velocityHours: Number(s.velocityHours ?? s.completedHours) || 0,
        committedHours: s.committedHours != null ? Number(s.committedHours) || 0 : null,
        reviewNotes: String(s.reviewNotes || '').trim() || null,
      }));
    }
    if (dim === REPORT_DIMENSIONS.USER && key) {
      const member = filteredMembers[0] || membersAll.find((m) => String(m.userId) === key);
      const row = filteredByUser[0] || byUserAll.find((u) => String(u.userId) === key);
      return [
        {
          kind: 'user',
          name: resolveUserLabel(nameByUserId, key),
          plannedHours: Number(row?.plannedHours) || 0,
          actualHours: Number(row?.actualHours) || 0,
          varianceHours: row?.varianceHours != null ? Number(row.varianceHours) || 0 : null,
          reopenCount: Number(row?.reopenCount) || 0,
          tasksDone: Number(member?.tasksDone) || 0,
          technologiesHandled: asArray(row?.technologiesHandled),
        },
      ];
    }
    if (dim === REPORT_DIMENSIONS.ISSUE_TYPE && key) {
      return issueTypeRows
        .filter((r) => r.key === key)
        .map((r) => ({
          kind: 'issueType',
          name: r.label || issueTypeLabel(r.key),
          count: r.count,
          avgLeadTimeHours: r.avgLeadTimeHours,
        }));
    }
    if (dim === REPORT_DIMENSIONS.CR_STATUS && key) {
      return crStatusRows
        .filter((r) => r.key === key)
        .map((r) => ({
          kind: 'crStatus',
          name: r.label || crStatusLabel(r.key),
          count: r.count,
        }));
    }
    return [];
  })();

  return {
    schemaVersion: snap.schemaVersion ?? null,
    at: snap.at || null,
    techStack: {
      languages: asArray(techStack.languages),
      frameworks: asArray(techStack.frameworks),
      databases: asArray(techStack.databases),
    },
    selection: { dimension: dim, key },
    kpis: {
      doneCount: work.doneCount,
      total: work.total,
      onTime,
      velocityHoursAverage: velocityHoursAverage == null ? null : Number(velocityHoursAverage) || 0,
      throughputTotal,
      defectRate: defectRate == null ? null : Number(defectRate),
      bugCount,
      reopenCount: reopenCount == null ? null : Number(reopenCount),
      plannedHours,
      actualHours,
      memberCount: filteredMembers.length || membersAll.length,
      unassignedDoneCount: Number(personnel.unassignedDoneCount) || 0,
    },
    charts: {
      workPie,
      velocityChart,
      issueTypeRows,
      hoursByUser,
      crStatusRows,
    },
    process: {
      approvalWaitHoursAverage: process.approvalWaitHoursAverage ?? null,
      approvalSampleSize: Number(process.approvalSampleSize) || 0,
      historicalSpilloverCount: Number(process.historicalSpilloverCount) || 0,
      wipLimit: process.wipLimit ?? null,
    },
    experience: {
      closeNotes: String(experience.closeNotes || '').trim(),
      sprintReviewNotes: asArray(experience.sprintReviewNotes),
    },
    flags: {
      sprintFilterActive,
      userFilterActive,
      resourcesNotLinkedToSprint,
    },
    slicers: {
      sprints: sprintOptions,
      users: userOptions,
      issueTypes: issueTypeOptions,
      crStatuses: crOptions,
    },
    drawerRows,
  };
}
