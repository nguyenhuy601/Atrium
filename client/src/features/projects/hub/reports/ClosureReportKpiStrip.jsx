import { Bug, Gauge, Timer, Users } from 'lucide-react';
import MotionStagger from '../../../../motion/primitives/MotionStagger';
import useCountUp from './useCountUp';
import { REPORT_CARD } from './hubDashboardUi';

function Count({ value, decimals = 0 }) {
  const n = useCountUp(value, { decimals, durationMs: 900 });
  return <span>{decimals > 0 ? Number(n).toFixed(decimals) : n}</span>;
}

/** Tabler-style top metric: label, big value, optional progress / foot. */
function MetricCard({ label, children, foot = null, progress = null }) {
  return (
    <div className={`${REPORT_CARD} flex flex-col gap-3 p-4`}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="text-2xl font-bold tabular-nums tracking-tight text-foreground sm:text-[1.65rem]">
        {children}
      </div>
      {progress != null ? (
        <div className="mt-auto space-y-1.5">
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-[width] motion-reduce:transition-none"
              style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
            />
          </div>
          {foot}
        </div>
      ) : foot ? (
        <div className="mt-auto">{foot}</div>
      ) : null}
    </div>
  );
}

/** Tabler icon strip — colored square + label/value. */
function IconStat({ label, value, icon: Icon, tone = 'primary' }) {
  const toneCls =
    tone === 'success'
      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
      : tone === 'warning'
        ? 'bg-amber-500/15 text-amber-800 dark:text-amber-200'
        : tone === 'danger'
          ? 'bg-destructive/15 text-destructive'
          : 'bg-primary/15 text-primary';

  return (
    <div className={`${REPORT_CARD} flex items-center gap-3 p-3.5`}>
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${toneCls}`}
        aria-hidden
      >
        <Icon size={18} strokeWidth={2} />
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold tabular-nums text-foreground">{value}</p>
        <p className="truncate text-[11px] text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

export default function ClosureReportKpiStrip({ view, t }) {
  const k = view?.kpis || {};
  const total = Number(k.total) || 0;
  const done = Number(k.doneCount) || 0;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  const onTimeLabel =
    k.onTime == null
      ? t('workspace.projectHubCompleteProjectOnTimeUnknown')
      : k.onTime
        ? t('workspace.projectHubCompleteProjectOnTimeYes')
        : t('workspace.projectHubCompleteProjectOnTimeNo');
  const onTimeTone =
    k.onTime == null ? 'primary' : k.onTime ? 'success' : 'danger';

  const hoursFoot = (
    <p className="text-[11px] text-muted-foreground">
      {t('workspace.closureReportHoursPlanned')}{' '}
      <span className="font-semibold text-foreground">
        <Count value={k.plannedHours ?? 0} decimals={1} />
      </span>
      {' · '}
      {t('workspace.closureReportHoursActual')}{' '}
      <span className="font-semibold text-foreground">
        <Count value={k.actualHours ?? 0} decimals={1} />h
      </span>
    </p>
  );

  return (
    <div className="space-y-3">
      <MotionStagger className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard
          label={t('workspace.closureReportKpiWork')}
          progress={pct}
          foot={
            <p className="text-[11px] text-muted-foreground">
              {t('workspace.closureReportWorkDone')} {pct}%
            </p>
          }
        >
          <Count value={done} />
          <span className="text-base font-semibold text-muted-foreground">
            /<Count value={total} />
          </span>
        </MetricCard>

        <MetricCard
          label={t('workspace.closureReportKpiVelocity')}
          foot={
            <p className="text-[11px] text-muted-foreground">
              {t('workspace.closureReportChartVelocity')}
            </p>
          }
        >
          <Count value={k.velocityHoursAverage ?? 0} decimals={1} />
          <span className="ml-1 text-base font-semibold text-muted-foreground">h</span>
        </MetricCard>

        <MetricCard label={t('workspace.closureReportKpiHours')} foot={hoursFoot}>
          <Count value={k.actualHours ?? 0} decimals={1} />
          <span className="ml-1 text-base font-semibold text-muted-foreground">h</span>
        </MetricCard>

        <MetricCard
          label={t('workspace.closureReportKpiOnTime')}
          foot={
            <p
              className={`text-[11px] font-semibold ${
                onTimeTone === 'success'
                  ? 'text-emerald-700 dark:text-emerald-300'
                  : onTimeTone === 'danger'
                    ? 'text-destructive'
                    : 'text-muted-foreground'
              }`}
            >
              {onTimeLabel}
            </p>
          }
        >
          <span className="text-xl font-bold sm:text-2xl">{onTimeLabel}</span>
        </MetricCard>
      </MotionStagger>

      <MotionStagger className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <IconStat
          label={t('workspace.closureReportBugs')}
          value={<Count value={k.bugCount ?? 0} />}
          icon={Bug}
          tone="warning"
        />
        <IconStat
          label={t('workspace.closureReportDefectRate')}
          value={k.defectRate == null ? '—' : Number(k.defectRate).toFixed(3)}
          icon={Gauge}
          tone="primary"
        />
        <IconStat
          label={t('workspace.closureReportReopen')}
          value={<Count value={k.reopenCount ?? 0} />}
          icon={Timer}
          tone={Number(k.reopenCount) > 0 ? 'danger' : 'success'}
        />
        <IconStat
          label={t('workspace.closureReportKpiMembers')}
          value={<Count value={k.memberCount ?? 0} />}
          icon={Users}
          tone="primary"
        />
      </MotionStagger>
    </div>
  );
}
