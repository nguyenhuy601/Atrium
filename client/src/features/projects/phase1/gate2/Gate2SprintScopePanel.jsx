/**
 * Gate2 Sprint/Release drill-down: Story → tasks (or nested sprints for Release).
 * Surfaces Sprint HOW meta; when editable (decision=edit), toggle Story in sprint scope.
 */

import { X } from 'lucide-react';
import {
  sprintExecutionLabelKey,
  sprintValidationLabelKey,
} from './gate2SprintPlanningStatus.js';

function labelOf(t, key, fallback) {
  const value = typeof t === 'function' ? t(key) : '';
  if (value == null || value === '' || value === key) return fallback;
  return value;
}

function displayTitle(row) {
  const title = String(row?.title || '').trim();
  const id = String(row?.id || '').trim();
  if (title && title !== id) return title;
  if (title) return title;
  return id || '—';
}

function statusTone(executionStatus) {
  switch (String(executionStatus || '')) {
    case 'draft_ready':
      return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100';
    case 'blocked':
    case 'failed':
      return 'border-destructive/40 bg-destructive/10 text-destructive';
    case 'incomplete':
      return 'border-amber-500/40 bg-amber-500/10 text-amber-950 dark:text-amber-100';
    default:
      return 'border-border bg-muted/40 text-foreground';
  }
}

