import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarRange,
  ChevronDown,
  ChevronRight,
  Crosshair,
  Maximize2,
  Minus,
  Plus,
  Search,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppStrings } from '../../../locales/appStrings';
import UserAvatar from '../../../components/Shared/UserAvatar';
import { AdminLoadErrorState } from '../../../components/adminUsers/adminPanelStates';
import { projectAPI } from '../../../services/api/projectAPI';
import { resolveApiErrorMessage } from '../../../utils/resolveApiErrorMessage';
import ProjectHubIssueTypeBadge from './ProjectHubIssueTypeBadge';
import WorkItemDetail from './WorkItemDetail';
import { buildListTree } from './projectHubHierarchy';
import { flattenExpandedRows } from './projectHubListLazy';
import {
  HUB_TL_GANTT_HEAD,
  HUB_TL_ICON_BTN,
  HUB_TL_LEGEND_CHIP,
  HUB_TL_SEARCH,
  HUB_TL_SELECT,
  HUB_TL_TOOLBAR,
  HUB_TL_WORK_HEAD,
} from './projectHubUiClasses';
import {
  TIMELINE_DAY_LABEL_NUM_MIN_PX,
  TIMELINE_PX_PER_UNIT,
  TIMELINE_ROW_PX,
  TIMELINE_SCALES,
  TIMELINE_SCROLL_EDGE_PX,
  barPlacement,
  buildFitWindow,
  buildInitialWindow,
  buildJumpWindow,
  clampTimelinePxPerUnit,
  columnsTotalWidth,
  earliestScheduledRange,
  enumerateColumns,
  extendWindow,
  fitTimelinePxPerUnit,
  fillViewportPxPerUnit,
  groupTimelineColumns,
  isMajorTimelineGridColumn,
  isSameLocalDay,
  isWeekendColumn,
  rangeForTimelineNode,
  resolveProjectTimeBounds,
  scrollLeftForZoomAnchor,
  scrollLeftToShowBar,
  sprintBarPlacement,
  timelineBarLabelOutside,
  timelineDayHeaderText,
  timelineMinBarPx,
  timelineTodayShowsChip,
  todayOffsetPx,
  unionTimelineBounds,
} from './projectHubTimeline';
import {
  childWorkProgressBarClass,
  childWorkProgressPct,
  classifyListStatusBucket,
  displayIssueKey,
  dueDateTone,
  formatHubDate,
  timelineBarForegroundClass,
  timelineBarToneClass,
  timelineStatusDotClass,
  timelineWorkTypeBarClass,
  unwrapPlanningEntity,
} from './projectHubUtils';
import { childWorkStats } from './projectHubBacklogStats';

/** Cột trái hẹp — trọng tâm Gantt thời gian bên phải. */
const WORK_COL_PX = 188;
const HEADER_PX = 40;
const BAR_H_PX = 28;
const BAR_TOP_PX = Math.max(0, Math.round((TIMELINE_ROW_PX - BAR_H_PX) / 2));
const TYPE_FILTERS = ['epic', 'feature', 'story', 'task', 'bug', 'subtask'];
const STATUS_FILTERS = ['todo', 'progress', 'done'];
const TYPE_LABEL_KEYS = {
  epic: 'workspace.projectHubIssueTypeEpic',
  feature: 'workspace.projectHubIssueTypeFeature',
  story: 'workspace.projectHubIssueTypeStory',
  task: 'workspace.projectHubIssueTypeTask',
  bug: 'workspace.projectHubIssueTypeBug',
  subtask: 'workspace.projectHubIssueTypeSubtask',
};
const STATUS_LABEL_KEYS = {
  todo: 'workspace.projectHubBacklogStatusTodo',
  progress: 'workspace.projectHubBacklogStatusProgress',
  done: 'workspace.projectHubBacklogStatusDone',
};
const SCALE_LABEL_KEYS = {
  weeks: 'workspace.projectHubTimelineWeeks',
  months: 'workspace.projectHubTimelineMonths',
  quarters: 'workspace.projectHubTimelineQuarters',
};

function entityId(row) {
  return String(row?._id || row?.id || '');
}

function upsertById(list, row) {
  const id = entityId(row);
  if (!id) return Array.isArray(list) ? list : [];
  const current = Array.isArray(list) ? list : [];
  let found = false;
  const next = current.map((item) => {
    if (entityId(item) !== id) return item;
    found = true;
    return { ...item, ...row };
  });
  if (!found) next.push(row);
  return next;
}

function nodeStatusBucket(node, lists) {
  const raw = node?.raw || {};
  if (node?.kind === 'planning') {
    const s = String(raw.status || '').toLowerCase();
    if (s === 'active') return 'progress';
    return classifyListStatusBucket(raw.status);
  }
  const list = (lists || []).find((l) => String(l._id || l.id) === String(raw.listId || raw.list || ''));
  return classifyListStatusBucket(raw.status || list);
}

function nodeDueTone(node, lists) {
  const raw = node?.raw || {};
  const list = (lists || []).find((l) => String(l._id || l.id) === String(raw.listId || raw.list || ''));
  const due = raw.dueDate || raw.targetDate || null;
  return dueDateTone(due, raw.status || list);
}

function nodeBarClass(node, lists) {
  return timelineBarToneClass({
    bucket: nodeStatusBucket(node, lists),
    dueTone: nodeDueTone(node, lists),
    workType: node?.workType,
  });
}

function nodeBarForegroundClass(node, lists) {
  return timelineBarForegroundClass({
    bucket: nodeStatusBucket(node, lists),
    dueTone: nodeDueTone(node, lists),
  });
}

function nodeStatusDot(node, lists) {
  return timelineStatusDotClass({
    bucket: nodeStatusBucket(node, lists),
    dueTone: nodeDueTone(node, lists),
  });
}

function nodeRowToneClass(index, hovered) {
  if (hovered) return 'bg-primary/10';
  return index % 2 === 1 ? 'bg-muted/35' : 'bg-surface';
}

