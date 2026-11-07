/**
 * Project hub Overview — Tabler-style dashboard (aligned with closure report).
 * Composition: header → KPI strip → charts → actions / delivery → activity.
 */
import { useId, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Eye,
  LayoutGrid,
  ListTodo,
  RefreshCw,
} from 'lucide-react';
import QueryStateView from '../../../components/Shared/QueryStateView';
import MotionFadeIn from '../../../motion/primitives/MotionFadeIn';
import MotionStagger from '../../../motion/primitives/MotionStagger';
import { VH_MOTION_BTN } from '../../../motion/classes';
import ProjectHubOverviewCharts from './ProjectHubOverviewCharts';
import useCountUp from './reports/useCountUp';
import {
  REPORT_BTN_PRIMARY,
  REPORT_BTN_SECONDARY,
  REPORT_CARD,
  REPORT_CARD_HEAD,
  REPORT_CARD_PAD,
  REPORT_CARD_TITLE,
  REPORT_EYEBROW,
  REPORT_PAGE,
} from './reports/hubDashboardUi';
import {
  formatHubDate,
  formatHubMethodology,
  formatHubProjectStatus,
  hubAttentionState,
  normalizeIssueType,
} from './projectHubUtils';
import { deliveryPhaseLabelKey } from '../../../utils/projectPhaseNav';

function OverviewMetricSkeleton({ count = 4 }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="h-[5.5rem] animate-pulse rounded-lg border border-border bg-muted motion-reduce:animate-none"
          aria-hidden
        />
      ))}
    </div>
  );
}

function OverviewContextSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-56 animate-pulse rounded-lg border border-border bg-muted motion-reduce:animate-none"
            aria-hidden
          />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="h-40 animate-pulse rounded-lg border border-border bg-muted motion-reduce:animate-none"
            aria-hidden
          />
        ))}
      </div>
    </div>
  );
}

function overviewIssueTypeLabel(type, t) {
  const raw = String(type || '').toLowerCase();
  if (raw === 'feature') return t('workspace.projectHubIssueTypeFeature');
  if (raw === 'subtask') return t('workspace.projectHubIssueTypeSubtask');
  const key = normalizeIssueType(type);
  if (key === 'story') return t('workspace.projectHubIssueTypeStory');
  if (key === 'bug') return t('workspace.projectHubIssueTypeBug');
  if (key === 'epic') return t('workspace.projectHubIssueTypeEpic');
  return t('workspace.projectHubIssueTypeTask');
}