function PlanningStatusBanner({ row, t }) {
  const executionStatus = row?.executionStatus;
  const validationStatus = row?.validationStatus;
  const issues = Array.isArray(row?.validationIssues) ? row.validationIssues : [];
  if (!executionStatus && !issues.length) return null;

  const execKey = sprintExecutionLabelKey(executionStatus);
  const validKey = sprintValidationLabelKey(validationStatus);
  const execLabel = execKey
    ? labelOf(t, execKey, executionStatus)
    : executionStatus || '';
  const validLabel = validKey
    ? labelOf(t, validKey, validationStatus)
    : validationStatus || '';

  return (
    <div className={`rounded-md border px-3 py-2 text-xs ${statusTone(executionStatus)}`}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium">
        {execLabel ? (
          <span>
            {labelOf(t, 'requirements.gate2SprintExecLabel', 'Phân bổ')}: {execLabel}
          </span>
        ) : null}
        {validLabel ? (
          <span className="text-[0.7rem] opacity-90">
            · {labelOf(t, 'requirements.gate2SprintValidLabel', 'Validate')}: {validLabel}
          </span>
        ) : null}
        {row?.goalSource ? (
          <span className="text-[0.7rem] opacity-90">
            · {labelOf(t, 'requirements.gate2SprintGoalSourceLabel', 'Goal')}:{' '}
            {labelOf(
              t,
              `requirements.gate2SprintGoalSource_${row.goalSource}`,
              row.goalSource
            )}
          </span>
        ) : null}
        {row?.sprintPlanningReady === true ? (
          <span className="text-[0.7rem] opacity-90">
            · {labelOf(t, 'requirements.gate2SprintReadyYes', 'Sẵn sàng review')}
          </span>
        ) : row?.sprintPlanningReady === false && executionStatus ? (
          <span className="text-[0.7rem] opacity-90">
            · {labelOf(t, 'requirements.gate2SprintReadyNo', 'Chưa sẵn sàng duyệt')}
          </span>
        ) : null}
      </div>
      {issues.length > 0 ? (
        <ul className="mt-2 list-disc space-y-1 pl-4">
          {issues.slice(0, 8).map((issue, index) => (
            <li key={`${issue.code || 'i'}-${issue.sprintId || ''}-${index}`}>
              {[issue.code, issue.message].filter(Boolean).join(' — ') ||
                labelOf(t, 'requirements.gate2SprintIssueFallback', 'Issue')}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function isSpecialStoryId(id) {
  const key = String(id || '');
  return key === '_ungrouped' || key === '_unallocated';
}

function StoryBlock({
  story,
  t,
  editable = false,
  selected = true,
  onToggleStory = null,
  selectedTaskIds = null,
  onToggleTask = null,
}) {
  const tasks = Array.isArray(story?.tasks) ? story.tasks : [];
  const storyTitle = displayTitle(story);
  const hideStoryId =
    !story?.id ||
    isSpecialStoryId(story.id) ||
    storyTitle === story.id;
  const special = isSpecialStoryId(story?.id);
  const showStoryToggle = editable && !special && typeof onToggleStory === 'function';
  const showTaskToggle =
    editable &&
    special &&
    typeof onToggleTask === 'function' &&
    selectedTaskIds instanceof Set;

  return (
    <div
      className={`rounded-md border p-3 ${
        editable && !selected && !special
          ? 'border-border/40 bg-muted/20 opacity-70'
          : 'border-border/60 bg-background/60'
      }`}
    >
      <div className="flex items-start gap-2 text-sm font-semibold text-foreground">
        {showStoryToggle ? (
          <input
            type="checkbox"
            className="mt-0.5 h-3.5 w-3.5 accent-primary"
            checked={selected}
            onChange={() => onToggleStory(String(story.id), !selected)}
            aria-label={labelOf(t, 'requirements.gate2SprintToggleStory', 'Chọn Story vào sprint')}
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <div>
            {storyTitle}
            {!hideStoryId ? (
              <span className="ml-2 text-xs font-normal text-muted-foreground">({story.id})</span>
            ) : null}
          </div>
        </div>
      </div>
      {tasks.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">
          {labelOf(t, 'requirements.gate2SprintScopeEmptyTasks', 'Không có task trong nhóm này.')}
        </p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {tasks.map((task) => {
            const tid = String(task.id || '');
            const taskSelected = showTaskToggle ? selectedTaskIds.has(tid) : true;
            return (
              <li
                key={task.id}
                className="grid grid-cols-1 gap-0.5 border-b border-border/40 py-1.5 text-xs last:border-0 sm:grid-cols-[auto_minmax(0,1.4fr)_minmax(0,0.6fr)_auto]"
              >
                {showTaskToggle ? (
                  <input
                    type="checkbox"
                    className="mt-0.5 h-3.5 w-3.5 accent-primary"
                    checked={taskSelected}
                    onChange={() => onToggleTask(tid, !taskSelected)}
                    aria-label={labelOf(t, 'requirements.gate2SprintToggleTask', 'Chọn task')}
                  />
                ) : (
                  <span className="hidden sm:block" />
                )}
                <div className="min-w-0">
                  <div className="truncate font-medium text-foreground" title={task.id || undefined}>
                    {displayTitle(task)}
                  </div>
                  {task.reason || task.reasonCode ? (
                    <div className="mt-0.5 text-amber-800 dark:text-amber-200">
                      {[task.reasonCode, task.reason].filter(Boolean).join(' — ')}
                    </div>
                  ) : null}
                </div>
                <div className="text-muted-foreground">
                  {[task.assignee, task.suggestedRoleKey].filter(Boolean).join(' · ') || '—'}
                </div>
                <div className="text-right tabular-nums text-muted-foreground">
                  {task.effortHours != null ? `${task.effortHours}h` : '—'}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/**
 * @param {object} props
 * @param {object|null} props.row
 * @param {boolean} [props.editable]
 * @param {string[]} [props.selectedPbiIds]
 * @param {string[]} [props.selectedTaskIds]
 * @param {(next: { pbiIds?: string[], taskIds?: string[] }) => void} [props.onChange]
 * @param {() => void} [props.onBeginEdit]
 * @param {() => void} props.onClose
 * @param {function} props.t
 */
export default function Gate2SprintScopePanel({
  row = null,
  editable = false,
  selectedPbiIds = null,
  selectedTaskIds = null,
  onChange = null,
  onBeginEdit = null,
  onClose,
  t,
}) {
  if (!row) return null;

  const kind = String(row.kind || '');
  const nestedSprints = Array.isArray(row.nestedSprints) ? row.nestedSprints : [];
  const storyGroups = Array.isArray(row.storyGroups) ? row.storyGroups : [];
  const isStatusOnly = kind === 'sprint_planning_status';
  const canEditSprint = editable && kind === 'sprint' && typeof onChange === 'function';

  const pbiSet = new Set(
    (Array.isArray(selectedPbiIds) ? selectedPbiIds : row.pbiIds || []).map(String)
  );
  const taskSet = new Set(
    (Array.isArray(selectedTaskIds) ? selectedTaskIds : row.taskIds || []).map(String)
  );

  const toggleStory = (storyId, nextSelected) => {
    if (!canEditSprint) return;
    const next = new Set(pbiSet);
    if (nextSelected) next.add(storyId);
    else next.delete(storyId);
    onChange({ pbiIds: [...next] });
  };

  const toggleTask = (taskId, nextSelected) => {
    if (!canEditSprint || pbiSet.size > 0) return;
    const next = new Set(taskSet);
    if (nextSelected) next.add(taskId);
    else next.delete(taskId);
    // taskIds-only path (recalc prefers pbiIds when non-empty).
    onChange({ pbiIds: [], taskIds: [...next] });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gate2-sprint-scope-title"
      onClick={onClose}
    >
      <div
        className="vh-motion-respect flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-border bg-card shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <h2 id="gate2-sprint-scope-title" className="truncate text-base font-semibold">
              {row.title || row.id}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {[
                kind !== 'sprint_planning_status' ? kind : '',
                row.goal ? `${labelOf(t, 'requirements.gate2ColSprintGoal', 'Goal')}: ${row.goal}` : '',
                row.effortHours != null ? `${row.effortHours}h` : '',
                row.capacityHours != null
                  ? `${labelOf(t, 'requirements.gate2ColCapacity', 'Capacity')}: ${row.capacityHours}h`
                  : '',
                row.utilizationPct != null ? `${row.utilizationPct}%` : '',
                row.taskCount != null && !isStatusOnly
                  ? `${row.taskCount} ${labelOf(t, 'requirements.gate2ColTaskCount', 'tasks')}`
                  : '',
                canEditSprint
                  ? labelOf(t, 'requirements.gate2SprintScopeEditing', 'Đang sửa phạm vi')
                  : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
          <button
            type="button"
            className="vh-motion-btn rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={onClose}
            aria-label={labelOf(t, 'common.close', 'Close')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
          <PlanningStatusBanner row={row} t={t} />

          {canEditSprint ? (
            <p className="text-xs text-muted-foreground">
              {labelOf(
                t,
                'requirements.gate2SprintScopeEditHint',
                'Bỏ chọn Story để gỡ khỏi sprint (phân bổ story-atomic). Effort/capacity cập nhật ngay.'
              )}
            </p>
          ) : null}

          {isStatusOnly ? (
            !Array.isArray(row.validationIssues) || row.validationIssues.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {labelOf(
                  t,
                  'requirements.gate2SprintPlanningStatusEmptyIssues',
                  'Không có issue validate. Mở từng Sprint để xem phạm vi Story/task.'
                )}
              </p>
            ) : null
          ) : kind === 'release' && nestedSprints.length > 0 ? (
            nestedSprints.map((sprint) => {
              const groups = Array.isArray(sprint.storyGroups) ? sprint.storyGroups : [];
              const hasTasks = groups.some((g) => Array.isArray(g.tasks) && g.tasks.length > 0);
              return (
                <section key={sprint.id} className="space-y-2">
                  <h3 className="text-sm font-semibold text-foreground">
                    {sprint.title || sprint.id}
                    {sprint.goal ? (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        — {sprint.goal}
                      </span>
                    ) : null}
                  </h3>
                  {hasTasks ? (
                    groups.map((story) => (
                      <StoryBlock key={`${sprint.id}:${story.id}`} story={story} t={t} />
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {labelOf(
                        t,
                        'requirements.gate2SprintScopeEmpty',
                        'Chưa có Story/task trong phạm vi này.'
                      )}
                    </p>
                  )}
                </section>
              );
            })
          ) : storyGroups.length ? (
            storyGroups.map((story) => (
              <StoryBlock
                key={story.id}
                story={story}
                t={t}
                editable={canEditSprint}
                selected={isSpecialStoryId(story.id) ? true : pbiSet.has(String(story.id))}
                onToggleStory={toggleStory}
                selectedTaskIds={pbiSet.size === 0 ? taskSet : null}
                onToggleTask={pbiSet.size === 0 ? toggleTask : null}
              />
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              {labelOf(
                t,
                'requirements.gate2SprintScopeEmpty',
                'Chưa có Story/task trong phạm vi này.'
              )}
            </p>
          )}
        </div>

        {!editable && kind === 'sprint' && typeof onBeginEdit === 'function' ? (
          <div className="border-t border-border px-4 py-3">
            <button
              type="button"
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
              onClick={onBeginEdit}
            >
              {labelOf(t, 'requirements.gate2SprintScopeBeginEdit', 'Sửa phạm vi Sprint')}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