/** Legend Gantt: loại việc (màu bar todo) + trạng thái ghi đè. */
const TIMELINE_LEGEND = [
  { key: 'epic', kind: 'type', workType: 'epic', labelKey: TYPE_LABEL_KEYS.epic },
  { key: 'feature', kind: 'type', workType: 'feature', labelKey: TYPE_LABEL_KEYS.feature },
  { key: 'story', kind: 'type', workType: 'story', labelKey: TYPE_LABEL_KEYS.story },
  { key: 'task', kind: 'type', workType: 'task', labelKey: TYPE_LABEL_KEYS.task },
  { key: 'progress', kind: 'status', bucket: 'progress', dueTone: 'none', labelKey: STATUS_LABEL_KEYS.progress },
  { key: 'done', kind: 'status', bucket: 'done', dueTone: 'none', labelKey: STATUS_LABEL_KEYS.done },
  { key: 'overdue', kind: 'status', bucket: 'todo', dueTone: 'overdue', labelKey: 'workspace.projectHubStatOverdue' },
];

function resolveAssignee(raw) {
  const first = raw?.assignees?.[0];
  if (first) {
    return {
      name: String(first.displayName || first.name || '').trim(),
      avatar: first.avatar || first.avatarUrl || '',
      userId: first.userId || first.id || null,
    };
  }
  if (raw?.assigneeName || raw?.assigneeId) {
    return {
      name: String(raw.assigneeName || '').trim(),
      avatar: raw.assigneeAvatar || '',
      userId: raw.assigneeId || null,
    };
  }
  return null;
}

function filterTimelineTree(nodes, { query, epicId, type, status }, ctx) {
  const q = String(query || '').trim().toLowerCase();
  const out = [];
  for (const node of nodes || []) {
    if (epicId && node.workType === 'epic' && entityId(node.raw) !== epicId) continue;
    const children = filterTimelineTree(node.children, { query, epicId: '', type, status }, ctx);
    const raw = node.raw || {};
    const key = displayIssueKey(ctx.projectCode, entityId(raw)).toLowerCase();
    const title = String(node.title || raw.title || '').toLowerCase();
    const matchQuery = !q || title.includes(q) || key.includes(q);
    const matchType = !type || String(node.workType || '').toLowerCase() === type;
    const matchStatus = !status || nodeStatusBucket(node, ctx.lists) === status;
    if ((matchQuery && matchType && matchStatus) || children.length) {
      out.push({ ...node, children });
    }
  }
  return out;
}

function monthShort(year, month, locale) {
  return new Date(year, month, 1).toLocaleDateString(locale === 'en' ? 'en-US' : 'vi-VN', {
    month: 'short',
  });
}

function quarterLabel(year, quarter, locale) {
  const startMonth = (Number(quarter) - 1) * 3;
  return `${monthShort(year, startMonth, locale)} - ${monthShort(year, startMonth + 2, locale)}`;
}

function groupHeaderLabel(group, locale) {
  if (group.scale === 'quarters') return String(group.year);
  return monthShort(group.year, group.month, locale);
}

function columnHeaderLabel(col, locale) {
  if (col.scale === 'weeks') return timelineDayHeaderText(col, locale);
  if (col.scale === 'quarters') return quarterLabel(col.year, col.quarter, locale);
  return monthShort(col.year, col.month, locale);
}

const WEEKEND_HATCH_STYLE = {
  backgroundImage:
    'repeating-linear-gradient(-45deg, transparent, transparent 3px, var(--border-strong) 3px, var(--border-strong) 4px)',
};

function TimelineCreateEpic({ busy = false, onCreate, t }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  if (!open) {
    return (
      <button
        type="button"
        disabled={busy}
        onClick={() => setOpen(true)}
        className="mt-1 rounded-md px-1.5 py-1 text-left text-xs font-semibold text-muted-foreground hover:text-foreground disabled:opacity-50"
      >
        {t('workspace.projectHubTimelineCreateEpic')}
      </button>
    );
  }
  return (
    <div className="mt-1 flex flex-col gap-2 rounded-lg border border-border bg-background p-2 sm:flex-row sm:items-center">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={t('workspace.projectHubBacklogCreatePlanningPh')}
        className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground"
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            onCreate?.(title);
            setTitle('');
            setOpen(false);
          }
        }}
      />
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="rounded-md border border-border px-2 py-1 text-xs font-semibold"
          onClick={() => {
            const text = String(title || '').trim();
            if (!text || busy) return;
            onCreate?.(text);
            setTitle('');
            setOpen(false);
          }}
          disabled={busy}
        >
          {t('workspace.projectHubPlanAdd')}
        </button>
        <button
          type="button"
          className="rounded-md px-2 py-1 text-xs text-muted-foreground"
          onClick={() => {
            setOpen(false);
            setTitle('');
          }}
        >
          {t('common.cancel')}
        </button>
      </div>
    </div>
  );
}

/**
 * Tab Timeline — cây Work + Gantt theo tuần/tháng/quý trong biên dự án.
 */
