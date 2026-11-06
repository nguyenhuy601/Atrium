import useCountUp from './useCountUp';
import usePrefersReducedMotion from './usePrefersReducedMotion';

function KpiCard({ label, children, index, onClick, active }) {
  const reduce = usePrefersReducedMotion();
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-3 py-3 text-left transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-safe:animate-fade-in-fast ${
        active ? 'border-primary bg-primary/5' : 'border-border bg-card hover:bg-muted/30'
      }`}
      style={reduce ? undefined : { animationDelay: `${index * 50}ms` }}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-1 text-xl font-semibold tabular-nums text-foreground sm:text-2xl">{children}</div>
    </button>
  );
}

function Count({ value, decimals = 0 }) {
  const n = useCountUp(value, { decimals, durationMs: 800 });
  return <span>{decimals > 0 ? Number(n).toFixed(decimals) : n}</span>;
}

export default function ClosureReportKpiStrip({ view, t }) {
  const k = view?.kpis || {};
  const onTimeLabel =
    k.onTime == null
      ? t('workspace.projectHubCompleteProjectOnTimeUnknown')
      : k.onTime
        ? t('workspace.projectHubCompleteProjectOnTimeYes')
        : t('workspace.projectHubCompleteProjectOnTimeNo');

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      <KpiCard index={0} label={t('workspace.closureReportKpiWork')}>
        <Count value={k.doneCount} />
        <span className="text-sm font-medium text-muted-foreground">
          /<Count value={k.total} />
        </span>
      </KpiCard>
      <KpiCard index={1} label={t('workspace.closureReportKpiOnTime')}>
        <span className="text-base sm:text-lg">{onTimeLabel}</span>
      </KpiCard>
      <KpiCard index={2} label={t('workspace.closureReportKpiVelocity')}>
        <Count value={k.velocityHoursAverage ?? 0} decimals={1} />
        <span className="ml-1 text-sm font-medium text-muted-foreground">h</span>
      </KpiCard>
      <KpiCard index={3} label={t('workspace.closureReportKpiDefect')}>
        <Count value={k.bugCount ?? 0} />
        <span className="ml-1 text-sm font-medium text-muted-foreground">
          · {k.defectRate == null ? '—' : Number(k.defectRate).toFixed(3)}
        </span>
      </KpiCard>
      <KpiCard index={4} label={t('workspace.closureReportKpiHours')}>
        <Count value={k.plannedHours ?? 0} decimals={1} />
        <span className="text-sm font-medium text-muted-foreground">
          {' '}
          / <Count value={k.actualHours ?? 0} decimals={1} />h
        </span>
      </KpiCard>
      <KpiCard index={5} label={t('workspace.closureReportKpiMembers')}>
        <Count value={k.memberCount ?? 0} />
      </KpiCard>
    </div>
  );
}
