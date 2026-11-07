import { cloneElement, isValidElement, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ExternalLink, FileText, Loader2 } from 'lucide-react';
import { VH_MOTION_BTN, VH_MOTION_CARD, VH_MOTION_SPINNER } from '../../../motion/classes';

import toast from 'react-hot-toast';
import { useAppStrings } from '../../../locales/appStrings';
import { projectAPI } from '../../../services/api/projectAPI';
import { taskAPI } from '../../../services/api/taskAPI';
import { resolveApiErrorMessage } from '../../../utils/resolveApiErrorMessage';
import { repairUtf8Mojibake } from '../../../utils/utf8Mojibake';
import { isProjectCompletedStatus, resolveHubCapabilities } from './hubCaps';
import { resolveOverviewVisibility } from './overviewVisibility';
import ProjectHubMembersPanel from './ProjectHubMembersPanel';
import ProjectHubSettingsPanel from './ProjectHubSettingsPanel';
import ProjectHubPlanningPanel from './ProjectHubPlanningPanel';
import ProjectHubListPanel from './ProjectHubListPanel';
import ProjectHubTimelinePanel from './ProjectHubTimelinePanel';
import ProjectHubChangeRequestsPanel from './ProjectHubChangeRequestsPanel';
import ProjectHubExecutionControlPanel from './ExecutionControl/ProjectHubExecutionControlPanel';
import ProjectHubTestCasesPanel from './ProjectHubTestCasesPanel';
import WorkItemDetail from './WorkItemDetail';
import ProjectChatWorkspace from '../chat/ProjectChatWorkspace';
import ProjectHubCompleteSprintModal from './ProjectHubCompleteSprintModal';
import ProjectHubCompleteProjectModal from './ProjectHubCompleteProjectModal';
import ProjectHubArchiveProjectModal from './ProjectHubArchiveProjectModal';
import ProjectHubOverviewPanel from './ProjectHubOverviewPanel';
import {
  HUB_BADGE_CODE,
  HUB_BADGE_META,
  HUB_BADGE_PHASE,
  HUB_EMPTY,
  HUB_HEADER,
  HUB_HEADER_ROW,
  HUB_HINT,
  HUB_ICON_BTN,
  HUB_MUTED,
  HUB_TAB_ACTIVE,
  HUB_TAB_DISABLED,
  HUB_TAB_IDLE,
  HUB_TITLE,
} from './projectHubUiClasses';
import { lazyWithRetry } from '../../../utils/lazyWithRetry';

const ProjectClosureReportPage = lazyWithRetry(() => import('./reports/ProjectClosureReportPage'));
import useSprintAutoCompletePrompt from './useSprintAutoCompletePrompt';
import { isBoardSprintReady } from './projectHubHierarchy';
import { buildProjectsPickerPath, isProjectChatTabEnabled } from '../../../utils/suitePathUtils';
import { writeStoredLastProjectId } from '../picker/projectPickerRemember';
import {
  PROJECT_HUB_TABS,
  buildOverviewDashboardCharts,
  chartsFromOverviewApi,
  collectCardActivity,
  collectCardAttachments,
  computeHubBoardSummary,
  countCardsByIssueType,
  countCardsInSprint,
  countPlanningByType,
  countUnassignedOpenCards,
  formatHubDate,
  formatHubMethodology,
  hubOverviewAggregateEnabled,
  listHubHealthCards,
  mapHubActivityItem,
  pickNextHubActions,
  projectInitials,
  resolveViewerActiveSprint,
  sumOpenCardEstimateHours,
} from './projectHubUtils';
import {
  coerceDeliveryPhase,
  deliveryPhaseLabelKey,
  isClosedProjectStatus,
} from '../../../utils/projectPhaseNav';
import {
  useInvalidateProjectHub,
  useProjectHubMembers,
  useProjectHubOverview,
  useProjectHubPlanningItems,
  useProjectHubProject,
  useProjectHubSprints,
} from './useProjectHubQueries';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../../lib/queryKeys';