function overviewActionStatusLabel(action, t) {
  if (action?.statusLabel) return action.statusLabel;
  const raw = String(action?.statusKey || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  if (!raw) return '';
  const key = `workspace.projectHubWorkStatus_${raw}`;
  const label = t(key);
  return label === key ? action.statusKey : label;
}

function overviewSprintStatusLabel(sprint, t) {
  const s = String(sprint?.status || 'planned').toLowerCase();
  const key = `workspace.projectHubPlanningStatus_${s}`;
  const label = t(key);
  return label === key ? s : label;
}

function OverviewHealthTip({ items = [], totalCount = 0, heading, moreLabel, children, className = '' }) {
  const tipId = useId();
  const [open, setOpen] = useState(false);
  const hasItems = items.length > 0;
  const hiddenMore = Math.max(0, Number(totalCount) - items.length);
  const hoverUnavailable =
    typeof window !== 'undefined' && window.matchMedia?.('(hover: none)').matches;

  return (
    <div
      className={`relative ${className}`}
      onMouseEnter={() => {
        if (!hoverUnavailable && hasItems) setOpen(true);
      }}
      onMouseLeave={() => {
        if (!hoverUnavailable) setOpen(false);
      }}
      onFocus={() => hasItems && setOpen(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
      }}
      onClick={() => {
        if (hoverUnavailable && hasItems) setOpen((v) => !v);
      }}
      onKeyDown={(e) => {
        if (!hasItems) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setOpen((v) => !v);
        }
      }}
    >
      {typeof children === 'function' ? children({ tipId, open, hasItems }) : children}
      {open && hasItems ? (
        <div
          id={tipId}
          role="tooltip"
          className="absolute left-0 top-full z-20 mt-1.5 w-max max-w-[min(16rem,calc(100vw-2rem))] rounded-md border border-border bg-card px-2.5 py-2 text-left shadow-sm sm:left-1/2 sm:-translate-x-1/2"
        >
          {heading ? (
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {heading}
            </p>
          ) : null}
          <ul className="space-y-0.5">
            {items.map((row) => (
              <li key={row.id || row.title} className="truncate text-xs font-medium text-foreground">
                {row.title}
              </li>
            ))}
          </ul>
          {hiddenMore > 0 && moreLabel ? (
            <p className="mt-1 text-[10px] text-muted-foreground">{moreLabel}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function KpiCountValue({ numeric, suffix = '', decimals = 0, className = '' }) {
  const n = useCountUp(numeric, { decimals, durationMs: 900 });
  const display =
    decimals > 0 ? Number(n).toFixed(decimals) : String(Math.round(Number(n) || 0));
  return (
    <span className={className}>
      {display}
      {suffix}
    </span>
  );
}

/** Tabler metric card — label on top, big value, optional foot / icon. */
function KpiTile({
  numeric,
  suffix = '',
  label,
  extra,
  tone,
  icon: Icon,
  tipItems,
  tipTotal,
  tipHeading,
  moreLabel,
}) {
  const valueTone =
    tone === 'destructive'
      ? 'text-destructive'
      : tone === 'warning'
        ? 'text-amber-700 dark:text-amber-300'
        : tone === 'success'
          ? 'text-emerald-700 dark:text-emerald-300'
          : 'text-foreground';
  const iconWrap =
    tone === 'destructive'
      ? 'bg-destructive/15 text-destructive'
      : tone === 'warning'
        ? 'bg-amber-500/15 text-amber-800 dark:text-amber-200'
        : tone === 'success'
          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
          : 'bg-primary/15 text-primary';

  const tile = (
    <div
      data-testid="overview-kpi-card"
      className={`${REPORT_CARD} flex h-full min-h-[5.5rem] flex-col gap-2 p-4 ${
        tipItems?.length ? 'cursor-help' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {Icon ? (
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${iconWrap}`}
            aria-hidden
          >
            <Icon size={16} strokeWidth={2} />
          </span>
        ) : null}
      </div>
      <div className={`text-2xl font-bold tabular-nums tracking-tight sm:text-[1.65rem] ${valueTone}`}>
        <KpiCountValue numeric={numeric} suffix={suffix} />
      </div>
      {extra ? <p className="mt-auto text-[11px] text-muted-foreground">{extra}</p> : null}
    </div>
  );

  if (!(tipItems?.length > 0)) return tile;

  return (
    <OverviewHealthTip
      items={tipItems}
      totalCount={tipTotal}
      heading={tipHeading}
      moreLabel={moreLabel}
    >
      {({ tipId, hasItems }) => (
        <div tabIndex={hasItems ? 0 : undefined} aria-describedby={hasItems ? tipId : undefined}>
          {tile}
        </div>
      )}
    </OverviewHealthTip>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/50 py-2 text-sm last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium tabular-nums text-foreground">{value}</dd>
    </div>
  );
}

export default function ProjectHubOverviewPanel({
  board,
  projectStatus = '',
  deliveryPhase = 'development',
  summary,
  deliveryExtras = { unassigned: 0, estimateHours: 0 },
  dashboardCharts = null,
  nextActions = [],
  overdueCards = [],
  inReviewCards = [],
  overviewCards = [],
  overviewLists = [],
  overviewMembers = [],
  chartWorkItemsLoading = false,
  activity,
  activityLoading = false,
  activityError = false,
  onRetryActivity,
  activeSprint = null,
  sprintIssueCount = 0,
  planningPulse = { epic: 0, feature: 0 },
  boardLoading = false,
  sprintContextLoading = false,
  planningContextLoading = false,
  locale,
  isDarkMode: _isDarkMode,
  onOpenBoard,
  onOpenBacklog,
  onOpenNextAction,
  onViewAllActivity,
  overviewVisibility = null,
  activityRestricted = false,
  t,
}) {
  const vis = overviewVisibility || {
    capsReady: false,
    canViewTaskMetrics: false,
    canViewMemberBreakdown: false,
    canViewSprintContext: false,
    canViewPlanningPulse: false,
    canViewActivity: false,
    canShowAssigneeNames: false,
    canOpenBacklog: false,
    canOpenBoard: false,
  };
  const muted = 'text-muted-foreground';
  const titleCls = 'text-foreground';
  const chartCardCls = `${REPORT_CARD_PAD}`;

  const statusLabel = formatHubProjectStatus(projectStatus, t);
  const phaseLabel = t(deliveryPhaseLabelKey(deliveryPhase));
  const attention = hubAttentionState({ overdue: summary.overdue });
  const reviewPercent = summary.total
    ? Math.round(((Number(summary.inReview) || 0) / Number(summary.total)) * 100)
    : 0;
  const estimateLabel =
    Number(deliveryExtras.estimateHours) % 1 === 0
      ? String(deliveryExtras.estimateHours)
      : Number(deliveryExtras.estimateHours).toFixed(1);
  const showBacklogCta = Boolean(vis.canOpenBacklog);
  const showBoardCta = Boolean(vis.canOpenBoard);
  const showActivity = Boolean(vis.canViewActivity) && !activityRestricted;
  const donePct = Math.min(100, Math.max(0, Number(summary.donePercent) || 0));

  const kpiItems = [
    {
      key: 'total',
      numeric: Number(summary.total) || 0,
      suffix: '',
      label: t('workspace.projectHubStatCards'),
      extra: '',
      tone: '',
      icon: ClipboardList,
      tipItems: null,
      tipTotal: 0,
      tipHeading: '',
    },
    {
      key: 'done',
      numeric: Number(summary.donePercent) || 0,
      suffix: '%',
      label: t('workspace.projectHubStatDone'),
      extra:
        summary.total > 0 ? t('workspace.projectHubStatDoneSub', { n: summary.done || 0 }) : '',
      tone: summary.donePercent >= 80 ? 'success' : '',
      icon: CheckCircle2,
      tipItems: null,
      tipTotal: 0,
      tipHeading: '',
    },
    {
      key: 'inReview',
      numeric: Number(summary.inReview) || 0,
      suffix: '',
      label: t('workspace.projectHubStatInReview'),
      extra: t('workspace.projectHubStatInReviewPct', { pct: reviewPercent }),
      tone: Number(summary.inReview) > 0 ? 'warning' : '',
      icon: Eye,
      tipItems: inReviewCards,
      tipTotal: Number(summary.inReview) || 0,
      tipHeading: t('workspace.projectHubHealthTipInReview'),
    },
    {
      key: 'overdue',
      numeric: Number(summary.overdue) || 0,
      suffix: '',
      label: t('workspace.projectHubStatOverdue'),
      extra: '',
      tone: attention === 'attention' ? 'destructive' : '',
      icon: AlertTriangle,
      tipItems: overdueCards,
      tipTotal: Number(summary.overdue) || 0,
      tipHeading: t('workspace.projectHubHealthTipOverdue'),
    },
  ];

  return (
    <div className={REPORT_PAGE} data-testid="project-hub-overview">
      {/* Header — eyebrow + title + meta + CTAs */}
      <MotionFadeIn delay={0}>
        <header className={REPORT_CARD_PAD} aria-labelledby="overview-hero-title">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <p className={REPORT_EYEBROW}>{t('workspace.projectHubTabOverview')}</p>
              <h2
                id="overview-hero-title"
                className="mt-1 text-xl font-semibold tracking-tight text-foreground sm:text-2xl"
              >
                {board?.title || t('workspace.projectHubUntitled')}
              </h2>
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                {board?.projectCode ? (
                  <span className="inline-flex items-center rounded-md border border-border bg-muted/50 px-2 py-0.5 font-mono text-[11px] font-semibold text-foreground">
                    {board.projectCode}
                  </span>
                ) : null}
                {board?.methodology ? (
                  <span className="inline-flex items-center rounded-md border border-border bg-muted/50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-foreground">
                    {formatHubMethodology(board.methodology, t)}
                  </span>
                ) : null}
                {statusLabel ? (
                  <span className="inline-flex items-center rounded-md border border-border bg-card px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-foreground">
                    {statusLabel}
                  </span>
                ) : null}
                {phaseLabel ? (
                  <span className="inline-flex items-center rounded-md border border-primary/20 bg-primary/5 px-2 py-0.5 text-[11px] font-semibold text-primary">
                    {phaseLabel}
                  </span>
                ) : null}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Calendar size={13} className="shrink-0 opacity-70" aria-hidden />
                  {t('workspace.projectHubFieldDue')}: {formatHubDate(board?.dueDate, locale)}
                </span>
              </div>
            </div>
            {showBacklogCta || showBoardCta ? (
              <div className="flex shrink-0 flex-wrap gap-2">
                {showBacklogCta ? (
                  <button
                    type="button"
                    onClick={onOpenBacklog}
                    aria-label={t('workspace.projectHubOpenBacklog')}
                    className={REPORT_BTN_SECONDARY}
                  >
                    <ListTodo size={14} className="shrink-0 opacity-70" aria-hidden />
                    <span className="lg:hidden">{t('workspace.projectHubOpenBacklogShort')}</span>
                    <span className="hidden lg:inline">{t('workspace.projectHubOpenBacklog')}</span>
                  </button>
                ) : null}
                {showBoardCta ? (
                  <button
                    type="button"
                    onClick={onOpenBoard}
                    aria-label={t('workspace.projectHubOpenBoard')}
                    className={REPORT_BTN_PRIMARY}
                  >
                    <LayoutGrid size={14} className="shrink-0" aria-hidden />
                    <span className="lg:hidden">{t('workspace.projectHubOpenBoardShort')}</span>
                    <span className="hidden lg:inline">{t('workspace.projectHubOpenBoard')}</span>
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </header>
      </MotionFadeIn>

      {/* KPI strip */}
      {vis.canViewTaskMetrics ? (
        <MotionFadeIn delay={0.04}>
          <section aria-labelledby="overview-project-health" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 px-0.5">
              <h3 id="overview-project-health" className={REPORT_EYEBROW}>
                {t('workspace.projectHubProjectHealth')}
              </h3>
              <div
                className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                  attention === 'attention'
                    ? 'bg-destructive/10 text-destructive'
                    : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                }`}
                role="status"
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    attention === 'attention' ? 'bg-destructive' : 'bg-emerald-500'
                  }`}
                  aria-hidden
                />
                {attention === 'attention'
                  ? t('workspace.projectHubHealthAttention', { n: summary.overdue })
                  : t('workspace.projectHubHealthOnTrack')}
              </div>
            </div>

            {boardLoading ? (
              <OverviewMetricSkeleton count={4} />
            ) : (
              <>
                <MotionStagger
                  className="grid grid-cols-2 items-stretch gap-3 lg:grid-cols-4"
                  itemClassName="h-full min-w-0"
                  data-testid="overview-kpi-strip"
                >
                  {kpiItems.map((item) => (
                    <KpiTile
                      key={item.key}
                      {...item}
                      moreLabel={t('workspace.projectHubHealthTipMore', {
                        n: Math.max(0, item.tipTotal - (item.tipItems?.length || 0)),
                      })}
                    />
                  ))}
                </MotionStagger>

                <div className={`${REPORT_CARD} space-y-3 p-4`}>
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-muted-foreground">{t('workspace.projectHubStatDone')}</span>
                    <span className="font-semibold tabular-nums text-foreground">
                      <KpiCountValue numeric={donePct} suffix="%" />
                    </span>
                  </div>
                  <div
                    className="h-1.5 overflow-hidden rounded-full bg-muted"
                    role="progressbar"
                    aria-valuenow={donePct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={t('workspace.projectHubStatDone')}
                  >
                    <div
                      className="h-full rounded-full bg-primary transition-[width] duration-[var(--vh-motion-slow)] ease-[var(--vh-motion-ease)] motion-reduce:transition-none"
                      style={{ width: `${donePct}%` }}
                    />
                  </div>
                  {Number(deliveryExtras.estimateHours) > 0 ? (
                    <p className="text-[11px] text-muted-foreground">
                      {t('workspace.projectHubStatEstimateTotal')}{' '}
                      <span className="font-semibold text-foreground">{estimateLabel}h</span>
                    </p>
                  ) : null}
                </div>
              </>
            )}
          </section>
        </MotionFadeIn>
      ) : null}

      {boardLoading ? (
        <OverviewContextSkeleton />
      ) : vis.canViewTaskMetrics && dashboardCharts ? (
        <MotionFadeIn delay={0.08}>
          <ProjectHubOverviewCharts
            charts={dashboardCharts}
            cards={overviewCards}
            lists={overviewLists}
            members={overviewMembers}
            cardsLoading={chartWorkItemsLoading}
            showAssigneeChart={vis.canViewMemberBreakdown}
            muted={muted}
            titleCls={titleCls}
            cardCls={chartCardCls}
            t={t}
            onOpenCard={onOpenNextAction}
          />
        </MotionFadeIn>
      ) : null}

      {boardLoading || !vis.canViewTaskMetrics ? null : (
        <MotionFadeIn delay={0.1}>
          <div className="grid items-stretch gap-4 lg:grid-cols-[1.45fr_1fr]">
            <section
              className={`${REPORT_CARD_PAD} flex h-full min-h-0 flex-col`}
              aria-labelledby="overview-action-center"
            >
              <header className={REPORT_CARD_HEAD}>
                <h3 id="overview-action-center" className={REPORT_CARD_TITLE}>
                  {t('workspace.projectHubNextActions')}
                </h3>
              </header>
              {nextActions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t('workspace.projectHubNextActionsEmpty')}
                </p>
              ) : (
                <ul className="scrollbar-overlay max-h-72 divide-y divide-border/60 overflow-y-auto overscroll-contain">
                  {nextActions.map((a) => {
                    const dueCls =
                      a.dueTone === 'overdue'
                        ? 'text-destructive'
                        : a.dueTone === 'soon'
                          ? 'text-primary'
                          : 'text-muted-foreground';
                    const statusText = overviewActionStatusLabel(a, t);
                    const who = vis.canShowAssigneeNames
                      ? a.assigneeName || t('workspace.projectHubStatUnassigned')
                      : a.assigneeName
                        ? t('workspace.projectHubOverviewAssigneeRestricted')
                        : t('workspace.projectHubStatUnassigned');
                    return (
                      <li key={a.id}>
                        <button
                          type="button"
                          onClick={() => onOpenNextAction?.(a.id)}
                          className={`w-full px-1 py-2.5 text-left transition-colors motion-reduce:transition-none hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${VH_MOTION_BTN} ${
                            String(a.issueType || '').toLowerCase() === 'bug'
                              ? 'bg-rose-500/[0.03]'
                              : a.dueTone === 'overdue'
                                ? 'bg-destructive/[0.03]'
                                : ''
                          }`}
                        >
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                              {overviewIssueTypeLabel(a.issueType, t)}
                            </span>
                            {a.issueKey ? (
                              <span className="font-mono text-[10px] font-semibold text-primary">
                                {a.issueKey}
                              </span>
                            ) : null}
                          </div>
                          <span className="mt-1 block text-sm font-semibold text-foreground">
                            {a.title}
                          </span>
                          <span className="mt-0.5 block text-[11px] text-muted-foreground">
                            {statusText ? `${statusText} · ${who}` : who}
                          </span>
                          {a.parentTitle ? (
                            <span className="mt-0.5 block text-[11px] text-muted-foreground">
                              {t('workspace.projectHubAttentionChildOf', { parent: a.parentTitle })}
                            </span>
                          ) : a.isChild ? (
                            <span className="mt-0.5 block text-[11px] text-muted-foreground">
                              {t('workspace.projectHubAttentionHiddenChild')}
                            </span>
                          ) : null}
                          {a.dueDate ? (
                            <span className={`mt-0.5 block text-[11px] ${dueCls}`}>
                              {t('workspace.projectHubActionDue', {
                                date: formatHubDate(a.dueDate, locale),
                              })}
                            </span>
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section
              className={`${REPORT_CARD_PAD} flex h-full min-h-0 flex-col`}
              aria-labelledby="overview-delivery-snapshot"
            >
              <header className={REPORT_CARD_HEAD}>
                <h3 id="overview-delivery-snapshot" className={REPORT_CARD_TITLE}>
                  {t('workspace.projectHubDeliveryPulse')}
                </h3>
              </header>
              <dl>
                <DetailRow
                  label={t('workspace.projectHubSnapshotProgress')}
                  value={`${summary.donePercent}%`}
                />
                <DetailRow
                  label={t('workspace.projectHubFieldDue')}
                  value={formatHubDate(board?.dueDate, locale)}
                />
                <DetailRow
                  label={t('workspace.projectHubVisibilityLabel')}
                  value={
                    board?.visibility === 'workspace'
                      ? t('workspace.projectHubVisibilityWorkspace')
                      : t('workspace.projectHubVisibilityPrivate')
                  }
                />
              </dl>

              {vis.canViewSprintContext ? (
                <div className="mt-4 border-t border-border/70 pt-4">
                  <p className={`${REPORT_EYEBROW} mb-2`}>
                    {t('workspace.projectHubOverviewActiveSprint')}
                  </p>
                  {sprintContextLoading ? (
                    <div
                      className="h-16 animate-pulse rounded-md bg-muted motion-reduce:animate-none"
                      aria-busy="true"
                      aria-label={t('common.loading')}
                    />
                  ) : activeSprint ? (
                    <div className="space-y-1 rounded-md border border-border bg-muted/20 px-3 py-2.5">
                      <p className="text-sm font-semibold text-foreground">
                        {activeSprint.name || t('workspace.projectHubUntitled')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {overviewSprintStatusLabel(activeSprint, t)}
                      </p>
                      {activeSprint.startDate || activeSprint.endDate ? (
                        <p className="text-xs text-muted-foreground">
                          {t('workspace.projectHubOverviewSprintDates', {
                            start: formatHubDate(activeSprint.startDate, locale),
                            end: formatHubDate(activeSprint.endDate, locale),
                          })}
                        </p>
                      ) : null}
                      <p className="text-xs text-muted-foreground">
                        {t('workspace.projectHubOverviewSprintIssues', { n: sprintIssueCount })}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {t('workspace.projectHubOverviewActiveSprintEmpty')}
                    </p>
                  )}
                </div>
              ) : null}

              {vis.canViewPlanningPulse ? (
                <div className="mt-4 border-t border-border/70 pt-4">
                  <p className={`${REPORT_EYEBROW} mb-2`}>
                    {t('workspace.projectHubOverviewBacklogPulse')}
                  </p>
                  {planningContextLoading ? (
                    <div
                      className="h-12 animate-pulse rounded-md bg-muted motion-reduce:animate-none"
                      aria-busy="true"
                      aria-label={t('common.loading')}
                    />
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        [String(planningPulse.epic || 0), t('workspace.projectHubOverviewBacklogEpics')],
                        [
                          String(planningPulse.feature || 0),
                          t('workspace.projectHubOverviewBacklogFeatures'),
                        ],
                      ].map(([v, l]) => (
                        <div
                          key={l}
                          className="rounded-md border border-border bg-muted/20 px-2 py-2.5 text-center"
                        >
                          <div className="text-base font-bold tabular-nums text-foreground">{v}</div>
                          <div className="text-[10px] text-muted-foreground">{l}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}

              {board?.description ? (
                <p className="mt-4 line-clamp-3 border-t border-border/70 pt-4 text-xs leading-relaxed text-muted-foreground">
                  {board.description}
                </p>
              ) : null}
            </section>
          </div>
        </MotionFadeIn>
      )}

      {showActivity ? (
        <MotionFadeIn delay={0.12}>
          <section className={REPORT_CARD_PAD} aria-labelledby="overview-recent-activity">
            <header className={REPORT_CARD_HEAD}>
              <h3 id="overview-recent-activity" className={REPORT_CARD_TITLE}>
                {t('workspace.projectHubRecentActivity')}
              </h3>
              {!activityLoading && !activityError && activity.length > 0 ? (
                <button
                  type="button"
                  onClick={onViewAllActivity}
                  className="text-xs font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {t('workspace.projectHubActivityViewAll')}
                </button>
              ) : null}
            </header>
            {activityLoading ? (
              <QueryStateView loading loadingClassName="space-y-2 py-1" skeletonLines={3} />
            ) : activityError ? (
              <div className="flex flex-col items-start gap-2">
                <p className="text-sm text-muted-foreground">
                  {t('workspace.projectHubActivityLoadFail')}
                </p>
                <button type="button" onClick={onRetryActivity} className={REPORT_BTN_SECONDARY}>
                  <RefreshCw size={14} aria-hidden />
                  {t('workspace.projectHubActivityRetry')}
                </button>
              </div>
            ) : activity.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('workspace.projectHubActivityEmpty')}</p>
            ) : (
              <ul className="divide-y divide-border/60">
                {activity.slice(0, 6).map((a) => (
                  <li key={a.id} className="py-2.5 text-xs text-muted-foreground first:pt-0 last:pb-0">
                    <span className="font-medium text-foreground">{a.title}</span>
                    <span className="mt-0.5 block">
                      {a.actorName ? (
                        <>
                          <span className="text-foreground">{a.actorName}</span>
                          {a.detail || a.at ? ' · ' : ''}
                        </>
                      ) : null}
                      {[a.detail, formatHubDate(a.at, locale)].filter(Boolean).join(' · ')}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </MotionFadeIn>
      ) : null}
    </div>
  );
}
