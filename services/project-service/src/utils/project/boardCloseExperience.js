/** Gom số thật khi đóng board — không bịa %. Watcher không việc → bỏ. */

const WATCHER_KEYS = new Set(['watcher', 'viewer']);
const WORK_LINE_MAX = 300;
const SPECIALTY_TITLES_MAX = 3;
const DOMAIN_MAX = 80;

function sid(v) {
  return String(v || '').trim();
}

function formatDueDate(raw) {
  if (!raw) return '';
  const d = raw instanceof Date ? raw : new Date(raw);
  if (!Number.isFinite(d.getTime())) return '';
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isTaskDone(task) {
  if (!task) return false;
  if (task.completedAt) return true;
  return String(task.status || '').trim().toLowerCase() === 'done';
}

function assignedUserIds(task) {
  const ids = new Set();
  const primary = sid(task?.assigneeId);
  if (primary) ids.add(primary);
  const rows = Array.isArray(task?.assignments) ? task.assignments : [];
  for (const a of rows) {
    const slot = String(a?.slot || 'primary').toLowerCase();
    if (slot === 'watcher') continue;
    const uid = sid(a?.userId);
    if (uid) ids.add(uid);
  }
  return ids;
}

/** Legacy progress fact line — kept for callers; PE.work uses specialty line instead. */
function buildFactLine({ boardTitle, roleLabel, done, total, dueLabel }) {
  const parts = [String(boardTitle || '').trim(), String(roleLabel || '').trim()].filter(Boolean);
  if (Number.isFinite(total) && total > 0) {
    parts.push(`${done}/${total} việc xong`);
  } else if (Number.isFinite(done) && done > 0) {
    parts.push(`${done}/0 việc xong`);
  }
  if (dueLabel) parts.push(`hạn ${dueLabel}`);
  return parts.join(' · ').slice(0, WORK_LINE_MAX);
}

/**
 * Specialty work line from done task titles (not progress KPI).
 * RULE-PE-01: no done/total / deadline as primary work content.
 */
function buildSpecialtyWorkLine({ tasks, userId, roleLabel } = {}) {
  const uid = sid(userId);
  const seen = new Set();
  const titles = [];
  for (const task of tasks || []) {
    if (!uid || !assignedUserIds(task).has(uid)) continue;
    if (!isTaskDone(task)) continue;
    const title = String(task?.title || task?.name || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80);
    if (!title) continue;
    const key = title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    titles.push(title);
    if (titles.length >= SPECIALTY_TITLES_MAX) break;
  }
  if (titles.length) return titles.join('; ').slice(0, WORK_LINE_MAX);
  const role = String(roleLabel || '').trim();
  if (role) return `Contributed as ${role}`.slice(0, WORK_LINE_MAX);
  return '';
}

/**
 * Months between two real dates (UTC calendar months, inclusive-ish).
 * Omit when either date missing/invalid — never invent.
 */
function monthsBetweenDates(startRaw, endRaw) {
  if (startRaw == null || endRaw == null || startRaw === '' || endRaw === '') return undefined;
  const start = startRaw instanceof Date ? startRaw : new Date(startRaw);
  const end = endRaw instanceof Date ? endRaw : new Date(endRaw);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return undefined;
  if (end.getTime() < start.getTime()) return undefined;
  const months =
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    (end.getUTCMonth() - start.getUTCMonth()) +
    1;
  if (!Number.isFinite(months) || months < 1) return undefined;
  return Math.min(600, Math.floor(months));
}

function normalizeTechnologies(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  const seen = new Set();
  for (const raw of list) {
    const s = String(raw || '').trim().slice(0, 64);
    if (!s) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
    if (out.length >= 40) break;
  }
  return out;
}

function techListFromProjectStack(projectOrTech) {
  if (Array.isArray(projectOrTech)) return normalizeTechnologies(projectOrTech);
  const stack = projectOrTech?.technicalSetup?.stack || projectOrTech?.techStack || projectOrTech || {};
  return normalizeTechnologies([
    ...(Array.isArray(stack.languages) ? stack.languages : []),
    ...(Array.isArray(stack.frameworks) ? stack.frameworks : []),
    ...(Array.isArray(stack.databases) ? stack.databases : []),
  ]);
}

/**
 * RULE-PE-02: domain only from real fields — never NLP from project title,
 * never invent from category internal/customer alone.
 * @param {object|null|undefined} project
 * @param {string} [domainOverride]
 */
function resolveProjectDomain(project, domainOverride) {
  const override = String(domainOverride || '').trim();
  if (override) return override.slice(0, DOMAIN_MAX);
  if (!project || typeof project !== 'object') return undefined;
  const direct = String(
    project.domain || project.businessDomain || project.industry || ''
  ).trim();
  if (direct) return direct.slice(0, DOMAIN_MAX);
  const domainTags = Array.isArray(project.domainTags) ? project.domainTags : null;
  if (domainTags?.length) {
    const tag = String(domainTags[0] || '').trim();
    if (tag) return tag.slice(0, DOMAIN_MAX);
  }
  return undefined;
}

/**
 * @param {{
 *   board: object,
 *   memberships: object[],
 *   roles: object[],
 *   tasks: object[],
 *   technologies?: string[],
 *   byUserSummary?: object,
 *   domain?: string,
 *   sourceProjectId?: string,
 * }} input
 * @returns {Array<object>}
 */
function buildClosedBoardExperiences({
  board,
  memberships,
  roles,
  tasks,
  technologies,
  byUserSummary,
  domain: domainInput,
  sourceProjectId,
} = {}) {
  const boardId = sid(board?._id || board?.id);
  const boardTitle = String(board?.title || '').trim() || 'Dự án';
  const yearRaw = board?.dueDate || board?.updatedAt || board?.createdAt;
  const yearDate = yearRaw ? new Date(yearRaw) : new Date();
  const year = Number.isFinite(yearDate.getTime()) ? yearDate.getFullYear() : undefined;
  const startRaw = board?.startDate || board?.createdAt || null;
  const endRaw = board?.dueDate || board?.endDate || board?.closedAt || null;
  const months = monthsBetweenDates(startRaw, endRaw);
  const domain = resolveProjectDomain(
    { domain: domainInput, businessDomain: board?.businessDomain, industry: board?.industry, domainTags: board?.domainTags },
    domainInput
  );

  const roleById = new Map();
  for (const r of roles || []) {
    roleById.set(sid(r._id || r.id), r);
  }

  const byUser = new Map();
  for (const m of memberships || []) {
    const uid = sid(m.userId);
    if (!uid) continue;
    if (!byUser.has(uid)) {
      byUser.set(uid, { roleKeys: new Set(), roleLabels: [] });
    }
    const rec = byUser.get(uid);
    const role = roleById.get(sid(m.projectRoleId));
    const key = String(role?.key || '').trim().toLowerCase();
    const label = String(role?.label || role?.key || '').trim();
    if (key) rec.roleKeys.add(key);
    if (label && !rec.roleLabels.includes(label)) rec.roleLabels.push(label);
  }

  const counts = new Map();
  for (const task of tasks || []) {
    const assignees = assignedUserIds(task);
    const done = isTaskDone(task);
    for (const uid of assignees) {
      if (!counts.has(uid)) counts.set(uid, { done: 0, total: 0 });
      const c = counts.get(uid);
      c.total += 1;
      if (done) c.done += 1;
    }
  }

  const projectTechs = normalizeTechnologies(technologies);
  const projectId = sid(sourceProjectId);
  const out = [];
  for (const [userId, rec] of byUser.entries()) {
    const c = counts.get(userId) || { done: 0, total: 0 };
    const keys = rec.roleKeys;
    const watcherOnly = keys.size > 0 && [...keys].every((k) => WATCHER_KEYS.has(k));
    const noRole = keys.size === 0 && rec.roleLabels.length === 0;
    if ((watcherOnly || noRole) && c.total === 0) continue;

    const roleLabel =
      rec.roleLabels.find((l) => /project[_\s-]?manager|pm/i.test(l)) ||
      rec.roleLabels[0] ||
      [...keys][0] ||
      '';
    if (!roleLabel && c.total === 0) continue;

    const work = buildSpecialtyWorkLine({
      tasks,
      userId,
      roleLabel,
    });
    if (!work) continue;

    const userSummary =
      byUserSummary && typeof byUserSummary === 'object' ? byUserSummary[userId] : null;
    const userTechs = normalizeTechnologies(
      userSummary?.technologiesHandled?.length
        ? userSummary.technologiesHandled
        : projectTechs
    );
    const item = {
      userId,
      name: boardTitle,
      role: String(roleLabel).slice(0, 120),
      work,
      source: 'closed_board',
      status: 'suggested',
      evidenceBoardId: boardId,
      isProjectManager: [...keys].includes('project_manager'),
    };
    if (domain) item.domain = domain;
    if (projectId) item.sourceProjectId = projectId;
    if (year >= 1970 && year <= 2100) item.year = year;
    if (months != null) item.months = months;
    if (userTechs.length) {
      item.technologies = userTechs;
      item.technologiesHandled = userTechs;
    }
    if (userSummary && typeof userSummary === 'object') {
      const summary = {};
      if (userSummary.reopenCount != null) summary.reopenCount = Number(userSummary.reopenCount) || 0;
      if (userSummary.submittedEarlyHours != null) {
        summary.submittedEarlyHours = Math.round(Number(userSummary.submittedEarlyHours) * 100) / 100;
      }
      if (userSummary.reEstimateCount != null) {
        summary.reEstimateCount = Number(userSummary.reEstimateCount) || 0;
      }
      if (Object.keys(summary).length) item.summary = summary;
    }
    out.push(item);
  }

  return out;
}

module.exports = {
  buildClosedBoardExperiences,
  buildFactLine,
  buildSpecialtyWorkLine,
  resolveProjectDomain,
  formatDueDate,
  monthsBetweenDates,
  isTaskDone,
  assignedUserIds,
  normalizeTechnologies,
  techListFromProjectStack,
};
