import { useMemo, useState } from 'react';
import { FilterX, Loader2, RefreshCw } from 'lucide-react';
import { useAppStrings } from '../../../../locales/appStrings';
import { resolveApiErrorMessage } from '../../../../utils/resolveApiErrorMessage';
import { AdminLoadErrorState } from '../../../../components/adminUsers/adminPanelStates';
import { VH_MOTION_SPINNER, VH_MOTION_TAB_PANEL } from '../../../../motion/classes';
import MotionFadeIn from '../../../../motion/primitives/MotionFadeIn';
import { memberDisplayName, memberUserId } from '../projectHubUtils';
import { useProjectHubMembers } from '../useProjectHubQueries';
import useClosureReportQuery from './useClosureReportQuery';
import {
  applySelection,
  deriveClosureReportView,
  emptySelection,
  toggleSelection,
} from './closureReportSelection';
import ClosureReportKpiStrip from './ClosureReportKpiStrip';
import ClosureReportCharts from './ClosureReportCharts';
import ClosureReportSlicers from './ClosureReportSlicers';
import {
  REPORT_BTN_PRIMARY,
  REPORT_BTN_SECONDARY,
  REPORT_CARD,
  REPORT_CARD_HEAD,
  REPORT_CARD_PAD,
  REPORT_CARD_TITLE,
  REPORT_EYEBROW,
  REPORT_PAGE,
} from './hubDashboardUi';

function formatClosedAt(iso, t) {
  if (!iso) return t('workspace.closureReportClosedAtUnknown');
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return String(iso);
  }
}

function TechChips({ techStack, t }) {
  const chips = [
    ...(techStack?.languages || []).map((x) => ({ kind: 'lang', label: x })),
    ...(techStack?.frameworks || []).map((x) => ({ kind: 'fw', label: x })),
    ...(techStack?.databases || []).map((x) => ({ kind: 'db', label: x })),
  ];
  if (!chips.length) {
    return (
      <p className="text-xs text-muted-foreground">{t('workspace.closureReportTechEmpty')}</p>
    );
  }
  return (
    <ul className="flex flex-wrap gap-1.5">
      {chips.map((c) => (
        <li
          key={`${c.kind}-${c.label}`}
          className="rounded-md border border-border bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-foreground"
        >
          {c.label}
        </li>
      ))}
    </ul>
  );
}

function DetailRow({ label, value }) {
  if (value == null || value === '') return null;
  return (
    <div className="flex justify-between gap-3 border-b border-border/50 py-2 text-sm last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium text-foreground">{value}</dd>
    </div>
  );
}

function ClosureReportFilterDetail({ rows, t }) {
  if (!rows?.length) return null;
  return (
    <section className={REPORT_CARD_PAD}>
      <header className={REPORT_CARD_HEAD}>
        <h3 className={REPORT_CARD_TITLE}>{t('workspace.closureReportDetailTitle')}</h3>
      </header>
      <div className="space-y-3">
        {rows.map((row, idx) => {
          const key = `${row.kind || 'row'}-${row.name || idx}`;
          if (row.kind === 'sprint') {
            return (
              <dl key={key} className="rounded-md border border-border bg-muted/20 px-3">
                <DetailRow label={t('workspace.closureReportDetailName')} value={row.name} />
                <DetailRow label={t('workspace.closureReportDetailDone')} value={row.doneCount} />
                <DetailRow
                  label={t('workspace.closureReportDetailIncomplete')}
                  value={row.incompleteCount}
                />
                <DetailRow
                  label={t('workspace.closureReportDetailVelocity')}
                  value={`${row.velocityHours} h`}
                />
                {row.committedHours != null ? (
                  <DetailRow
                    label={t('workspace.closureReportDetailCommitted')}
                    value={`${row.committedHours} h`}
                  />
                ) : null}
                {row.reviewNotes ? (
                  <DetailRow label={t('workspace.closureReportDetailNotes')} value={row.reviewNotes} />
                ) : null}
              </dl>
            );
          }
          if (row.kind === 'user') {
            return (
              <dl key={key} className="rounded-md border border-border bg-muted/20 px-3">
                <DetailRow label={t('workspace.closureReportDetailName')} value={row.name} />
                <DetailRow
                  label={t('workspace.closureReportDetailPlanned')}
                  value={`${row.plannedHours} h`}
                />
                <DetailRow
                  label={t('workspace.closureReportDetailActual')}
                  value={`${row.actualHours} h`}
                />
                {row.varianceHours != null ? (
                  <DetailRow
                    label={t('workspace.closureReportDetailVariance')}
                    value={`${row.varianceHours} h`}
                  />
                ) : null}
                <DetailRow label={t('workspace.closureReportDetailTasksDone')} value={row.tasksDone} />
                <DetailRow label={t('workspace.closureReportReopen')} value={row.reopenCount} />
                {row.technologiesHandled?.length ? (
                  <DetailRow
                    label={t('workspace.closureReportDetailTech')}
                    value={row.technologiesHandled.join(', ')}
                  />
                ) : null}
              </dl>
            );
          }
          if (row.kind === 'issueType') {
            return (
              <dl key={key} className="rounded-md border border-border bg-muted/20 px-3">
                <DetailRow label={t('workspace.closureReportDetailName')} value={row.name} />
                <DetailRow label={t('workspace.closureReportChartCount')} value={row.count} />
                {row.avgLeadTimeHours != null ? (
                  <DetailRow
                    label={t('workspace.closureReportDetailLeadTime')}
                    value={`${row.avgLeadTimeHours} h`}
                  />
                ) : null}
              </dl>
            );
          }
          if (row.kind === 'crStatus') {
            return (
              <dl key={key} className="rounded-md border border-border bg-muted/20 px-3">
                <DetailRow label={t('workspace.closureReportDetailName')} value={row.name} />
                <DetailRow label={t('workspace.closureReportChartCount')} value={row.count} />
              </dl>
            );
          }
          return null;
        })}
      </div>
    </section>
  );
}

