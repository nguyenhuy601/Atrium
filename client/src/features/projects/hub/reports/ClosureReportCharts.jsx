import { useMemo } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  AreaChart,
  Area,
} from 'recharts';
import {
  CHART_ANIMATION_MS,
  LINE_ANIMATION_MS,
  getClosureReportChartTheme,
} from './closureReportChartTheme';
import { REPORT_DIMENSIONS } from './closureReportSelection';
import usePrefersReducedMotion from './usePrefersReducedMotion';
import MotionFadeIn from '../../../../motion/primitives/MotionFadeIn';
import useCountUp from './useCountUp';
import {
  REPORT_CARD,
  REPORT_CARD_HEAD,
  REPORT_CARD_TITLE,
} from './hubDashboardUi';

function ChartCard({ title, hint, children, delay = 0, className = '' }) {
  return (
    <MotionFadeIn delay={delay} className={`h-full min-h-0 ${className}`}>
      <section className={`${REPORT_CARD} flex h-full min-h-[18rem] flex-col p-4 sm:p-5`}>
        <header className={REPORT_CARD_HEAD}>
          <div className="min-w-0">
            <h3 className={REPORT_CARD_TITLE}>{title}</h3>
            {hint ? <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p> : null}
          </div>
        </header>
        <div className="min-h-0 flex-1">{children}</div>
      </section>
    </MotionFadeIn>
  );
}

function QualityStat({ label, value, decimals = 0, max = null }) {
  const n = useCountUp(value ?? 0, { decimals, durationMs: 900 });
  const display =
    value == null
      ? '—'
      : decimals > 0
        ? Number(n).toFixed(decimals)
        : String(Math.round(Number(n) || 0));
  const pct =
    max != null && Number(max) > 0 && value != null
      ? Math.min(100, Math.round((Number(value) / Number(max)) * 100))
      : null;

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-lg font-semibold tabular-nums text-foreground">{display}</span>
      </div>
      {pct != null ? (
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-[width] motion-reduce:transition-none"
            style={{ width: `${pct}%` }}
          />
        </div>
      ) : (
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full w-full rounded-full bg-primary/25" />
        </div>
      )}
    </div>
  );
}

function EmptyChart({ t }) {
  return (
    <div className="flex h-40 items-center justify-center text-xs text-muted-foreground">
      {t('workspace.closureReportChartEmpty')}
    </div>
  );
}

