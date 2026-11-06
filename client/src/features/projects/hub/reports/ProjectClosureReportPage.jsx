import { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useAppStrings } from '../../../../locales/appStrings';
import { resolveApiErrorMessage } from '../../../../utils/resolveApiErrorMessage';
import { AdminLoadErrorState } from '../../../../components/adminUsers/adminPanelStates';
import { VH_MOTION_TAB_PANEL } from '../../../../motion/classes';
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
    return <p className="text-xs text-muted-foreground">{t('workspace.closureReportTechEmpty')}</p>;
  }
  return (
    <ul className="flex flex-wrap gap-1.5">
      {chips.map((c) => (
        <li
          key={`${c.kind}-${c.label}`}
          className="rounded-md border border-border bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-foreground"
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
    <div className="flex justify-between gap-3 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium text-foreground">{value}</dd>
    </div>
  );
}

function ClosureReportFilterDetail({ rows, t }) {
  if (!rows?.length) return null;
  return (
    <section className="rounded-xl border border-border bg-muted/20 p-3">
      <h3 className="text-sm font-semibold text-foreground">
        {t('workspace.closureReportDetailTitle')}
      </h3>
      <div className="mt-2 space-y-3">
        {rows.map((row, idx) => {
          const key = `${row.kind || 'row'}-${row.name || idx}`;
          if (row.kind === 'sprint') {
            return (
              <dl key={key} className="space-y-1.5 rounded-lg border border-border bg-background p-3">
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
              <dl key={key} className="space-y-1.5 rounded-lg border border-border bg-background p-3">
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
              <dl key={key} className="space-y-1.5 rounded-lg border border-border bg-background p-3">
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
              <dl key={key} className="space-y-1.5 rounded-lg border border-border bg-background p-3">
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
  const { data, isPending, isError, error, refetch } = useClosureReportQuery(pid);
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

  /** Chart click = toggle; select dropdown = apply/clear. */
  const onChartSelect = (dimension, key) => {
    setSelection((prev) => toggleSelection(prev, dimension, key));
  };
  const onSlicerSelect = (dimension, key) => {
    if (key == null || key === '') {
      setSelection((prev) =>
        prev?.dimension === dimension ? emptySelection() : prev
      );
      return;
    }
    setSelection(applySelection(dimension, key));
  };
  const onClear = () => setSelection(emptySelection());

  if (isPending && !data) {
    return (
      <div
        className={`flex min-h-[12rem] items-center justify-center gap-2 p-6 text-sm text-muted-foreground ${VH_MOTION_TAB_PANEL}`}
        aria-busy="true"
      >
        <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden />
        <span>{t('common.loading')}</span>
      </div>
    );
  }

  if (isError && !data) {
    return (
      <div className={`flex min-h-[12rem] items-center justify-center p-6 ${VH_MOTION_TAB_PANEL}`}>
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
      <div className={`mx-auto max-w-3xl space-y-3 p-4 sm:p-6 ${VH_MOTION_TAB_PANEL}`}>
        <h1 className="text-lg font-semibold text-foreground">
          {t('workspace.closureReportTitle')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('workspace.closureReportEmpty')}</p>
      </div>
    );
  }

  return (
    <div className={`mx-auto flex w-full max-w-7xl flex-col gap-4 p-3 sm:p-4 lg:p-6 ${VH_MOTION_TAB_PANEL}`}>
      <header className="space-y-2">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {t('workspace.closureReportTitle')}
            </p>
            <h1 className="text-xl font-semibold text-foreground sm:text-2xl">
              {data?.title || t('workspace.closureReportUntitled')}
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">
              {t('workspace.closureReportClosedAt', {
                date: formatClosedAt(data?.closedAt || snapshot.at, t),
              })}
              {data?.projectCode ? ` · ${data.projectCode}` : ''}
            </p>
          </div>
          <TechChips techStack={view.techStack} t={t} />
        </div>
      </header>

      <ClosureReportSlicers
        view={view}
        selection={selection}
        onSelect={onSlicerSelect}
        onClear={onClear}
        t={t}
      />

      <ClosureReportKpiStrip view={view} t={t} />

      <ClosureReportCharts
        view={view}
        selection={selection}
        onSelect={onChartSelect}
        t={t}
      />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-3">
          <h3 className="text-sm font-semibold text-foreground">
            {t('workspace.closureReportProcessTitle')}
          </h3>
          <dl className="mt-2 space-y-1.5 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">{t('workspace.closureReportApprovalWait')}</dt>
              <dd className="tabular-nums font-medium text-foreground">
                {view.process.approvalWaitHoursAverage == null
                  ? '—'
                  : `${view.process.approvalWaitHoursAverage}h`}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">{t('workspace.closureReportSpillover')}</dt>
              <dd className="tabular-nums font-medium text-foreground">
                {view.process.historicalSpilloverCount}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">{t('workspace.closureReportWip')}</dt>
              <dd className="tabular-nums font-medium text-foreground">
                {view.process.wipLimit == null ? '—' : view.process.wipLimit}
              </dd>
            </div>
          </dl>
        </section>

        <section className="rounded-xl border border-border bg-card p-3">
          <h3 className="text-sm font-semibold text-foreground">
            {t('workspace.closureReportExperienceTitle')}
          </h3>
          <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">
            {view.experience.closeNotes || t('workspace.closureReportNotesEmpty')}
          </p>
          {view.experience.sprintReviewNotes?.length ? (
            <ul className="mt-3 space-y-2">
              {view.experience.sprintReviewNotes.map((row) => (
                <li key={row.sprintId || row.name} className="text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">{row.name || '—'}: </span>
                  {row.reviewNotes}
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