export default function ProjectClosureReportPage({ projectId }) {
  const { t } = useAppStrings();
  const pid = String(projectId || '').trim();
  const { data, isPending, isError, error, refetch, isFetching } = useClosureReportQuery(pid);
  const membersQuery = useProjectHubMembers(pid, { enabled: Boolean(pid) });
  const [selection, setSelection] = useState(emptySelection);

  const nameByUserId = useMemo(() => {
    const map = {};
    for (const m of membersQuery.data || []) {
      const id = memberUserId(m);
      const name = memberDisplayName(m);
      if (id && name) map[id] = name;
    }
    return map;
  }, [membersQuery.data]);

  const labelHelpers = useMemo(
    () => ({
      nameByUserId,
      issueTypeLabel: (k) => {
        const key = String(k || '').trim();
        if (key === 'story') return t('workspace.projectHubStatStories');
        if (key === 'task') return t('workspace.projectHubStatTasks');
        if (key === 'bug') return t('workspace.projectHubStatBugs');
        return key || '—';
      },
      crStatusLabel: (k) => {
        const key = String(k || '').trim();
        if (!key) return '—';
        const i18nKey = `workspace.projectHubCrStatus_${key}`;
        const label = t(i18nKey);
        return label === i18nKey ? key : label;
      },
    }),
    [nameByUserId, t]
  );

  const snapshot = data?.closureSnapshot;
  const view = useMemo(
    () => deriveClosureReportView(snapshot, selection, labelHelpers),
    [snapshot, selection, labelHelpers]
  );

  const onChartSelect = (dimension, key) => {
    setSelection((prev) => toggleSelection(prev, dimension, key));
  };
  const onSlicerSelect = (dimension, key) => {
    if (key == null || key === '') {
      setSelection((prev) => (prev?.dimension === dimension ? emptySelection() : prev));
      return;
    }
    setSelection(applySelection(dimension, key));
  };
  const onClear = () => setSelection(emptySelection());

  if (isPending && !data) {
    return (
      <div
        className={`flex min-h-[12rem] items-center justify-center gap-2 bg-muted/40 p-6 text-sm text-muted-foreground ${VH_MOTION_TAB_PANEL}`}
        aria-busy="true"
      >
        <Loader2 className={`h-4 w-4 ${VH_MOTION_SPINNER}`} aria-hidden />
        <span>{t('common.loading')}</span>
      </div>
    );
  }

  if (isError && !data) {
    return (
      <div
        className={`flex min-h-[12rem] items-center justify-center bg-muted/40 p-6 ${VH_MOTION_TAB_PANEL}`}
      >
        <AdminLoadErrorState
          message={resolveApiErrorMessage(error, {
            t,
            fallback: t('workspace.closureReportLoadFail'),
          })}
          onRetry={() => void refetch()}
        />
      </div>
    );
  }

  if (!snapshot || typeof snapshot !== 'object') {
    return (
      <div className={`${REPORT_PAGE} ${VH_MOTION_TAB_PANEL}`}>
        <div className={REPORT_CARD_PAD}>
          <p className={REPORT_EYEBROW}>{t('workspace.closureReportEyebrow')}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">
            {t('workspace.closureReportTitle')}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">{t('workspace.closureReportEmpty')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`${REPORT_PAGE} ${VH_MOTION_TAB_PANEL}`}>
      <MotionFadeIn delay={0}>
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <p className={REPORT_EYEBROW}>{t('workspace.closureReportEyebrow')}</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {data?.title || t('workspace.closureReportUntitled')}
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {t('workspace.closureReportClosedAt', {
                date: formatClosedAt(data?.closedAt || snapshot.at, t),
              })}
              {data?.projectCode ? ` · ${data.projectCode}` : ''}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={REPORT_BTN_SECONDARY}
              onClick={onClear}
              disabled={!selection?.dimension}
            >
              <FilterX className="h-3.5 w-3.5" aria-hidden />
              {t('workspace.closureReportClearFilter')}
            </button>
            <button
              type="button"
              className={REPORT_BTN_PRIMARY}
              onClick={() => void refetch()}
              disabled={isFetching}
              aria-busy={isFetching || undefined}
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${isFetching ? VH_MOTION_SPINNER : ''}`}
                aria-hidden
              />
              {t('common.refresh')}
            </button>
          </div>
        </header>
      </MotionFadeIn>

      <MotionFadeIn delay={0.03}>
        <div className={`${REPORT_CARD} px-4 py-3 sm:px-5`}>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {t('workspace.closureReportTechStack')}
          </p>
          <TechChips techStack={view.techStack} t={t} />
        </div>
      </MotionFadeIn>

      <MotionFadeIn delay={0.05}>
        <ClosureReportSlicers
          view={view}
          selection={selection}
          onSelect={onSlicerSelect}
          onClear={onClear}
          t={t}
        />
      </MotionFadeIn>

      <MotionFadeIn delay={0.08}>
        <ClosureReportKpiStrip view={view} t={t} />
      </MotionFadeIn>

      <ClosureReportCharts
        view={view}
        selection={selection}
        onSelect={onChartSelect}
        t={t}
      />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <section className={REPORT_CARD_PAD}>
          <header className={REPORT_CARD_HEAD}>
            <h3 className={REPORT_CARD_TITLE}>{t('workspace.closureReportProcessTitle')}</h3>
          </header>
          <dl className="space-y-0">
            <div className="flex justify-between gap-2 border-b border-border/60 py-2.5 text-sm">
              <dt className="text-muted-foreground">{t('workspace.closureReportApprovalWait')}</dt>
              <dd className="tabular-nums font-semibold text-foreground">
                {view.process.approvalWaitHoursAverage == null
                  ? '—'
                  : `${view.process.approvalWaitHoursAverage}h`}
              </dd>
            </div>
            <div className="flex justify-between gap-2 border-b border-border/60 py-2.5 text-sm">
              <dt className="text-muted-foreground">{t('workspace.closureReportSpillover')}</dt>
              <dd className="tabular-nums font-semibold text-foreground">
                {view.process.historicalSpilloverCount}
              </dd>
            </div>
            <div className="flex justify-between gap-2 py-2.5 text-sm">
              <dt className="text-muted-foreground">{t('workspace.closureReportWip')}</dt>
              <dd className="tabular-nums font-semibold text-foreground">
                {view.process.wipLimit == null ? '—' : view.process.wipLimit}
              </dd>
            </div>
          </dl>
        </section>

        <section className={REPORT_CARD_PAD}>
          <header className={REPORT_CARD_HEAD}>
            <h3 className={REPORT_CARD_TITLE}>{t('workspace.closureReportExperienceTitle')}</h3>
          </header>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
            {view.experience.closeNotes || t('workspace.closureReportNotesEmpty')}
          </p>
          {view.experience.sprintReviewNotes?.length ? (
            <ul className="mt-4 divide-y divide-border/70 border-t border-border/70">
              {view.experience.sprintReviewNotes.map((row) => (
                <li key={row.sprintId || row.name} className="flex gap-3 py-2.5 text-sm">
                  <span className="w-28 shrink-0 truncate font-semibold text-foreground">
                    {row.name || '—'}
                  </span>
                  <span className="min-w-0 text-muted-foreground">{row.reviewNotes}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </div>

      {selection?.dimension && view.drawerRows?.length ? (
        <ClosureReportFilterDetail rows={view.drawerRows} t={t} />
      ) : null}
    </div>
  );
}