export default function ProjectHubTimelinePanel({
  projectId = '',
  boardId = '',
  defaultListId = '',
  lists = [],
  projectCode = '',
  hubCaps = null,
  canManage = false,
  apiCtx = null,
  isDarkMode = false,
  locale = 'en',
  workspaceSlug = '',
  board = null,
  projectPayload = null,
  cards = [],
  planningItems = [],
  planningLoading = false,
  planningError = false,
  sprints = [],
  onPatchPlanningItems = null,
  onReloadPlanning = null,
  onRefresh = null,
  onUpdateCard = null,
  onPatchBoardCards = null,
  timelineActive = true,
  workTypeConfig = null,
}) {
  const { t } = useAppStrings();
  const [scale, setScale] = useState('months');
  const [pxPerUnit, setPxPerUnit] = useState(TIMELINE_PX_PER_UNIT.months);
  const [range, setRange] = useState(null);
  const [headerDragging, setHeaderDragging] = useState(false);
  const [query, setQuery] = useState('');
  const [epicFilter, setEpicFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const [detailIssue, setDetailIssue] = useState(null);
  const [createBusy, setCreateBusy] = useState(false);
  const [hoveredRowId, setHoveredRowId] = useState(null);
  const leftRef = useRef(null);
  const rightRef = useRef(null);
  const syncingY = useRef(false);
  const pendingPrependPx = useRef(0);
  const extendingRef = useRef(false);
  const pendingZoomAnchorRef = useRef(null);
  const pendingFocusRangeRef = useRef(null);
  const headerDragRef = useRef(null);

  const titleCls = 'text-foreground';
  const muted = 'text-muted-foreground';
  const iconBtn =
    'rounded-full p-1 text-muted-foreground transition-colors motion-reduce:transition-none hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
  const bounds = useMemo(
    () => resolveProjectTimeBounds(projectPayload, board),
    [projectPayload, board]
  );
  const boundsKey = bounds ? `${bounds.start.getTime()}:${bounds.end.getTime()}` : '';

  /**
   * Phóng cột cho đầy viewport khi đổi scale/biên (và khi resize).
   * Không fill lại mỗi lần pan mở rộng `range` — giữ zoom +/- của user.
   */
  const rangeRef = useRef(range);
  rangeRef.current = range;
  const needsViewportFillRef = useRef(true);
  useEffect(() => {
    setRange(buildInitialWindow(scale, new Date(), bounds));
    needsViewportFillRef.current = true;
  }, [scale, boundsKey, bounds]);

  useLayoutEffect(() => {
    if (!timelineActive) return undefined;
    const el = rightRef.current;
    const applyFill = (force) => {
      const win = rangeRef.current;
      if (!win?.start || !win?.end) return;
      if (!force && !needsViewportFillRef.current) return;
      const viewport = rightRef.current?.clientWidth || 0;
      if (viewport < 120) return;
      const nextPx = fillViewportPxPerUnit(scale, win, viewport);
      needsViewportFillRef.current = false;
      setPxPerUnit((prev) => (prev === nextPx ? prev : nextPx));
    };
    applyFill(false);
    const ro =
      typeof ResizeObserver !== 'undefined' && el
        ? new ResizeObserver(() => applyFill(true))
        : null;
    if (ro && el) ro.observe(el);
    return () => ro?.disconnect();
  }, [timelineActive, scale, boundsKey, range]);

  const minBarPx = useMemo(() => timelineMinBarPx(scale, pxPerUnit), [scale, pxPerUnit]);
  const columns = useMemo(
    () => enumerateColumns(range, scale, pxPerUnit),
    [range, scale, pxPerUnit]
  );
  const columnOffsets = useMemo(() => {
    let x = 0;
    return columns.map((col) => {
      const offset = x;
      x += col.widthPx;
      return { key: col.key, left: offset };
    });
  }, [columns]);
  const groups = useMemo(() => groupTimelineColumns(columns), [columns]);
  const totalWidth = columnsTotalWidth(columns);
  const today = useMemo(() => new Date(), [scale, boundsKey]);
  const todayX = useMemo(() => todayOffsetPx(today, columns), [today, columns]);
  const showWeeksHeader = scale === 'weeks';

  const epics = useMemo(
    () => (planningItems || []).filter((i) => String(i.type || '').toLowerCase() === 'epic'),
    [planningItems]
  );
  const features = useMemo(
    () => (planningItems || []).filter((i) => String(i.type || '').toLowerCase() === 'feature'),
    [planningItems]
  );
  const tree = useMemo(
    () =>
      buildListTree({
        epics,
        features,
        cards,
        config: workTypeConfig,
      }),
    [epics, features, cards, workTypeConfig]
  );
  const filteredTree = useMemo(
    () =>
      filterTimelineTree(
        tree,
        { query, epicId: epicFilter, type: typeFilter, status: statusFilter },
        { projectCode, lists }
      ),
    [tree, query, epicFilter, typeFilter, statusFilter, projectCode, lists]
  );
  const flatRows = useMemo(
    () => flattenExpandedRows(filteredTree, expandedIds),
    [filteredTree, expandedIds]
  );
  const scheduledRanges = useMemo(
    () => flatRows.map(({ node }) => rangeForTimelineNode(node)).filter(Boolean),
    [flatRows]
  );
  const scheduleBounds = useMemo(
    () => (scheduledRanges.length ? unionTimelineBounds(...scheduledRanges) : null),
    [scheduledRanges]
  );
  const timelineBounds = useMemo(
    () => unionTimelineBounds(bounds, scheduleBounds) || bounds,
    [bounds, scheduleBounds]
  );
  const scheduledRowCount = scheduledRanges.length;
  const showPartialEmptyOverlay =
    !planningLoading && flatRows.length > 0 && scheduledRowCount === 0;
  const canJumpToSchedule = scheduledRowCount > 0;

  const overlappingSprints = useMemo(() => {
    if (todayX == null) return [];
    const day = new Date();
    day.setHours(0, 0, 0, 0);
    const t0 = day.getTime();
    return (sprints || []).filter((s) => {
      const a = s?.startDate ? new Date(s.startDate).getTime() : NaN;
      const b = s?.endDate ? new Date(s.endDate).getTime() : NaN;
      if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
      return a <= t0 && t0 <= b;
    });
  }, [sprints, todayX]);

  const centerToday = useCallback(() => {
    const el = rightRef.current;
    if (!el || todayX == null) return;
    el.scrollLeft = Math.max(0, todayX - el.clientWidth / 2);
  }, [todayX]);

  const fitTimeline = useCallback(() => {
    if (!timelineBounds) return;
    const el = rightRef.current;
    const viewport = el?.clientWidth || 640;
    const nextRange = buildFitWindow(scale, timelineBounds);
    if (!nextRange) return;
    const nextPx = fitTimelinePxPerUnit(scale, timelineBounds, viewport);
    const focus = earliestScheduledRange(scheduledRanges);
    if (focus) pendingFocusRangeRef.current = focus;
    setRange(nextRange);
    setPxPerUnit(nextPx);
    if (!focus) {
      requestAnimationFrame(() => {
        if (rightRef.current) rightRef.current.scrollLeft = 0;
      });
    }
  }, [timelineBounds, scale, scheduledRanges]);

  const jumpToSchedule = useCallback(() => {
    const focus = earliestScheduledRange(scheduledRanges);
    if (!focus || !timelineBounds) return;
    const place = barPlacement(focus.start, focus.end, columns, { minBarPx });
    const el = rightRef.current;
    if (place && el) {
      el.scrollLeft = scrollLeftToShowBar(place, el.clientWidth);
      return;
    }
    pendingFocusRangeRef.current = focus;
    setRange(buildJumpWindow(scale, focus, timelineBounds));
  }, [scheduledRanges, timelineBounds, columns, scale, minBarPx]);

  useEffect(() => {
    if (!timelineActive) return undefined;
    const id = requestAnimationFrame(centerToday);
    return () => cancelAnimationFrame(id);
  }, [timelineActive, scale, boundsKey, centerToday]);

  useLayoutEffect(() => {
    const el = rightRef.current;
    if (!el || !pendingPrependPx.current) return;
    el.scrollLeft += pendingPrependPx.current;
    pendingPrependPx.current = 0;
    extendingRef.current = false;
  }, [range]);

  useLayoutEffect(() => {
    const anchor = pendingZoomAnchorRef.current;
    const el = rightRef.current;
    if (!anchor || !el) return;
    el.scrollLeft = scrollLeftForZoomAnchor(
      anchor.scrollLeft,
      anchor.pointerX,
      anchor.oldPx,
      pxPerUnit
    );
    pendingZoomAnchorRef.current = null;
  }, [pxPerUnit]);

  useLayoutEffect(() => {
    const focus = pendingFocusRangeRef.current;
    const el = rightRef.current;
    if (!focus || !el || !columns.length) return;
    const place = barPlacement(focus.start, focus.end, columns, { minBarPx });
    if (!place) return;
    pendingFocusRangeRef.current = null;
    el.scrollLeft = scrollLeftToShowBar(place, el.clientWidth);
  }, [columns, range, pxPerUnit, minBarPx]);

  const applyTimelineZoom = useCallback(
    (nextPx, pointerX) => {
      const el = rightRef.current;
      const clamped = clampTimelinePxPerUnit(scale, nextPx);
      if (!el || clamped === pxPerUnit) return;
      pendingZoomAnchorRef.current = {
        scrollLeft: el.scrollLeft,
        pointerX,
        oldPx: pxPerUnit,
      };
      setPxPerUnit(clamped);
    },
    [pxPerUnit, scale]
  );

  const onHeaderPointerDown = useCallback((event) => {
    if (event.button !== 0) return;
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);
    headerDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      mode: null,
      startScrollLeft: rightRef.current?.scrollLeft ?? 0,
      startPxPerUnit: pxPerUnit,
      lastAppliedPx: pxPerUnit,
    };
    setHeaderDragging(true);
  }, [pxPerUnit]);

  const onHeaderPointerMove = useCallback(
    (event) => {
      const drag = headerDragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      if (!drag.mode) {
        if (Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
        drag.mode = Math.abs(dx) >= Math.abs(dy) ? 'pan' : 'zoom';
      }
      if (drag.mode === 'pan' && rightRef.current) {
        rightRef.current.scrollLeft = drag.startScrollLeft - dx;
        return;
      }
      if (drag.mode === 'zoom') {
        const el = rightRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const pointerX = event.clientX - rect.left;
        const nextPx = clampTimelinePxPerUnit(scale, drag.startPxPerUnit - dy * 0.35);
        const prevPx = drag.lastAppliedPx ?? pxPerUnit;
        if (nextPx === prevPx) return;
        pendingZoomAnchorRef.current = {
          scrollLeft: el.scrollLeft,
          pointerX,
          oldPx: prevPx,
        };
        drag.lastAppliedPx = nextPx;
        setPxPerUnit(nextPx);
      }
    },
    [pxPerUnit, scale]
  );

  const onHeaderPointerUp = useCallback((event) => {
    const drag = headerDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    headerDragRef.current = null;
    setHeaderDragging(false);
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* ignore */
    }
  }, []);

  const onTimelineWheel = useCallback(
    (event) => {
      if (!event.ctrlKey && !event.metaKey) return;
      const el = rightRef.current;
      if (!el) return;
      event.preventDefault();
      const rect = el.getBoundingClientRect();
      const pointerX = event.clientX - rect.left;
      const direction = event.deltaY > 0 ? -1 : 1;
      const step = (TIMELINE_PX_PER_UNIT[scale] ?? 40) * 0.06;
      applyTimelineZoom(pxPerUnit + direction * step, pointerX);
    },
    [applyTimelineZoom, pxPerUnit, scale]
  );

  const zoomTimelineStep = useCallback(
    (direction) => {
      const el = rightRef.current;
      if (!el) return;
      const pointerX = el.clientWidth / 2;
      const step = (TIMELINE_PX_PER_UNIT[scale] ?? 40) * 0.12;
      applyTimelineZoom(pxPerUnit + direction * step, pointerX);
    },
    [applyTimelineZoom, pxPerUnit, scale]
  );

  const syncFromLeft = (event) => {
    if (syncingY.current) return;
    syncingY.current = true;
    if (rightRef.current) rightRef.current.scrollTop = event.currentTarget.scrollTop;
    syncingY.current = false;
  };

  const onRightScroll = (event) => {
    const el = event.currentTarget;
    if (!syncingY.current && leftRef.current) {
      syncingY.current = true;
      leftRef.current.scrollTop = el.scrollTop;
      syncingY.current = false;
    }
    if (extendingRef.current || !range || !timelineBounds) return;
    if (el.scrollLeft <= TIMELINE_SCROLL_EDGE_PX) {
      const next = extendWindow(range, scale, 'prev', timelineBounds);
      if (next.start.getTime() !== range.start.getTime()) {
        const oldW = columnsTotalWidth(columns);
        const newW = columnsTotalWidth(enumerateColumns(next, scale, pxPerUnit));
        pendingPrependPx.current = newW - oldW;
        extendingRef.current = true;
        setRange(next);
      }
      return;
    }
    const room = el.scrollWidth - el.clientWidth - el.scrollLeft;
    if (room <= TIMELINE_SCROLL_EDGE_PX) {
      const next = extendWindow(range, scale, 'next', timelineBounds);
      if (next.end.getTime() !== range.end.getTime()) setRange(next);
    }
  };

  const toggleExpand = (nodeId) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  const createEpic = async (text) => {
    const title = String(text || '').trim();
    if (!title || createBusy || !projectId) return;
    setCreateBusy(true);
    try {
      const res = await projectAPI.createPlanningItem(projectId, { type: 'epic', title });
      const created = unwrapPlanningEntity(res);
      if (created) {
        onPatchPlanningItems?.((prev) => upsertById(prev, { ...created, type: 'epic', title }));
      } else {
        onReloadPlanning?.();
      }
      toast.success(t('workspace.projectHubPlanCreated'));
    } catch (err) {
      toast.error(resolveApiErrorMessage(err, { t, fallback: t('workspace.projectHubPlanCreateFail') }));
    } finally {
      setCreateBusy(false);
    }
  };

  const bodyH = Math.max(flatRows.length * TIMELINE_ROW_PX, TIMELINE_ROW_PX);

  if (planningError) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-12">
        <AdminLoadErrorState
          message={t('workspace.projectHubTimelineLoadFail')}
          onRetry={() => onReloadPlanning?.()}
          disabled={planningLoading}
        />
      </div>
    );
  }

  if (!bounds) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-12 text-center">
        <p className={`text-sm ${muted}`}>{t('workspace.projectHubTimelineNoDates')}</p>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-muted/20" aria-busy={planningLoading || undefined}>
      <div className={HUB_TL_TOOLBAR}>
        <label className="relative shrink-0">
          <Search
            size={13}
            className={`pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 ${muted}`}
            aria-hidden
          />
          <span className="sr-only">{t('workspace.projectHubTimelineSearchPh')}</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('workspace.projectHubTimelineSearchPh')}
            className={HUB_TL_SEARCH}
          />
        </label>
        <select
          className={HUB_TL_SELECT}
          value={epicFilter}
          onChange={(e) => setEpicFilter(e.target.value)}
          aria-label={t('workspace.projectHubTimelineFilterEpic')}
        >
          <option value="">{t('workspace.projectHubPlanAllEpics')}</option>
          {epics.map((epic) => (
            <option key={entityId(epic)} value={entityId(epic)}>
              {displayIssueKey(projectCode, entityId(epic))} {epic.title || ''}
            </option>
          ))}
        </select>
        <select
          className={`${HUB_TL_SELECT} max-w-[7rem]`}
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          aria-label={t('workspace.projectHubTimelineFilterType')}
        >
          <option value="">{t('workspace.projectHubTimelineFilterType')}</option>
          {TYPE_FILTERS.map((id) => (
            <option key={id} value={id}>
              {t(TYPE_LABEL_KEYS[id])}
            </option>
          ))}
        </select>
        <select
          className={`${HUB_TL_SELECT} max-w-[8rem]`}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label={t('workspace.projectHubTimelineFilterStatus')}
        >
          <option value="">{t('workspace.projectHubTimelineFilterStatus')}</option>
          {STATUS_FILTERS.map((id) => (
            <option key={id} value={id}>
              {t(STATUS_LABEL_KEYS[id])}
            </option>
          ))}
        </select>
        <div
          className="hidden items-center gap-1 sm:flex"
          role="list"
          aria-label={t('workspace.projectHubTimelineLegendAria')}
        >
          {TIMELINE_LEGEND.map((item) => (
            <span key={item.key} className={HUB_TL_LEGEND_CHIP} role="listitem" title={t(item.labelKey)}>
              <span
                className={`h-2 w-2 shrink-0 rounded-sm ${
                  item.kind === 'type'
                    ? timelineWorkTypeBarClass(item.workType)
                    : timelineStatusDotClass({ bucket: item.bucket, dueTone: item.dueTone })
                }`}
                aria-hidden
              />
              <span className="hidden xl:inline">{t(item.labelKey)}</span>
            </span>
          ))}
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <button
            type="button"
            className={HUB_TL_ICON_BTN}
            onClick={jumpToSchedule}
            disabled={!canJumpToSchedule}
            title={t('workspace.projectHubTimelineJumpSchedule')}
            aria-label={t('workspace.projectHubTimelineJumpScheduleAria')}
          >
            <CalendarRange size={14} aria-hidden />
          </button>
          <button
            type="button"
            className={HUB_TL_ICON_BTN}
            onClick={centerToday}
            title={t('workspace.projectHubTimelineToday')}
            aria-label={t('workspace.projectHubTimelineTodayAria')}
          >
            <Crosshair size={14} aria-hidden />
          </button>
          <button
            type="button"
            className={HUB_TL_ICON_BTN}
            onClick={fitTimeline}
            title={t('workspace.projectHubTimelineFit')}
            aria-label={t('workspace.projectHubTimelineFitAria')}
          >
            <Maximize2 size={14} aria-hidden />
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="flex shrink-0 flex-col border-r border-border bg-surface" style={{ width: WORK_COL_PX }}>
          <div className={HUB_TL_WORK_HEAD} style={{ height: HEADER_PX }}>
            {t('workspace.projectHubTimelineWork')}
          </div>
          <div ref={leftRef} className="scrollbar-overlay min-h-0 flex-1 overflow-y-auto" onScroll={syncFromLeft}>
            {planningLoading && !flatRows.length ? (
              <p className={`px-3 py-4 text-xs ${muted}`}>{t('common.loading')}</p>
            ) : null}
            {!planningLoading && !flatRows.length ? (
              <p className={`px-3 py-4 text-xs ${muted}`}>{t('workspace.projectHubTimelineEmpty')}</p>
            ) : null}
            {flatRows.map(({ node, depth }, index) => {
              const raw = node.raw || {};
              const canExpand = Array.isArray(node.children) && node.children.length > 0;
              const expanded = expandedIds.has(node.id);
              const bucket = nodeStatusBucket(node, lists);
              const assignee = resolveAssignee(raw);
              const stats =
                node.kind === 'planning'
                  ? childWorkStats(cards, entityId(raw), lists, node.workType)
                  : { total: 0, done: 0 };
              const pct = childWorkProgressPct(stats.done, stats.total);
              const hovered = hoveredRowId === node.id;
              const rangeItem = rangeForTimelineNode(node);
              const statusLabel = t(STATUS_LABEL_KEYS[bucket] || STATUS_LABEL_KEYS.todo);
              return (
                <div
                  key={node.id}
                  className={`relative flex items-center gap-1 border-b border-border/50 px-1.5 transition-colors motion-reduce:transition-none ${nodeRowToneClass(index, hovered)}`}
                  style={{ height: TIMELINE_ROW_PX, paddingLeft: 6 + depth * 10 }}
                  onMouseEnter={() => setHoveredRowId(node.id)}
                  onMouseLeave={() => setHoveredRowId((id) => (id === node.id ? null : id))}
                >
                  {canExpand ? (
                    <button
                      type="button"
                      className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors motion-reduce:transition-none hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-expanded={expanded}
                      onClick={() => toggleExpand(node.id)}
                    >
                      {expanded ? <ChevronDown size={13} aria-hidden /> : <ChevronRight size={13} aria-hidden />}
                    </button>
                  ) : (
                    <span className="w-3.5 shrink-0" aria-hidden />
                  )}
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-1 text-left rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => setDetailIssue(raw)}
                    title={
                      rangeItem
                        ? `${displayIssueKey(projectCode, entityId(raw))} · ${formatHubDate(rangeItem.start, locale)} – ${formatHubDate(rangeItem.end, locale)}`
                        : undefined
                    }
                  >
                    <ProjectHubIssueTypeBadge
                      type={node.workType}
                      variant="icon"
                      label={t(TYPE_LABEL_KEYS[node.workType] || TYPE_LABEL_KEYS.task)}
                    />
                    <span className={`min-w-0 flex-1 truncate text-[11px] font-semibold leading-tight ${titleCls}`}>
                      <span className="mr-1 font-mono text-[10px] font-bold text-primary">
                        {displayIssueKey(projectCode, entityId(raw))}
                      </span>
                      {node.title}
                    </span>
                    {!rangeItem ? (
                      <span className="sr-only">{t('workspace.projectHubTimelineUnscheduled')}</span>
                    ) : null}
                  </button>
                  <span
                    className={`h-2 w-2 shrink-0 rounded-sm ${nodeStatusDot(node, lists)}`}
                    title={statusLabel}
                    aria-label={statusLabel}
                  />
                  {assignee ? (
                    <UserAvatar name={assignee.name} avatar={assignee.avatar} userId={assignee.userId} size="xs" />
                  ) : null}
                  {node.workType === 'epic' && stats.total > 0 ? (
                    <span
                      className="pointer-events-none absolute bottom-0 left-6 right-1.5 h-0.5 overflow-hidden rounded bg-muted"
                      style={{ marginLeft: depth * 10 }}
                    >
                      <span
                        className={`block h-full ${childWorkProgressBarClass(stats)}`}
                        style={{ width: `${pct}%` }}
                      />
                    </span>
                  ) : null}
                </div>
              );
            })}
            {hubCaps?.canCreateEpic ? (
              <TimelineCreateEpic busy={createBusy} onCreate={createEpic} t={t} />
            ) : null}
          </div>
        </div>

        <div className="relative min-h-0 min-w-0 flex-1">
          <div
            ref={rightRef}
            className="scrollbar-overlay absolute inset-0 overflow-auto"
            onScroll={onRightScroll}
            onWheel={onTimelineWheel}
          >
            <div className="relative" style={{ width: Math.max(totalWidth, 1), minHeight: '100%' }}>
              <div
                className={`${HUB_TL_GANTT_HEAD} ${headerDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                style={{ height: HEADER_PX }}
                role="presentation"
                title={t('workspace.projectHubTimelineHeaderDragHint')}
                onPointerDown={onHeaderPointerDown}
                onPointerMove={onHeaderPointerMove}
                onPointerUp={onHeaderPointerUp}
                onPointerCancel={onHeaderPointerUp}
              >
                {showWeeksHeader ? (
                  <>
                    <div className="flex h-[18px] border-b border-border text-[10px] font-bold uppercase tracking-wide text-foreground/80">
                      {groups.map((g) => (
                        <div
                          key={g.key}
                          className="flex items-center border-r border-border/60 px-1.5"
                          style={{ width: g.widthPx }}
                        >
                          {groupHeaderLabel(g, locale)}
                        </div>
                      ))}
                    </div>
                    <div className="flex h-[22px] text-[9px] font-medium text-muted-foreground">
                      {columns.map((col) => {
                        const isToday = isSameLocalDay(col.start, today);
                        const isMajor = isMajorTimelineGridColumn(col);
                        const label = columnHeaderLabel(col, locale);
                        const dayW = Number(pxPerUnit) || 0;
                        const showDayNum = dayW >= TIMELINE_DAY_LABEL_NUM_MIN_PX;
                        const showTodayChip = timelineTodayShowsChip(dayW);
                        /** Đủ chỗ mới ghép số ngày + chip; hẹp thì chỉ một trong hai — không đè chữ thứ. */
                        const showTodayBadge = isToday && (showDayNum || showTodayChip);
                        const showTodayNum = showTodayBadge && showDayNum && (!showTodayChip || dayW >= 64);
                        const showTodayLabel = showTodayBadge && showTodayChip;
                        return (
                          <div
                            key={col.key}
                            className={`flex items-center justify-center overflow-hidden px-0.5 ${
                              isMajor ? 'border-l border-border/25' : ''
                            } ${isToday ? 'bg-primary/5 font-bold text-primary' : ''}`}
                            style={{ width: col.widthPx }}
                            title={
                              isToday
                                ? t('workspace.projectHubTimelineTodayMarkerAria', {
                                    day: today.getDate(),
                                  })
                                : label || undefined
                            }
                          >
                            {showTodayBadge ? (
                              <span className="flex max-w-full items-center justify-center gap-0.5">
                                {showTodayNum ? (
                                  <span className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold leading-none text-primary-foreground shadow-sm">
                                    {today.getDate()}
                                  </span>
                                ) : null}
                                {showTodayLabel ? (
                                  <span className="truncate rounded bg-primary px-1.5 py-0.5 text-[9px] font-semibold leading-none text-primary-foreground shadow-sm">
                                    {t('workspace.projectHubTimelineTodayChip')}
                                  </span>
                                ) : !showTodayNum ? (
                                  <span className="truncate">{label}</span>
                                ) : null}
                              </span>
                            ) : (
                              <span className="truncate">{label}</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div className="flex h-full text-[11px] font-bold text-foreground/80">
                    {columns.map((col) => (
                      <div
                        key={col.key}
                        className="flex items-center border-r border-border/50 px-2"
                        style={{ width: col.widthPx }}
                      >
                        {columnHeaderLabel(col, locale)}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="relative bg-gradient-to-b from-muted/40 to-surface" style={{ height: bodyH }}>
                {scale === 'weeks'
                  ? columns.map((col, i) => {
                      const left = columnOffsets[i]?.left ?? 0;
                      const isToday = isSameLocalDay(col.start, today);
                      if (isWeekendColumn(col)) {
                        return (
                          <div
                            key={`wknd-${col.key}`}
                            className="pointer-events-none absolute top-0 bottom-0 bg-muted/40"
                            style={{ left, width: col.widthPx, ...WEEKEND_HATCH_STYLE }}
                          />
                        );
                      }
                      if (isToday) {
                        return (
                          <div
                            key={`today-tint-${col.key}`}
                            className="pointer-events-none absolute top-0 bottom-0 bg-primary/15"
                            style={{ left, width: col.widthPx }}
                          />
                        );
                      }
                      return null;
                    })
                  : null}
                {columns.map((col, i) => {
                  const left = columnOffsets[i]?.left ?? 0;
                  const major = isMajorTimelineGridColumn(col);
                  return (
                    <div
                      key={`grid-${col.key}`}
                      className={`pointer-events-none absolute top-0 bottom-0 border-l ${
                        major ? 'border-border/60' : 'border-border/25'
                      }`}
                      style={{ left }}
                    />
                  );
                })}
                {(sprints || []).map((sprint) => {
                  const place = sprintBarPlacement(sprint, columns);
                  if (!place) return null;
                  return (
                    <div
                      key={entityId(sprint) || sprint.name}
                      className="pointer-events-none absolute top-0 bottom-0 bg-success/20"
                      style={{ left: place.left, width: place.width }}
                      title={String(sprint.name || '')}
                    >
                      <div className="absolute inset-x-0 top-0 h-1 bg-success" />
                    </div>
                  );
                })}
                {todayX != null ? (
                  <div
                    className="pointer-events-none absolute top-0 z-10 w-0.5 bg-primary shadow-[0_0_8px_rgba(37,99,235,0.45)]"
                    style={{ left: todayX, height: bodyH }}
                    aria-hidden
                  >
                    {overlappingSprints.length ? (
                      <span className="absolute left-1 top-1 max-w-[12rem] truncate rounded bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground shadow-sm">
                        {overlappingSprints.map((s) => s.name).filter(Boolean).join(', ')}
                      </span>
                    ) : null}
                  </div>
                ) : null}
                <span className="sr-only">
                  {todayX != null
                    ? t('workspace.projectHubTimelineTodayMarkerAria', { day: today.getDate() })
                    : null}
                </span>
                {flatRows.map(({ node }, index) => {
                  const rangeItem = rangeForTimelineNode(node);
                  const place = rangeItem
                    ? barPlacement(rangeItem.start, rangeItem.end, columns, { minBarPx })
                    : null;
                  if (!place) {
                    const hovered = hoveredRowId === node.id;
                    return (
                      <div
                        key={`bar-${node.id}`}
                        className={`absolute left-0 right-0 border-b border-border/30 ${nodeRowToneClass(index, hovered)}`}
                        style={{ top: index * TIMELINE_ROW_PX, height: TIMELINE_ROW_PX }}
                        onMouseEnter={() => setHoveredRowId(node.id)}
                        onMouseLeave={() => setHoveredRowId((id) => (id === node.id ? null : id))}
                      />
                    );
                  }
                  const raw = node.raw || {};
                  const issueKey = displayIssueKey(projectCode, entityId(raw));
                  const startLabel = formatHubDate(rangeItem.start, locale);
                  const endLabel = formatHubDate(rangeItem.end, locale);
                  const tooltip = `${issueKey} · ${node.title || ''} · ${startLabel} – ${endLabel}`;
                  const hovered = hoveredRowId === node.id;
                  const assignee = resolveAssignee(raw);
                  const labelOutside = timelineBarLabelOutside(place.width, columns[0]?.widthPx);
                  const epicStats =
                    node.workType === 'epic'
                      ? childWorkStats(cards, entityId(raw), lists, node.workType)
                      : null;
                  const epicPct =
                    epicStats && epicStats.total > 0
                      ? childWorkProgressPct(epicStats.done, epicStats.total)
                      : null;
                  /** Trong bar chỉ key — title nằm tooltip; ngoài bar chỉ avatar (bớt nhiễu). */
                  const innerLabel = issueKey;
                  return (
                    <div
                      key={`bar-${node.id}`}
                      className={`absolute left-0 right-0 border-b border-border/30 ${nodeRowToneClass(index, hovered)}`}
                      style={{ top: index * TIMELINE_ROW_PX, height: TIMELINE_ROW_PX }}
                      onMouseEnter={() => setHoveredRowId(node.id)}
                      onMouseLeave={() => setHoveredRowId((id) => (id === node.id ? null : id))}
                    >
                      <button
                        type="button"
                        className={`absolute flex items-center overflow-hidden rounded-md shadow-md ring-1 ring-inset ring-white/25 transition-[filter,transform] motion-reduce:transition-none hover:brightness-110 hover:saturate-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${nodeBarClass(node, lists)} ${nodeBarForegroundClass(node, lists)}`}
                        style={{
                          left: place.left,
                          width: place.width,
                          top: BAR_TOP_PX,
                          height: BAR_H_PX,
                        }}
                        title={tooltip}
                        aria-label={tooltip}
                        onClick={() => setDetailIssue(raw)}
                      >
                        {epicPct != null ? (
                          <span
                            className="pointer-events-none absolute inset-x-0 bottom-0 h-1 bg-background/30"
                            aria-hidden
                          >
                            <span
                              className="block h-full bg-primary-foreground/90"
                              style={{ width: `${epicPct}%` }}
                            />
                          </span>
                        ) : null}
                        {!labelOutside ? (
                          <span
                            className="relative z-[1] min-w-0 truncate px-2 text-left font-mono text-[10px] font-bold tracking-tight"
                            style={{ lineHeight: `${BAR_H_PX}px` }}
                          >
                            {innerLabel}
                          </span>
                        ) : null}
                      </button>
                      {assignee ? (
                        <span
                          className="pointer-events-none absolute flex items-center"
                          style={{ left: place.left + place.width + 6, top: BAR_TOP_PX, height: BAR_H_PX }}
                        >
                          <UserAvatar
                            name={assignee.name}
                            avatar={assignee.avatar}
                            userId={assignee.userId}
                            size="xs"
                          />
                        </span>
                      ) : labelOutside ? (
                        <span
                          className="pointer-events-none absolute flex items-center pl-1"
                          style={{ left: place.left + place.width + 4, top: BAR_TOP_PX, height: BAR_H_PX }}
                        >
                          <span className="truncate font-mono text-[10px] font-semibold text-muted-foreground">
                            {innerLabel}
                          </span>
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          {showPartialEmptyOverlay ? (
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex items-center justify-center px-4"
              style={{ top: HEADER_PX }}
              role="status"
            >
              <p className="max-w-sm rounded-md border border-dashed border-border bg-surface/95 px-3 py-2.5 text-center text-[11px] leading-snug text-muted-foreground shadow-sm">
                {t('workspace.projectHubTimelineNoScheduled')}
              </p>
            </div>
          ) : null}
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-3 left-1/2 z-30 -translate-x-1/2">
        <div
          className="pointer-events-auto flex items-center gap-0.5 rounded-lg border border-border bg-surface px-1 py-0.5 shadow-lg ring-1 ring-primary/15"
          role="group"
          aria-label={t('workspace.projectHubTimelineScaleAria')}
        >
          <button
            type="button"
            className={iconBtn}
            onClick={() => zoomTimelineStep(-1)}
            aria-label={t('workspace.projectHubTimelineZoomOut')}
          >
            <Minus size={14} aria-hidden />
          </button>
          {TIMELINE_SCALES.map((id) => {
            const active = scale === id;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={active}
                onClick={() => setScale(id)}
                className={`rounded-md px-2.5 py-1 text-[11px] font-bold transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  active
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                {t(SCALE_LABEL_KEYS[id])}
              </button>
            );
          })}
          <button
            type="button"
            className={iconBtn}
            onClick={() => zoomTimelineStep(1)}
            aria-label={t('workspace.projectHubTimelineZoomIn')}
          >
            <Plus size={14} aria-hidden />
          </button>
        </div>
      </div>

      <WorkItemDetail
        key="timeline-work-item-detail"
        open={Boolean(detailIssue)}
        chrome="drawer"
        drawerLayout="overlay"
        isDarkMode={isDarkMode}
        workspaceSlug={workspaceSlug}
        workItem={detailIssue}
        boardId={boardId}
        lists={lists}
        boardCards={cards}
        epics={epics}
        features={features}
        sprints={sprints}
        workTypeConfig={workTypeConfig}
        priorityConfig={projectPayload?.priorityConfig}
        projectCode={projectCode}
        projectId={projectId}
        defaultListId={defaultListId}
        apiCtx={apiCtx}
        locale={locale}
        initialPanel="detail"
        canCreateTask={Boolean(hubCaps?.canCreateTask)}
        canEstimate={Boolean(hubCaps?.canEstimate)}
        canComment={Boolean(
          Array.isArray(hubCaps?.permissions) && hubCaps.permissions.includes('task:comment')
        )}
        canUpdateTask={Boolean(
          Array.isArray(hubCaps?.permissions) && hubCaps.permissions.includes('task:update')
        )}
        canChangeStatus={Boolean(
          Array.isArray(hubCaps?.permissions) &&
            hubCaps.permissions.includes('task:change_status')
        )}
        onClose={() => setDetailIssue(null)}
        onOpenWorkItem={(card) => {
          if (card) setDetailIssue(card);
        }}
        onRefresh={onRefresh}
        onPatchBoardCards={onPatchBoardCards}
        onPatchPlanningItems={(updater) => {
          onPatchPlanningItems?.(updater);
          setDetailIssue((prev) => {
            if (!prev) return prev;
            const nextList = updater([prev]);
            const hit = (Array.isArray(nextList) ? nextList : []).find(
              (row) => String(row._id || row.id) === String(prev._id || prev.id)
            );
            return hit ? { ...prev, ...hit } : prev;
          });
        }}
        onUpdateCard={async (cardId, patch) => {
          await onUpdateCard?.(cardId, patch);
          setDetailIssue((prev) =>
            prev && String(prev._id) === String(cardId) ? { ...prev, ...patch } : prev
          );
        }}
      />
    </div>
  );
}