function FilesPanel({ files, t }) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-surface px-4 py-4 sm:px-5">
      <h3 className={HUB_TITLE}>{t('workspace.projectHubTabFiles')}</h3>
      {files.length === 0 ? (
        <p className={HUB_EMPTY}>{t('workspace.projectHubFilesEmpty')}</p>
      ) : (
        <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto">
          {files.map((f) => (
            <li
              key={f.id}
              className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5"
            >
              <FileText size={16} className="shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-foreground">{f.name}</div>
                <div className={`truncate text-[11px] ${HUB_MUTED}`}>{f.cardTitle || '—'}</div>
              </div>
              {f.url ? (
                <a
                  href={f.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 rounded-lg border border-border p-1.5 text-muted-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <ExternalLink size={14} />
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const ACTIVITY_PAGE_SIZE = 10;

function ActivityPanel({ activity, locale, t }) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil((activity.length || 0) / ACTIVITY_PAGE_SIZE) || 1);
  const safePage = Math.min(Math.max(1, page), totalPages);
  const paged = activity.slice((safePage - 1) * ACTIVITY_PAGE_SIZE, safePage * ACTIVITY_PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [activity.length]);

  useEffect(() => {
    if (page !== safePage) setPage(safePage);
  }, [page, safePage]);

  return (
    <div className="scrollbar-overlay min-h-0 flex-1 overflow-y-auto bg-surface px-4 py-4 sm:px-5">
      <h3 className={HUB_TITLE}>{t('workspace.projectHubTabActivity')}</h3>
      {activity.length === 0 ? (
        <p className={HUB_EMPTY}>{t('workspace.projectHubActivityEmpty')}</p>
      ) : (
        <>
          <ul className="space-y-2">
            {paged.map((a) => (
              <li key={a.id} className={`rounded-xl border border-border bg-surface px-3 py-2.5 ${VH_MOTION_CARD}`}>
                <div className="text-sm font-semibold text-foreground">{a.title}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {a.actorName ? (
                    <>
                      <span className="text-foreground">{a.actorName}</span>
                      {' · '}
                    </>
                  ) : null}
                  {formatHubDate(a.at, locale)}
                  {a.detail ? ` · ${a.detail}` : ''}
                  {!a.actorName && a.assigneeName ? ` · ${a.assigneeName}` : ''}
                </div>
              </li>
            ))}
          </ul>
          {activity.length > ACTIVITY_PAGE_SIZE ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted disabled:opacity-40 ${VH_MOTION_BTN}`}
                aria-label={t('workspace.projectHubActivityPrev')}
              >
                <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
                {t('workspace.projectHubActivityPrev')}
              </button>
              <span className="text-xs text-muted-foreground" aria-live="polite">
                {t('workspace.projectHubActivityPage', { page: safePage, total: totalPages })}
              </span>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted disabled:opacity-40 ${VH_MOTION_BTN}`}
                aria-label={t('workspace.projectHubActivityNext')}
              >
                {t('workspace.projectHubActivityNext')}
                <ChevronRight className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

/**
 * Project Hub — header identity + tabs (Figma IA).
 * `boardSlot` = Kanban (TaskBoardWorkspacePanel) khi tab board.
 */
export default function ProjectHubShell({
  board = null,
  boardId = '',
  projectId: projectIdProp = '',
  boardDetail = null,
  loadingBoardDetail = false,
  /** True while project boards list is still resolving (avoid “chọn bảng” flash). */
  loadingBoards = false,
  boards = [],
  isDarkMode = false,
  locale = 'vi',
  canManage = false,
  organizationId = '',
  apiCtx = null,
  onRefresh,
  onUpdateCard = null,
  onPatchBoardCards = null,
  workspaceSlug = '',
  boardSlot = null,
  emptySlot = null,
  onBack = null,
  onBoardChange: _onBoardChange = null,
  currentUserId = '',
  onNeedFullBoardCards = null,
  boardCardsReady = true,
  /** Controlled module from suite menu (hub tab id). */
  activeModule = null,
  /** Hide internal tab bar when suite sidebar owns navigation. */
  hideTabBar = false,
  /** Called instead of setTab when hideTabBar (navigate suite menu). */
  onModuleChange = null,
}) {
  const { t } = useAppStrings();
  const navigate = useNavigate();
  const [tab, setTabState] = useState(() =>
    activeModule && typeof activeModule === 'string' ? activeModule : 'overview'
  );
  const setTab = useCallback(
    (next) => {
      const id = String(next || 'overview').trim() || 'overview';
      if (hideTabBar && typeof onModuleChange === 'function') {
        onModuleChange(id);
        return;
      }
      setTabState(id);
    },
    [hideTabBar, onModuleChange]
  );

  useEffect(() => {
    if (!activeModule) return;
    const id = String(activeModule).trim();
    if (id && id !== tab) setTabState(id);
  }, [activeModule]);

  const [visitedTabs, setVisitedTabs] = useState(() => ({}));
  const prevHubProjectIdRef = useRef('');
  const [membersEpoch, setMembersEpoch] = useState(0);
  const [apiActivity, setApiActivity] = useState(null);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState(false);
  const [activityRestricted, setActivityRestricted] = useState(false);
  const [activityReloadToken, setActivityReloadToken] = useState(0);
  const [apiFiles, setApiFiles] = useState(null);
  const queryClient = useQueryClient();
  const invalidateProjectHub = useInvalidateProjectHub();
  const activityLoadedForRef = useRef('');
  const filesLoadedForRef = useRef('');
  const [completeSprintId, setCompleteSprintId] = useState(null);
  const [completeProjectOpen, setCompleteProjectOpen] = useState(false);
  const [archiveProjectOpen, setArchiveProjectOpen] = useState(false);
  const [boardOpenCrId, setBoardOpenCrId] = useState('');
  const [crWorkIssue, setCrWorkIssue] = useState(null);
  const [overviewWorkIssue, setOverviewWorkIssue] = useState(null);
  const [hubChatChannelId, setHubChatChannelId] = useState('');

  const resolvedBoard = useMemo(() => {
    if (boardDetail?.board) return boardDetail.board;
    if (board) return board;
    return boards.find((b) => String(b._id) === String(boardId)) || null;
  }, [board, boardDetail?.board, boards, boardId]);

  const projectId = String(
    projectIdProp ||
      resolvedBoard?.projectId ||
      boards.find((b) => String(b._id) === String(boardId))?.projectId ||
      ''
  ).trim();

  const useOverviewAggregate = hubOverviewAggregateEnabled();
  const {
    data: overviewPayload = null,
    isLoading: overviewLoading,
    refetch: refetchOverview,
  } = useProjectHubOverview(projectId, {
    // Overview tab needs full payload; other tabs reuse summary for header % when board cards chưa hydrate.
    enabled: useOverviewAggregate && Boolean(projectId),
  });
  const { data: projectQueryData = null } = useProjectHubProject(projectId);
  const projectPayload = projectQueryData ?? overviewPayload?.project ?? null;
  // Fail-closed: không mở CTA manage khi thiếu capabilities payload (tránh canManage fallback lệch role).
  const hubCaps = useMemo(
    () => resolveHubCapabilities(projectPayload, { canManageFallback: false }),
    [projectPayload]
  );

  if (prevHubProjectIdRef.current !== projectId) {
    prevHubProjectIdRef.current = projectId;
    // When hideTabBar, URL/activeModule is source of truth — do not call setTab
    // (that would onModuleChange → navigate to overview and break deep-links).
    const nextTab =
      hideTabBar && activeModule && typeof activeModule === 'string'
        ? String(activeModule).trim() || 'overview'
        : 'overview';
    if (hideTabBar) {
      setTabState(nextTab);
    } else {
      setTab('overview');
    }
    setVisitedTabs({ [nextTab]: true });
    setApiActivity(null);
    setActivityLoading(false);
    setActivityError(false);
    setActivityRestricted(false);
    setActivityReloadToken(0);
    setApiFiles(null);
    activityLoadedForRef.current = '';
    filesLoadedForRef.current = '';
    setCompleteProjectOpen(false);
    setArchiveProjectOpen(false);
    setOverviewWorkIssue(null);
    setHubChatChannelId('');
  }

  const cards = Array.isArray(boardDetail?.cards) ? boardDetail.cards : [];
  const lists = useMemo(() => {
    const raw = Array.isArray(boardDetail?.lists) ? boardDetail.lists : [];
    return raw.map((list) => {
      const title = repairUtf8Mojibake(list?.title);
      return title === list?.title ? list : { ...list, title };
    });
  }, [boardDetail?.lists]);
  const summary = useMemo(() => {
    // Prefer live board cards — Overview API can lag / use stale card.status.
    if (Array.isArray(cards) && cards.length > 0) {
      return computeHubBoardSummary(cards, lists);
    }
    if (overviewPayload?.summary) return overviewPayload.summary;
    const progressRaw = Number(
      projectPayload?.progressPercent ?? projectPayload?.progress ?? NaN
    );
    if (Number.isFinite(progressRaw)) {
      const donePercent = Math.max(0, Math.min(100, Math.round(progressRaw)));
      return { total: 1, done: donePercent >= 100 ? 1 : 0, donePercent, overdue: 0, inReview: 0 };
    }
    if (
      isProjectCompletedStatus(projectPayload?.status || resolvedBoard?.status)
    ) {
      return { total: 1, done: 1, donePercent: 100, overdue: 0, inReview: 0 };
    }
    return computeHubBoardSummary(cards, lists);
  }, [
    overviewPayload?.summary,
    cards,
    lists,
    projectPayload?.progressPercent,
    projectPayload?.progress,
    projectPayload?.status,
    resolvedBoard?.status,
  ]);
  const overdueHealthCards = useMemo(() => {
    if (Array.isArray(cards) && cards.length > 0) {
      return listHubHealthCards(cards, lists, 'overdue', { limit: 8 });
    }
    if (overviewPayload?.healthPreview?.overdue?.length) {
      return overviewPayload.healthPreview.overdue;
    }
    return listHubHealthCards(cards, lists, 'overdue', { limit: 8 });
  }, [overviewPayload?.healthPreview?.overdue, cards, lists]);
  const inReviewHealthCards = useMemo(() => {
    if (Array.isArray(cards) && cards.length > 0) {
      return listHubHealthCards(cards, lists, 'inReview', { limit: 8 });
    }
    if (overviewPayload?.healthPreview?.inReview?.length) {
      return overviewPayload.healthPreview.inReview;
    }
    return listHubHealthCards(cards, lists, 'inReview', { limit: 8 });
  }, [overviewPayload?.healthPreview?.inReview, cards, lists]);
  const isProjectCompleted = isProjectCompletedStatus(
    projectPayload?.status || resolvedBoard?.status
  );
  const isDraftProject =
    String(projectPayload?.status || resolvedBoard?.status || '')
      .trim()
      .toLowerCase() === 'draft';
  const workLooksComplete = summary.total > 0 && summary.donePercent === 100;
  const informationLevel = String(
    projectPayload?.access?.informationLevel ||
      resolvedBoard?.access?.informationLevel ||
      boardDetail?.access?.informationLevel ||
      ''
  ).toLowerCase();
  const capsReady = Boolean(projectId && projectPayload);
  const overviewVisibility = useMemo(
    () => resolveOverviewVisibility(hubCaps, { informationLevel, capsReady }),
    [hubCaps, informationLevel, capsReady]
  );
  const { data: rosterMembers = [] } = useProjectHubMembers(projectId, {
    enabled:
      Boolean(projectId) &&
      hubCaps.canViewMembers &&
      (tab === 'members' ||
        Boolean(visitedTabs.members) ||
        tab === 'changeRequests' ||
        Boolean(visitedTabs.changeRequests)),
  });
  const isSummaryOnly = informationLevel === 'summary';
  const needsPlanningItems =
    Boolean(hubCaps.canViewBacklog) &&
    (tab === 'planning' || tab === 'timeline' || tab === 'board' || tab === 'list');
  const needsActivity =
    (tab === 'overview' && overviewVisibility.canViewActivity) ||
    (tab === 'activity' && hubCaps.canViewActivityTab);
  const needsFiles = tab === 'files' && hubCaps.canViewFiles;
  // Page-scoped: sprints theo tab hiện tại (không sticky visitedTabs.board).
  const needsSprints =
    Boolean(hubCaps.canViewSprints) &&
    (tab === 'board' ||
      tab === 'list' ||
      tab === 'timeline' ||
      (tab === 'overview' &&
        capsReady &&
        (overviewVisibility.canViewSprintContext || Boolean(hubCaps.canCompleteProject))));

  const needsChartWorkItems = tab === 'overview' && overviewVisibility.canViewTaskMetrics;
  const chartWorkItemsLoading = needsChartWorkItems && !boardCardsReady;

  useEffect(() => {
    if (
      (tab === 'board' || tab === 'list' || tab === 'timeline' || needsChartWorkItems) &&
      typeof onNeedFullBoardCards === 'function'
    ) {
      onNeedFullBoardCards();
    }
  }, [tab, needsChartWorkItems, onNeedFullBoardCards]);

  const {
    data: sprints = [],
    isPending: sprintsPending,
    isFetching: sprintsFetching,
    isFetched: sprintsFetched,
    isError: sprintsError,
    refetch: refetchSprints,
  } = useProjectHubSprints(projectId, { enabled: Boolean(projectId) && needsSprints });

  const {
    data: planningItems = [],
    isPending: planningPending,
    isError: planningError,
    refetch: refetchPlanning,
  } = useProjectHubPlanningItems(projectId, {
    enabled: Boolean(projectId) && needsPlanningItems,
  });

  const sprintsHydrated =
    !needsSprints ||
    (Boolean(projectId) && (sprintsFetched || sprintsError || !sprintsPending));
  const planningLoading = Boolean(projectId) && needsPlanningItems && planningPending;

  const patchPlanningItems = useCallback(
    (updater) => {
      const pid = String(projectId || '').trim();
      if (!pid) return;
      queryClient.setQueryData(queryKeys.projectHub.planningItems(pid), (prev) => {
        const current = Array.isArray(prev) ? prev : [];
        return typeof updater === 'function' ? updater(current) : current;
      });
    },
    [projectId, queryClient]
  );

  const reloadPlanning = useCallback(async () => {
    const pid = String(projectId || '').trim();
    if (!pid) return;
    await queryClient.invalidateQueries({ queryKey: queryKeys.projectHub.planningItems(pid) });
    await refetchPlanning();
  }, [projectId, queryClient, refetchPlanning]);

  const reloadSprints = useCallback(async () => {
    const pid = String(projectId || '').trim();
    if (!pid) return;
    await queryClient.invalidateQueries({ queryKey: queryKeys.projectHub.sprints(pid) });
    await refetchSprints();
  }, [projectId, queryClient, refetchSprints]);

  const boardReady = useMemo(() => isBoardSprintReady(sprints), [sprints]);
  const cardsForSprintResolve = useMemo(
    () => (Array.isArray(boardDetail?.cards) ? boardDetail.cards : []),
    [boardDetail?.cards]
  );
  const activeSprint = useMemo(
    () =>
      resolveViewerActiveSprint({
        sprints,
        cards: cardsForSprintResolve,
        userId: currentUserId,
      }),
    [sprints, cardsForSprintResolve, currentUserId]
  );

  useSprintAutoCompletePrompt(sprints, {
    enabled: Boolean(hubCaps?.canManageSprints) && Boolean(projectId),
    onPromptComplete: (sprintId) => {
      const id = String(sprintId || '').trim();
      if (!id) return;
      setCompleteSprintId(id);
    },
  });

  const sprintFilterId =
    boardReady && activeSprint?._id ? String(activeSprint._id) : '';

  const boardKanban = isValidElement(boardSlot)
    ? cloneElement(boardSlot, {
        sprintFilterId: sprintFilterId || undefined,
        defaultSprintId: sprintFilterId || undefined,
        hubSprintCard: {
          projectCode: resolvedBoard?.projectCode || '',
          projectId: String(projectId || ''),
          canViewMembers: hubCaps.canViewMembers,
          epics: (planningItems || []).filter((p) => String(p.type || '').toLowerCase() === 'epic'),
          features: (planningItems || []).filter(
            (p) => String(p.type || '').toLowerCase() === 'feature'
          ),
          onPatchPlanningItems: patchPlanningItems,
          onOpenChangeRequest: (crId) => {
            const id = String(crId || '').trim();
            if (!id) return;
            setVisitedTabs((prev) => ({ ...prev, changeRequests: true }));
            setBoardOpenCrId(id);
            setTab('changeRequests');
          },
        },
      })
    : boardSlot;

  const projectAccess = projectPayload?.access || null;

  const visibleTabs = useMemo(() => {
    return PROJECT_HUB_TABS.filter((item) => {
      if (isSummaryOnly && item.id !== 'overview') return false;
      if (
        item.id === 'settings' &&
        !hubCaps.canViewSettings &&
        !hubCaps.canManageSettings &&
        !hubCaps.canManageProjectRoles
      ) {
        return false;
      }
      if (item.id === 'members' && !hubCaps.canViewMembers) return false;
      if (item.id === 'changeRequests' && !hubCaps.canViewChangeRequests) return false;
      if (item.id === 'executionControl' && !hubCaps.canViewWorkItems) return false;
      if (item.id === 'testCases' && !hubCaps.canViewWorkItems) return false;
      if (item.id === 'planning' && !hubCaps.canViewBacklog) return false;
      // Timeline: SoT P2 default — show with work-items view (not gated on backlog:view)
      if (item.id === 'timeline' && !hubCaps.canViewWorkItems) return false;
      if ((item.id === 'list' || item.id === 'board') && !hubCaps.canViewWorkItems) return false;
      if (item.id === 'files' && !hubCaps.canViewFiles) return false;
      if (item.id === 'activity' && !hubCaps.canViewActivityTab) return false;
      if (item.id === 'reports') {
        if (!isClosedProjectStatus(projectPayload?.status) || !hubCaps.canViewReport) {
          return false;
        }
      }
      if (item.id === 'chat' && !isProjectChatTabEnabled()) return false;
      return true;
    });
  }, [hubCaps, isSummaryOnly, projectPayload?.status]);

  useEffect(() => {
    // Suite sidebar owns URL when hideTabBar — do not bounce Operations deep-links
    // (settings/members) to overview before caps load or when access is denied.
    if (hideTabBar || !capsReady) return;
    if (isSummaryOnly && tab !== 'overview') setTab('overview');
  }, [isSummaryOnly, tab, hideTabBar, capsReady, setTab]);

  useEffect(() => {
    if (hideTabBar || !capsReady) return;
    const allowed = new Set(visibleTabs.map((item) => item.id));
    if (tab && !allowed.has(tab)) setTab('overview');
  }, [tab, visibleTabs, hideTabBar, capsReady, setTab]);

  useEffect(() => {
    setVisitedTabs((prev) => (prev[tab] ? prev : { ...prev, [tab]: true }));
  }, [tab]);

  const showListPanel = Boolean(visitedTabs.list) && hubCaps.canViewWorkItems;
  const showPlanningPanel = Boolean(visitedTabs.planning) && hubCaps.canViewBacklog;
  const showTimelinePanel = Boolean(visitedTabs.timeline) && hubCaps.canViewWorkItems;
  const showChangeRequestsPanel =
    Boolean(visitedTabs.changeRequests) && hubCaps.canViewChangeRequests;
  const showExecutionControlPanel =
    Boolean(visitedTabs.executionControl) && hubCaps.canViewWorkItems;
  const showTestCasesPanel = Boolean(visitedTabs.testCases) && hubCaps.canViewWorkItems;
  const showMembersPanel = Boolean(visitedTabs.members) && hubCaps.canViewMembers;

  const issueCounts = useMemo(() => countCardsByIssueType(cards), [cards]);
  const chartMembers = useMemo(() => {
    if (Array.isArray(rosterMembers) && rosterMembers.length) return rosterMembers;
    return Array.isArray(projectPayload?.members) ? projectPayload.members : [];
  }, [rosterMembers, projectPayload?.members]);
  const dashboardCharts = useMemo(() => {
    if (!overviewVisibility.canViewTaskMetrics) return null;
    const membersForCharts = overviewVisibility.canViewMemberBreakdown ? chartMembers : [];
    // Prefer live board for status donut — sync with Kanban columns.
    if (Array.isArray(cards) && cards.length > 0) {
      return buildOverviewDashboardCharts({
        cards,
        lists,
        issueCounts,
        priorityConfig: projectPayload?.priorityConfig,
        members: membersForCharts,
      });
    }
    if (overviewPayload?.charts) {
      return chartsFromOverviewApi(
        overviewPayload.charts,
        projectPayload?.priorityConfig || overviewPayload?.project?.priorityConfig,
        membersForCharts,
        overviewVisibility.canViewMemberBreakdown ? cards : []
      );
    }
    return buildOverviewDashboardCharts({
      cards,
      lists,
      issueCounts,
      priorityConfig: projectPayload?.priorityConfig,
      members: membersForCharts,
    });
  }, [
    cards,
    lists,
    issueCounts,
    overviewPayload?.charts,
    overviewPayload?.project?.priorityConfig,
    projectPayload?.priorityConfig,
    chartMembers,
    overviewVisibility.canViewTaskMetrics,
    overviewVisibility.canViewMemberBreakdown,
  ]);
  const deliveryExtras = useMemo(
    () => ({
      unassigned:
        overviewPayload?.summary?.unassigned ?? countUnassignedOpenCards(cards, lists),
      estimateHours:
        overviewPayload?.summary?.estimateHours ?? sumOpenCardEstimateHours(cards, lists),
    }),
    [overviewPayload?.summary, cards, lists]
  );
  const overviewProjectStatus = projectPayload?.status || resolvedBoard?.status || '';
  const overviewDeliveryPhase = coerceDeliveryPhase(projectPayload?.deliveryPhase);
  const planningPulse = useMemo(
    () => overviewPayload?.planningPulse ?? countPlanningByType(planningItems),
    [overviewPayload?.planningPulse, planningItems]
  );
  const overviewSprintIssueCount = useMemo(() => {
    if (overviewPayload?.activeSprint?.issueCount != null) {
      return Number(overviewPayload.activeSprint.issueCount) || 0;
    }
    return countCardsInSprint(cards, activeSprint?._id);
  }, [overviewPayload?.activeSprint?.issueCount, cards, activeSprint?._id]);
  const overviewActiveSprint = useMemo(() => {
    if (overviewPayload?.activeSprint) {
      return overviewPayload.activeSprint;
    }
    return activeSprint;
  }, [overviewPayload?.activeSprint, activeSprint]);
  const nextActions = useMemo(() => {
    if (Array.isArray(cards) && cards.length > 0) {
      return pickNextHubActions(cards, lists, {
        projectCode: resolvedBoard?.projectCode || '',
      });
    }
    if (Array.isArray(overviewPayload?.nextActions) && overviewPayload.nextActions.length) {
      return overviewPayload.nextActions;
    }
    return pickNextHubActions(cards, lists, { projectCode: resolvedBoard?.projectCode || '' });
  }, [overviewPayload?.nextActions, cards, lists, resolvedBoard?.projectCode]);
  const sprintContextLoading =
    overviewVisibility.canViewSprintContext &&
    (tab === 'overview' || tab === 'board') &&
    (sprintsFetching || !sprintsHydrated);
  const planningContextLoading = tab === 'overview' && planningLoading;
  const defaultListId = String(lists[0]?._id || '').trim();
  const derivedFiles = useMemo(() => collectCardAttachments(cards), [cards]);
  const derivedActivity = useMemo(() => collectCardActivity(cards), [cards]);
  const files = Array.isArray(apiFiles) ? apiFiles : derivedFiles;
  const activity = useMemo(() => {
    if (!overviewVisibility.canViewActivity || activityRestricted) return [];
    const source = Array.isArray(apiActivity) ? apiActivity : derivedActivity;
    const statusTwinKeys = new Set();
    for (const row of source || []) {
      const field = String(row?.payload?.field || '').trim();
      if (field !== 'status') continue;
      const tid = String(row?.taskId || '').trim();
      const at = row?.createdAt ? new Date(row.createdAt).getTime() : 0;
      if (!tid || !Number.isFinite(at)) continue;
      statusTwinKeys.add(`${tid}:${Math.round(at / 3000)}`);
    }
    const filtered = (source || []).filter((row) => {
      const field = String(row?.payload?.field || '').trim();
      if (field !== 'listId') return true;
      const tid = String(row?.taskId || '').trim();
      const at = row?.createdAt ? new Date(row.createdAt).getTime() : 0;
      if (!tid || !Number.isFinite(at)) return true;
      return !statusTwinKeys.has(`${tid}:${Math.round(at / 3000)}`);
    });
    return filtered.map((row) => mapHubActivityItem(row, t, { locale, cards, lists }));
  }, [
    apiActivity,
    derivedActivity,
    t,
    locale,
    cards,
    lists,
    overviewVisibility.canViewActivity,
    activityRestricted,
  ]);

  const reloadOverview = useCallback(() => {
    void refetchOverview();
    invalidateProjectHub(projectId, boardId);
  }, [refetchOverview, invalidateProjectHub, projectId, boardId]);

  const handleHubRefresh = useCallback(() => {
    reloadOverview();
    onRefresh?.();
  }, [reloadOverview, onRefresh]);

  const reloadActivity = useCallback(() => {
    activityLoadedForRef.current = '';
    setActivityError(false);
    setActivityRestricted(false);
    const pid = String(projectId || '').trim();
    if (pid) {
      queryClient.removeQueries({ queryKey: queryKeys.projectHub.activity(pid, 10) });
    }
    setActivityReloadToken((n) => n + 1);
  }, [projectId, queryClient]);

  const handleOpenNextAction = useCallback(
    (actionId) => {
      const card = cards.find((c) => String(c._id || c.id) === String(actionId));
      if (card) {
        setOverviewWorkIssue(card);
        return;
      }
      const fromApi = nextActions.find((a) => String(a.id) === String(actionId));
      if (fromApi) {
        setOverviewWorkIssue({
          _id: fromApi.id,
          id: fromApi.id,
          title: fromApi.title,
          issueType: fromApi.issueType,
          dueDate: fromApi.dueDate,
        });
      }
    },
    [cards, nextActions]
  );

  const handleViewAllActivity = useCallback(() => {
    setVisitedTabs((prev) => ({ ...prev, activity: true }));
    setTab('activity');
  }, []);

  useEffect(() => {
    if (!projectId || !needsActivity) return undefined;
    let cancelled = false;
    let timer = null;
    const runFetch = () => {
      if (cancelled) return;
      setActivityLoading(true);
      setActivityError(false);
      setActivityRestricted(false);
      queryClient
        .fetchQuery({
          queryKey: queryKeys.projectHub.activity(projectId, 10),
          staleTime: 30_000,
          queryFn: async () => {
            const actRes = await projectAPI.getActivity(
              projectId,
              { limit: 10 },
              { skipPermissionDeniedToast: true }
            );
            const act = actRes?.data?.data ?? actRes?.data ?? [];
            return Array.isArray(act) ? act : [];
          },
        })
        .then((act) => {
          if (cancelled) return;
          setApiActivity(act);
          activityLoadedForRef.current = projectId;
          setActivityRestricted(false);
        })
        .catch((err) => {
          if (!cancelled) {
            const status = Number(err?.status || err?.response?.status || 0);
            setApiActivity([]);
            activityLoadedForRef.current = projectId;
            if (status === 403) {
              setActivityError(false);
              setActivityRestricted(true);
            } else {
              setActivityError(true);
              setActivityRestricted(false);
            }
          }
        })
        .finally(() => {
          if (!cancelled) setActivityLoading(false);
        });
    };
    timer = setTimeout(runFetch, tab === 'overview' ? 300 : 0);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [projectId, needsActivity, activityReloadToken, tab, queryClient]);

  useEffect(() => {
    if (!projectId || !needsFiles) return undefined;
    let cancelled = false;
    queryClient
      .fetchQuery({
        queryKey: queryKeys.projectHub.files(projectId),
        staleTime: 60_000,
        queryFn: async () => {
          const filesRes = await projectAPI.getFiles(projectId);
          const fl = filesRes?.data?.data ?? filesRes?.data ?? [];
          return (Array.isArray(fl) ? fl : []).map((f) => ({
            name: f.name,
            url: f.url,
            cardTitle: f.taskTitle,
          }));
        },
      })
      .then((mapped) => {
        if (cancelled) return;
        setApiFiles(mapped);
        filesLoadedForRef.current = projectId;
      })
      .catch(() => {
        if (!cancelled) setApiFiles(null);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, needsFiles, queryClient]);

  const displayProjectTitle = String(
    projectPayload?.title ||
      resolvedBoard?.projectTitle ||
      (resolvedBoard?.title && !/^prj$/i.test(String(resolvedBoard.title).trim())
        ? resolvedBoard.title
        : '') ||
      ''
  ).trim();
  const hasBoard = Boolean(boardId && resolvedBoard);
  /** Boards/detail still resolving — never flash empty “select board” picker. */
  const waitingForBoard =
    !hasBoard &&
    (Boolean(loadingBoards) || (Boolean(boardId) && Boolean(loadingBoardDetail)));
  const initials = projectInitials(displayProjectTitle || resolvedBoard?.projectCode || 'PR');
  const muted = HUB_MUTED;
  const titleCls = HUB_TITLE;
  const sprintsReadyForCompleteGate = sprintsHydrated;
  const hasOpenSprints = (sprints || []).some((s) => {
    const st = String(s?.status || '').toLowerCase();
    return st === 'planned' || st === 'active';
  });
  const showCompleteProjectButton =
    hasBoard &&
    Boolean(hubCaps.canCompleteProject) &&
    !isProjectCompleted &&
    workLooksComplete &&
    sprintsReadyForCompleteGate &&
    !hasOpenSprints;

  const projectStillActive = projectPayload?.isActive !== false;

  const toolbarHasActions =
    Boolean(hasBoard && isProjectCompleted) ||
    showCompleteProjectButton ||
    Boolean(tab === 'board' && hubCaps?.canManageSprints && activeSprint?._id);

  const toolbar = toolbarHasActions ? (
    <div className="flex w-full flex-wrap items-center gap-1.5 sm:ml-auto sm:w-auto sm:justify-end">
      {hasBoard && isProjectCompleted ? (
        <span className="inline-flex items-center rounded-md border border-success/30 bg-success/10 px-2 py-1 text-[11px] font-semibold text-success">
          {t('workspace.projectHubCompleteProjectBadge')}
        </span>
      ) : null}
      {showCompleteProjectButton ? (
        <button
          type="button"
          onClick={() => setCompleteProjectOpen(true)}
          title={t('workspace.projectHubCompleteProject')}
          className="rounded-md bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground"
        >
          <span className="hidden sm:inline">{t('workspace.projectHubCompleteProject')}</span>
          <span className="sm:hidden">{t('workspace.projectHubCompleteProjectShort')}</span>
        </button>
      ) : null}
      {tab === 'board' && hubCaps?.canManageSprints && activeSprint?._id ? (
        <button
          type="button"
          onClick={() => setCompleteSprintId(String(activeSprint._id))}
          disabled={!boardReady}
          className="rounded-md border border-border px-2.5 py-1 text-[11px] font-semibold disabled:opacity-50"
        >
          {t('workspace.projectHubPlanCompleteSprint')}
        </button>
      ) : null}
    </div>
  ) : null;

  /** Ops / collab tabs that must render without a selected kanban board (suite deep-link). */
  const boardlessOpsTab =
    tab === 'settings' ||
    tab === 'members' ||
    tab === 'activity' ||
    tab === 'files' ||
    tab === 'changeRequests' ||
    tab === 'chat';

  /** Suite sidebar + TopHeader project menu sở hữu identity — không sticky header kép. */
  const suiteOwnsChrome = Boolean(hideTabBar);

  if (!hasBoard && !boardlessOpsTab) {
    const showFallbackChrome = Boolean(onBack && !suiteOwnsChrome) || toolbarHasActions;
    return (
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        {showFallbackChrome ? (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-b border-border bg-surface px-3 py-1.5">
            {onBack && !suiteOwnsChrome ? (
              <button
                type="button"
                onClick={() => onBack()}
                className={`mr-auto ${HUB_ICON_BTN}`}
                aria-label={t('taskBoard.backAria')}
              >
                <ChevronLeft size={18} />
              </button>
            ) : null}
            {toolbar}
          </div>
        ) : null}
        {waitingForBoard ? (
          <div className="flex min-h-[12rem] flex-1 items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
            <Loader2 className={`h-4 w-4 ${VH_MOTION_SPINNER} shrink-0`} aria-hidden />
            <span>{t('common.loading')}</span>
          </div>
        ) : (
          emptySlot
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {suiteOwnsChrome ? (
        toolbarHasActions ? (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5 border-b border-border bg-surface px-3 py-1.5 sm:px-4">
            {toolbar}
          </div>
        ) : null
      ) : (
        <header className={HUB_HEADER}>
          <div className={HUB_HEADER_ROW}>
            <div className="flex min-w-0 flex-1 items-center gap-2.5">
              {onBack ? (
                <button
                  type="button"
                  onClick={() => onBack()}
                  className={`-ml-1 ${HUB_ICON_BTN}`}
                  aria-label={t('taskBoard.backAria')}
                >
                  <ChevronLeft size={18} />
                </button>
              ) : null}
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-[10px] font-black text-primary-foreground">
                {initials}
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <h2 className={`break-words leading-tight ${titleCls}`}>
                  {displayProjectTitle || t('workspace.projectHubUntitled')}
                </h2>
                <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                  {resolvedBoard?.projectCode ? (
                    <span className={HUB_BADGE_CODE}>{resolvedBoard.projectCode}</span>
                  ) : null}
                  {resolvedBoard?.methodology ? (
                    <span className={HUB_BADGE_META}>
                      {formatHubMethodology(resolvedBoard.methodology, t)}
                    </span>
                  ) : null}
                  <span className={HUB_BADGE_PHASE}>
                    {t(deliveryPhaseLabelKey(overviewDeliveryPhase))}
                  </span>
                  <span className={`max-w-full text-[11px] leading-tight sm:truncate ${muted}`}>
                    {[
                      formatHubDate(resolvedBoard?.dueDate, locale) !== '—'
                        ? formatHubDate(resolvedBoard?.dueDate, locale)
                        : null,
                      resolvedBoard?.visibility === 'workspace'
                        ? t('workspace.projectHubVisibilityWorkspace')
                        : null,
                      t('workspace.projectHubStatDonePct', { pct: summary.donePercent }),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </div>
              </div>
            </div>
            {toolbar}
          </div>
          <nav
            className="flex gap-0 overflow-x-auto overscroll-x-contain px-3 sm:px-4"
            aria-label={t('workspace.projectHubNavAria')}
            style={{ scrollbarWidth: 'none' }}
          >
            {visibleTabs.map((item) => {
              const active = tab === item.id;
              const disabled = isSummaryOnly && item.id !== 'overview';
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => !disabled && setTab(item.id)}
                  className={
                    disabled ? HUB_TAB_DISABLED : active ? HUB_TAB_ACTIVE : HUB_TAB_IDLE
                  }
                >
                  {t(item.labelKey)}
                </button>
              );
            })}
          </nav>
        </header>
      )}

      {isSummaryOnly ? (
        <div className="border-b border-border bg-amber-500/10 px-4 py-2 text-xs text-amber-900 dark:text-amber-100">
          {t('workspace.projectHubSummaryOnlyBanner')}
        </div>
      ) : null}

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        {tab === 'overview' ? (
          <ProjectHubOverviewPanel
            board={resolvedBoard}
            projectStatus={overviewProjectStatus}
            deliveryPhase={overviewDeliveryPhase}
            summary={summary}
            deliveryExtras={deliveryExtras}
            dashboardCharts={dashboardCharts}
            nextActions={nextActions}
            overdueCards={overdueHealthCards}
            inReviewCards={inReviewHealthCards}
            overviewCards={cards}
            overviewLists={lists}
            overviewMembers={chartMembers}
            chartWorkItemsLoading={chartWorkItemsLoading}
            activity={activity}
            activityLoading={activityLoading}
            activityError={activityError}
            onRetryActivity={reloadActivity}
            activeSprint={overviewActiveSprint}
            sprintIssueCount={overviewSprintIssueCount}
            planningPulse={planningPulse}
            boardLoading={loadingBoardDetail && !overviewPayload}
            sprintContextLoading={sprintContextLoading}
            planningContextLoading={planningContextLoading}
            locale={locale}
            isDarkMode={isDarkMode}
            onOpenBoard={() => setTab('board')}
            onOpenBacklog={() => setTab('planning')}
            onOpenNextAction={handleOpenNextAction}
            onViewAllActivity={handleViewAllActivity}
            overviewVisibility={overviewVisibility}
            activityRestricted={activityRestricted}
            t={t}
          />
        ) : null}
        {showListPanel ? (
        <div
          className={
            tab === 'list' ? 'flex min-h-0 flex-1 flex-col overflow-hidden' : 'hidden'
          }
          hidden={tab !== 'list'}
          aria-hidden={tab !== 'list'}
        >
          <ProjectHubListPanel
            projectId={projectId}
            boardId={boardId}
            defaultListId={defaultListId}
            lists={lists}
            sprints={sprints}
            projectCode={resolvedBoard?.projectCode || ''}
            hubCaps={hubCaps}
            canManage={canManage}
            apiCtx={apiCtx}
            isDarkMode={isDarkMode}
            locale={locale}
            workspaceSlug={workspaceSlug}
            onPatchPlanningItems={patchPlanningItems}
            onReloadPlanning={reloadPlanning}
            onRefresh={handleHubRefresh}
            onUpdateCard={onUpdateCard}
            onPatchBoardCards={onPatchBoardCards}
            onOpenSettings={() => setTab('settings')}
            listActive={tab === 'list'}
            membersEpoch={membersEpoch}
            workTypeConfig={projectPayload?.workTypeConfig}
            priorityConfig={projectPayload?.priorityConfig}
            workflowTransitionsByFrom={boardDetail?.workflow?.transitionsByFrom || null}
            parentBoardCards={cards}
            planningItems={planningItems}
            planningLoading={planningLoading}
            planningError={planningError}
          />
        </div>
        ) : null}
        {tab === 'planning' && hideTabBar && capsReady && !hubCaps.canViewBacklog ? (
          <div className="flex min-h-[8rem] items-center justify-center p-4 text-sm text-muted-foreground">
            {t('workspace.projectHubPlanningDenied')}
          </div>
        ) : null}
        {tab === 'planning' && hideTabBar && !capsReady ? (
          <div className="flex min-h-[8rem] items-center justify-center gap-2 p-4 text-sm text-muted-foreground">
            <Loader2 className={`h-4 w-4 ${VH_MOTION_SPINNER}`} aria-hidden />
            <span>{t('common.loading')}</span>
          </div>
        ) : null}
        {showPlanningPanel ? (
        <div
          className={
            tab === 'planning' ? 'flex min-h-0 flex-1 flex-col overflow-hidden' : 'hidden'
          }
          hidden={tab !== 'planning'}
          aria-hidden={tab !== 'planning'}
        >
          <ProjectHubPlanningPanel
            projectId={projectId}
            canManage={canManage}
            hubCaps={hubCaps}
            isDarkMode={isDarkMode}
            locale={locale}
            boardId={boardId}
            defaultListId={defaultListId}
            apiCtx={apiCtx}
            boardCards={cards}
            lists={lists}
            projectCode={resolvedBoard?.projectCode || ''}
            planningItems={planningItems}
            planningLoading={planningLoading}
            planningError={planningError}
            sprints={sprints}
            onPatchPlanningItems={patchPlanningItems}
            onReloadPlanning={reloadPlanning}
            onReloadSprints={reloadSprints}
            onRefresh={() => {
              onRefresh?.();
              void reloadSprints();
            }}
            onPatchBoardCards={onPatchBoardCards}
            onOpenBoard={() => setTab('board')}
            onOpenChangeRequest={(crId) => {
              const id = String(crId || '').trim();
              if (!id) return;
              setVisitedTabs((prev) => ({ ...prev, changeRequests: true }));
              setBoardOpenCrId(id);
              setTab('changeRequests');
            }}
            workTypeConfig={projectPayload?.workTypeConfig}
            priorityConfig={projectPayload?.priorityConfig}
            workflowTransitionsByFrom={boardDetail?.workflow?.transitionsByFrom || null}
          />
        </div>
        ) : null}
        {showTimelinePanel ? (
        <div
          className={
            tab === 'timeline' ? 'flex min-h-0 flex-1 flex-col overflow-hidden' : 'hidden'
          }
          hidden={tab !== 'timeline'}
          aria-hidden={tab !== 'timeline'}
        >
          <ProjectHubTimelinePanel
            projectId={projectId}
            boardId={boardId}
            defaultListId={defaultListId}
            lists={lists}
            projectCode={resolvedBoard?.projectCode || ''}
            hubCaps={hubCaps}
            canManage={canManage}
            apiCtx={apiCtx}
            isDarkMode={isDarkMode}
            locale={locale}
            workspaceSlug={workspaceSlug}
            board={resolvedBoard}
            projectPayload={projectPayload}
            cards={cards}
            planningItems={planningItems}
            planningLoading={planningLoading}
            planningError={planningError}
            sprints={sprints}
            onPatchPlanningItems={patchPlanningItems}
            onReloadPlanning={reloadPlanning}
            onRefresh={handleHubRefresh}
            onUpdateCard={onUpdateCard}
            onPatchBoardCards={onPatchBoardCards}
            timelineActive={tab === 'timeline'}
            workTypeConfig={projectPayload?.workTypeConfig}
          />
        </div>
        ) : null}
        {tab === 'board' && hubCaps.canViewWorkItems ? (
          !sprintsHydrated || sprintsFetching ? (
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-4 py-12 text-center">
              <Loader2
                className={`h-5 w-5 ${VH_MOTION_SPINNER} text-muted-foreground`}
                aria-hidden
              />
              <p className="text-xs text-muted-foreground">
                {t('common.loading')}
              </p>
            </div>
          ) : boardReady ? (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{boardKanban}</div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-4 py-12 text-center">
              <p className="text-sm font-semibold text-foreground">
                {t('workspace.projectHubBoardLockedTitle')}
              </p>
              <p className="max-w-md text-xs text-muted-foreground">
                {t('workspace.projectHubBoardLockedHint')}
              </p>
              {hubCaps.canViewBacklog ? (
              <button
                type="button"
                className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
                onClick={() => setTab('planning')}
              >
                {t('workspace.projectHubBoardLockedCta')}
              </button>
              ) : null}
            </div>
          )
        ) : null}
        {tab === 'chat' && isProjectChatTabEnabled() ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <ProjectChatWorkspace
              organizationId={organizationId}
              projectIdFilter={projectId}
              channelId={hubChatChannelId}
              onSelectChannel={setHubChatChannelId}
              canViewMembers={hubCaps.canViewMembers}
            />
          </div>
        ) : null}
        {tab === 'changeRequests' && hideTabBar && capsReady && !hubCaps.canViewChangeRequests ? (
          <div className="flex min-h-[8rem] items-center justify-center p-4 text-sm text-muted-foreground">
            {t('workspace.projectHubCrDenied')}
          </div>
        ) : null}
        {tab === 'changeRequests' && hideTabBar && !capsReady ? (
          <div className="flex min-h-[8rem] items-center justify-center gap-2 p-4 text-sm text-muted-foreground">
            <Loader2 className={`h-4 w-4 ${VH_MOTION_SPINNER}`} aria-hidden />
            <span>{t('common.loading')}</span>
          </div>
        ) : null}
        {showExecutionControlPanel ? (
          <div
            className={
              tab === 'executionControl'
                ? 'flex min-h-0 flex-1 flex-col overflow-hidden'
                : 'hidden'
            }
            hidden={tab !== 'executionControl'}
            aria-hidden={tab !== 'executionControl'}
          >
            <ProjectHubExecutionControlPanel
              projectId={projectId}
              listActive={tab === 'executionControl'}
            />
          </div>
        ) : null}

        {showChangeRequestsPanel ? (
          <div
            className={
              tab === 'changeRequests' ? 'flex min-h-0 flex-1 flex-col overflow-hidden' : 'hidden'
            }
            hidden={tab !== 'changeRequests'}
            aria-hidden={tab !== 'changeRequests'}
          >
          <ProjectHubChangeRequestsPanel
            projectId={projectId}
            listActive={tab === 'changeRequests'}
            isDarkMode={isDarkMode}
            locale={locale}
            projectCode={resolvedBoard?.projectCode || ''}
            canCreate={hubCaps.canCreateChangeRequest}
            canUpdate={hubCaps.canUpdateChangeRequest}
            canDelete={hubCaps.canDeleteChangeRequest}
            canViewMembers={hubCaps.canViewMembers}
            boardCards={cards}
            lists={lists}
            boardId={boardId}
            apiCtx={apiCtx}
            externalCrId={boardOpenCrId}
            onExternalCrConsumed={() => setBoardOpenCrId('')}
            onRefreshBoard={onRefresh}
            onOpenWorkItem={(work) => {
              const id = String(work?._id || work?.id || '');
              const fromBoard = cards.find((c) => String(c._id || c.id) === id);
              setCrWorkIssue(fromBoard || work || null);
            }}
          />
        </div>
        ) : null}
        {showTestCasesPanel ? (
        <div
          className={
            tab === 'testCases' ? 'flex min-h-0 flex-1 flex-col overflow-hidden' : 'hidden'
          }
          hidden={tab !== 'testCases'}
          aria-hidden={tab !== 'testCases'}
        >
          <ProjectHubTestCasesPanel
            projectId={projectId}
            listActive={tab === 'testCases'}
            isDarkMode={isDarkMode}
            boardCards={cards}
            boardLists={lists}
            onPatchBoardCards={onPatchBoardCards}
            canCreate={Boolean(hubCaps.canCreateTask)}
            canExecute={Boolean(
              Array.isArray(hubCaps.permissions) &&
                hubCaps.permissions.includes('task:change_status')
            )}
          />
        </div>
        ) : null}
        {showMembersPanel ? (
        <div
          className={
            tab === 'members' ? 'flex min-h-0 flex-1 flex-col overflow-hidden' : 'hidden'
          }
          hidden={tab !== 'members'}
          aria-hidden={tab !== 'members'}
        >
          <ProjectHubMembersPanel
            projectId={projectId}
            boardId={boardId}
            organizationId={organizationId}
            projectPayload={projectPayload}
            membersActive={tab === 'members'}
            canManage={Boolean(hubCaps.canManageMembers)}
            isDarkMode={isDarkMode}
            onMembersChanged={() => {
              setMembersEpoch((n) => n + 1);
              invalidateProjectHub(projectId, boardId, { organizationId });
            }}
          />
        </div>
        ) : null}
        {tab === 'members' && hideTabBar && capsReady && !hubCaps.canViewMembers ? (
          <div className="flex min-h-[8rem] items-center justify-center p-4 text-sm text-muted-foreground">
            {t('workspace.projectHubMembersDenied')}
          </div>
        ) : null}
        {tab === 'members' && hideTabBar && !capsReady ? (
          <div className="flex min-h-[8rem] items-center justify-center gap-2 p-4 text-sm text-muted-foreground">
            <Loader2 className={`h-4 w-4 ${VH_MOTION_SPINNER}`} aria-hidden />
            <span>{t('common.loading')}</span>
          </div>
        ) : null}
        {tab === 'files' && hubCaps.canViewFiles ? <FilesPanel files={files} t={t} /> : null}
        {tab === 'activity' && hubCaps.canViewActivityTab ? (
          <ActivityPanel activity={activity} locale={locale} t={t} />
        ) : null}
        {tab === 'reports' &&
        isClosedProjectStatus(projectPayload?.status) &&
        hubCaps.canViewReport ? (
          <Suspense
            fallback={
              <div className="flex min-h-[8rem] items-center justify-center gap-2 p-4 text-sm text-muted-foreground">
                <Loader2 className={`h-4 w-4 ${VH_MOTION_SPINNER}`} aria-hidden />
                <span>{t('common.loading')}</span>
              </div>
            }
          >
            <ProjectClosureReportPage projectId={projectId} />
          </Suspense>
        ) : null}
        {tab === 'activity' && hideTabBar && capsReady && !hubCaps.canViewActivityTab ? (
          <div className="flex min-h-[8rem] items-center justify-center p-4 text-sm text-muted-foreground">
            {t('workspace.projectHubActivityDenied')}
          </div>
        ) : null}
        {tab === 'activity' && hideTabBar && !capsReady ? (
          <div className="flex min-h-[8rem] items-center justify-center gap-2 p-4 text-sm text-muted-foreground">
            <Loader2 className={`h-4 w-4 ${VH_MOTION_SPINNER}`} aria-hidden />
            <span>{t('common.loading')}</span>
          </div>
        ) : null}
        {tab === 'settings' &&
        (hubCaps.canViewSettings ||
          hubCaps.canManageSettings ||
          hubCaps.canManageProjectRoles) ? (
          <ProjectHubSettingsPanel
            projectId={projectId}
            boardId={boardId}
            board={resolvedBoard}
            projectPayload={projectPayload}
            organizationId={organizationId}
            apiCtx={apiCtx}
            canManage={Boolean(hubCaps.canManageSettings)}
            canViewSettings={Boolean(hubCaps.canViewSettings)}
            canManageProjectRoles={Boolean(hubCaps.canManageProjectRoles)}
            canManageDelivery={Boolean(hubCaps.canManageDelivery)}
            canArchiveProject={Boolean(hubCaps.canArchiveProject)}
            canArchiveWithoutComplete={Boolean(hubCaps.canArchiveWithoutComplete)}
            isProjectCompleted={isProjectCompleted}
            isDraftProject={isDraftProject}
            projectStillActive={projectStillActive}
            onRequestArchive={() => setArchiveProjectOpen(true)}
            isDarkMode={isDarkMode}
            onSaved={onRefresh}
            workTypeConfig={projectPayload?.workTypeConfig}
            priorityConfig={projectPayload?.priorityConfig}
          />
        ) : null}
        {tab === 'settings' &&
        hideTabBar &&
        capsReady &&
        !hubCaps.canViewSettings &&
        !hubCaps.canManageSettings &&
        !hubCaps.canManageProjectRoles ? (
          <div className="flex min-h-[8rem] items-center justify-center p-4 text-sm text-muted-foreground">
            {t('workspace.projectHubSettingsDenied')}
          </div>
        ) : null}
        {tab === 'settings' && hideTabBar && !capsReady ? (
          <div className="flex min-h-[8rem] items-center justify-center gap-2 p-4 text-sm text-muted-foreground">
            <Loader2 className={`h-4 w-4 ${VH_MOTION_SPINNER}`} aria-hidden />
            <span>{t('common.loading')}</span>
          </div>
        ) : null}

        <ProjectHubCompleteSprintModal
          isOpen={Boolean(completeSprintId)}
          projectId={projectId}
          sprint={
            completeSprintId
              ? sprints.find((s) => String(s._id) === String(completeSprintId)) || null
              : null
          }
          canManageSprints={Boolean(hubCaps?.canManageSprints)}
          onClose={() => setCompleteSprintId(null)}
          onCompleted={() => {
            toast.success(t('workspace.projectHubPlanSprintClosed'));
            void reloadSprints();
            reloadPlanning();
            onRefresh?.();
            setCompleteSprintId(null);
          }}
        />
        <ProjectHubCompleteProjectModal
          isOpen={completeProjectOpen}
          projectId={projectId}
          projectTitle={resolvedBoard?.title || ''}
          canComplete={Boolean(hubCaps.canCompleteProject) && !isProjectCompleted}
          onClose={() => setCompleteProjectOpen(false)}
          onCompleted={async (data) => {
            toast.success(t('workspace.projectHubCompleteProjectSuccess'));
            const closed = data?.project || data || {};
            queryClient.setQueryData(queryKeys.projectHub.project(projectId), (prev) => ({
              ...(prev || {}),
              ...closed,
              status: closed.status || 'closed',
            }));
            invalidateProjectHub(projectId, boardId);
            setCompleteProjectOpen(false);
            onRefresh?.();
          }}
        />
        <ProjectHubArchiveProjectModal
          isOpen={archiveProjectOpen}
          projectId={projectId}
          projectTitle={resolvedBoard?.title || projectPayload?.title || ''}
          draftDelete={isDraftProject}
          earlyArchive={
            !isDraftProject &&
            !isProjectCompleted &&
            Boolean(hubCaps.canArchiveWithoutComplete)
          }
          onClose={() => setArchiveProjectOpen(false)}
          onArchived={() => {
            toast.success(
              isDraftProject
                ? t('workspace.projectHubDeleteDraftSuccess')
                : t('workspace.projectHubArchiveSuccess')
            );
            setArchiveProjectOpen(false);
            writeStoredLastProjectId('');
            void queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
            if (organizationId) {
              navigate(buildProjectsPickerPath(organizationId), { replace: true });
              return;
            }
            onBack?.();
          }}
        />
        {crWorkIssue ? (
          <WorkItemDetail
            open
            chrome="drawer"
            drawerLayout="overlay"
            workItem={crWorkIssue}
            boardCards={cards}
            lists={lists}
            epics={planningItems.filter((p) => String(p.type || '').toLowerCase() === 'epic')}
            features={planningItems.filter((p) => String(p.type || '').toLowerCase() === 'feature')}
            sprints={sprints}
            projectCode={resolvedBoard?.projectCode || ''}
            projectId={projectId}
            boardId={boardId}
            defaultListId={defaultListId}
            apiCtx={apiCtx}
            isDarkMode={isDarkMode}
            locale={locale}
            workTypeConfig={projectPayload?.workTypeConfig}
            canCreateTask={Boolean(hubCaps?.canCreateTask)}
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
            canViewMembers={hubCaps.canViewMembers}
            onClose={() => setCrWorkIssue(null)}
            onOpenWorkItem={(card) => {
              if (card) setCrWorkIssue(card);
            }}
            onPatchBoardCards={onPatchBoardCards}
            onOpenChangeRequest={(crId) => {
              const id = String(crId || '').trim();
              if (!id) return;
              setCrWorkIssue(null);
              setVisitedTabs((prev) => ({ ...prev, changeRequests: true }));
              setBoardOpenCrId(id);
              setTab('changeRequests');
            }}
            onUpdateCard={async (cardId, patch) => {
              onPatchBoardCards?.((prev) =>
                (prev || []).map((c) =>
                  String(c._id || c.id) === String(cardId) ? { ...c, ...patch } : c
                )
              );
              setCrWorkIssue((prev) =>
                prev && String(prev._id || prev.id) === String(cardId) ? { ...prev, ...patch } : prev
              );
              const keys = Object.keys(patch || {});
              if (keys.length === 1 && keys[0] === 'comments') return;
              if (patch && typeof patch === 'object' && !Array.isArray(patch)) {
                try {
                  return await taskAPI.updateBoardCard(cardId, patch, apiCtx || {});
                } catch (err) {
                  toast.error(
                    resolveApiErrorMessage(err, {
                      t,
                      fallback: t('workspace.projectHubPlanCreateFail'),
                    })
                  );
                  throw err;
                }
              }
            }}
          />
        ) : null}
        {overviewWorkIssue ? (
          <WorkItemDetail
            key="overview-work-item-detail"
            open
            chrome="drawer"
            drawerLayout="overlay"
            isDarkMode={isDarkMode}
            workspaceSlug={workspaceSlug}
            workItem={overviewWorkIssue}
            boardId={boardId}
            lists={lists}
            boardCards={cards}
            epics={planningItems.filter((p) => String(p.type || '').toLowerCase() === 'epic')}
            features={planningItems.filter((p) => String(p.type || '').toLowerCase() === 'feature')}
            sprints={sprints}
            workTypeConfig={projectPayload?.workTypeConfig}
            priorityConfig={projectPayload?.priorityConfig}
            projectCode={resolvedBoard?.projectCode || ''}
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
            canViewMembers={hubCaps.canViewMembers}
            onClose={() => setOverviewWorkIssue(null)}
            onOpenWorkItem={(card) => {
              if (card) setOverviewWorkIssue(card);
            }}
            onPatchBoardCards={onPatchBoardCards}
            onUpdateCard={async (cardId, patch) => {
              onPatchBoardCards?.((prev) =>
                (prev || []).map((c) =>
                  String(c._id || c.id) === String(cardId) ? { ...c, ...patch } : c
                )
              );
              setOverviewWorkIssue((prev) =>
                prev && String(prev._id || prev.id) === String(cardId) ? { ...prev, ...patch } : prev
              );
              const keys = Object.keys(patch || {});
              if (keys.length === 1 && keys[0] === 'comments') return;
              if (patch && typeof patch === 'object' && !Array.isArray(patch)) {
                try {
                  return await taskAPI.updateBoardCard(cardId, patch, apiCtx || {});
                } catch (err) {
                  toast.error(
                    resolveApiErrorMessage(err, {
                      t,
                      fallback: t('workspace.projectHubPlanCreateFail'),
                    })
                  );
                  throw err;
                }
              }
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