export default function ClosureReportCharts({ view, selection, onSelect, t }) {
  const reduceMotion = usePrefersReducedMotion();
  const theme = useMemo(() => getClosureReportChartTheme(), []);
  const anim = !reduceMotion;
  const selectionKey = `${selection?.dimension || 'none'}:${selection?.key || ''}`;
  const charts = view?.charts || {};
  const flags = view?.flags || {};

  const workData = (charts.workPie || []).map((row) => ({
    ...row,
    name:
      row.key === 'done'
        ? t('workspace.closureReportWorkDone')
        : t('workspace.closureReportWorkIncomplete'),
    value: row.count,
  }));

  const velocityData = charts.velocityChart || [];
  const issueData = (charts.issueTypeRows || []).map((row) => ({
    ...row,
    name: row.label || row.key,
    value: row.count,
    fillOpacity: row.dimmed ? theme.dimOpacity : 1,
  }));
  const hoursData = charts.hoursByUser || [];
  const crData = (charts.crStatusRows || []).map((row) => ({
    ...row,
    name: row.label || row.key,
    value: row.count,
    fillOpacity: row.dimmed ? theme.dimOpacity : 1,
  }));

  const bugMax = Math.max(Number(view?.kpis?.bugCount) || 0, 1);

  return (
    <div className="space-y-3">
      {/* Hero row — Traffic + Locations analogy */}
      <div className="grid grid-cols-1 items-stretch gap-3 lg:grid-cols-3">
        <ChartCard
          title={t('workspace.closureReportChartVelocity')}
          delay={0}
          className="lg:col-span-2"
        >
          {velocityData.length ? (
            <ResponsiveContainer width="100%" height={260} key={`vel-${selectionKey}`}>
              {velocityData.length >= 2 ? (
                <AreaChart data={velocityData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="closureVelFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={theme.primary} stopOpacity={0.28} />
                      <stop offset="100%" stopColor={theme.primary} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={theme.border} vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: theme.muted }} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: theme.muted }} axisLine={false} />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="velocityHours"
                    name={t('workspace.closureReportChartVelocity')}
                    stroke={theme.primary}
                    strokeWidth={2}
                    fill="url(#closureVelFill)"
                    isAnimationActive={anim}
                    animationDuration={LINE_ANIMATION_MS}
                    animationEasing="ease-out"
                    activeDot={{
                      r: 5,
                      onClick: (_, payload) => {
                        const k = payload?.payload?.key;
                        if (k) onSelect?.(REPORT_DIMENSIONS.SPRINT, k);
                      },
                    }}
                  />
                </AreaChart>
              ) : (
                <BarChart data={velocityData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={theme.border} vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: theme.muted }} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: theme.muted }} axisLine={false} />
                  <Tooltip />
                  <Bar
                    dataKey="velocityHours"
                    name={t('workspace.closureReportChartVelocity')}
                    fill={theme.primary}
                    radius={[3, 3, 0, 0]}
                    isAnimationActive={anim}
                    animationDuration={CHART_ANIMATION_MS}
                    animationEasing="ease-out"
                    onClick={(data) => {
                      if (data?.key) onSelect?.(REPORT_DIMENSIONS.SPRINT, data.key);
                    }}
                    cursor="pointer"
                  />
                </BarChart>
              )}
            </ResponsiveContainer>
          ) : (
            <EmptyChart t={t} />
          )}
        </ChartCard>

        <ChartCard title={t('workspace.closureReportChartWork')} delay={0.04}>
          {workData.length ? (
            <ResponsiveContainer width="100%" height={260} key={`work-${selectionKey}`}>
              <PieChart>
                <Pie
                  data={workData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={58}
                  outerRadius={82}
                  paddingAngle={2}
                  isAnimationActive={anim}
                  animationDuration={CHART_ANIMATION_MS}
                  animationEasing="ease-out"
                >
                  {workData.map((entry) => (
                    <Cell
                      key={entry.key}
                      fill={entry.key === 'done' ? theme.chartDone : theme.chartIncomplete}
                    />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart t={t} />
          )}
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 items-stretch gap-3 lg:grid-cols-2 xl:grid-cols-3">
        <ChartCard title={t('workspace.closureReportChartIssueType')} delay={0.08}>
          {issueData.some((r) => r.value > 0) ? (
            <ResponsiveContainer width="100%" height={220} key={`issue-${selectionKey}`}>
              <BarChart data={issueData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={theme.border} vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: theme.muted }} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: theme.muted }} axisLine={false} />
                <Tooltip />
                <Bar
                  dataKey="value"
                  name={t('workspace.closureReportChartCount')}
                  fill={theme.primary}
                  radius={[3, 3, 0, 0]}
                  isAnimationActive={anim}
                  animationDuration={CHART_ANIMATION_MS}
                  animationEasing="ease-out"
                  onClick={(data) => {
                    if (data?.key) onSelect?.(REPORT_DIMENSIONS.ISSUE_TYPE, data.key);
                  }}
                  cursor="pointer"
                >
                  {issueData.map((entry) => (
                    <Cell key={entry.key} fillOpacity={entry.fillOpacity ?? 1} fill={theme.primary} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart t={t} />
          )}
        </ChartCard>

        <ChartCard
          title={t('workspace.closureReportChartHours')}
          delay={0.12}
          hint={
            flags.resourcesNotLinkedToSprint
              ? t('workspace.closureReportHoursSprintHint')
              : undefined
          }
        >
          {hoursData.length ? (
            <ResponsiveContainer width="100%" height={220} key={`hours-${selectionKey}`}>
              <BarChart data={hoursData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={theme.border} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: theme.muted }} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: theme.muted }} axisLine={false} />
                <Tooltip />
                <Legend />
                <Bar
                  dataKey="plannedHours"
                  name={t('workspace.closureReportHoursPlanned')}
                  fill={theme.chartPlanned}
                  radius={[3, 3, 0, 0]}
                  isAnimationActive={anim}
                  animationDuration={CHART_ANIMATION_MS}
                  animationEasing="ease-out"
                  fillOpacity={flags.resourcesNotLinkedToSprint ? theme.dimOpacity : 1}
                  onClick={(data) => {
                    if (data?.key) onSelect?.(REPORT_DIMENSIONS.USER, data.key);
                  }}
                  cursor="pointer"
                />
                <Bar
                  dataKey="actualHours"
                  name={t('workspace.closureReportHoursActual')}
                  fill={theme.chartActual}
                  radius={[3, 3, 0, 0]}
                  isAnimationActive={anim}
                  animationDuration={CHART_ANIMATION_MS}
                  animationEasing="ease-out"
                  fillOpacity={flags.resourcesNotLinkedToSprint ? theme.dimOpacity : 1}
                  onClick={(data) => {
                    if (data?.key) onSelect?.(REPORT_DIMENSIONS.USER, data.key);
                  }}
                  cursor="pointer"
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart t={t} />
          )}
        </ChartCard>

        <ChartCard title={t('workspace.closureReportChartCr')} delay={0.16}>
          {crData.length ? (
            <ResponsiveContainer width="100%" height={220} key={`cr-${selectionKey}`}>
              <BarChart data={crData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={theme.border} vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: theme.muted }} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: theme.muted }} axisLine={false} />
                <Tooltip />
                <Bar
                  dataKey="value"
                  name={t('workspace.closureReportChartCount')}
                  fill={theme.primary}
                  radius={[3, 3, 0, 0]}
                  isAnimationActive={anim}
                  animationDuration={CHART_ANIMATION_MS}
                  animationEasing="ease-out"
                  onClick={(data) => {
                    if (data?.key) onSelect?.(REPORT_DIMENSIONS.CR_STATUS, data.key);
                  }}
                  cursor="pointer"
                >
                  {crData.map((entry) => (
                    <Cell
                      key={entry.key}
                      fill={theme.primary}
                      fillOpacity={entry.fillOpacity ?? 1}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart t={t} />
          )}
        </ChartCard>
      </div>

      <ChartCard title={t('workspace.closureReportChartQuality')} delay={0.2}>
        <div className="grid gap-4 sm:grid-cols-3">
          <QualityStat
            label={t('workspace.closureReportBugs')}
            value={view?.kpis?.bugCount ?? 0}
            max={bugMax}
          />
          <QualityStat
            label={t('workspace.closureReportDefectRate')}
            value={view?.kpis?.defectRate}
            decimals={3}
          />
          <QualityStat
            label={t('workspace.closureReportReopen')}
            value={view?.kpis?.reopenCount}
            max={Math.max(Number(view?.kpis?.reopenCount) || 0, 1)}
          />
        </div>
      </ChartCard>
    </div>
  );
}
