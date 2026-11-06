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
  LineChart,
  Line,
} from 'recharts';
import {
  CHART_ANIMATION_MS,
  LINE_ANIMATION_MS,
  getClosureReportChartTheme,
} from './closureReportChartTheme';
import { REPORT_DIMENSIONS } from './closureReportSelection';
import usePrefersReducedMotion from './usePrefersReducedMotion';

function ChartCard({ title, hint, children }) {
  return (
    <section className="flex min-h-[16rem] flex-col rounded-xl border border-border bg-card p-3">
      <header className="mb-2">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
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

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
      <ChartCard title={t('workspace.closureReportChartWork')}>
        {workData.length ? (
          <ResponsiveContainer width="100%" height={220} key={`work-${selectionKey}`}>
            <PieChart>
              <Pie
                data={workData}
                dataKey="value"
                nameKey="name"
                innerRadius={48}
                outerRadius={72}
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

      <ChartCard title={t('workspace.closureReportChartVelocity')}>
        {velocityData.length ? (
          <ResponsiveContainer width="100%" height={220} key={`vel-${selectionKey}`}>
            {velocityData.length >= 2 ? (
              <LineChart
                data={velocityData}
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={theme.border} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="velocityHours"
                  name={t('workspace.closureReportChartVelocity')}
                  stroke={theme.primary}
                  strokeWidth={2}
                  dot={{ r: 3 }}
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
              </LineChart>
            ) : (
              <BarChart
                data={velocityData}
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={theme.border} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar
                  dataKey="velocityHours"
                  name={t('workspace.closureReportChartVelocity')}
                  fill={theme.primary}
                  radius={[4, 4, 0, 0]}
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

      <ChartCard title={t('workspace.closureReportChartIssueType')}>
        {issueData.some((r) => r.value > 0) ? (
          <ResponsiveContainer width="100%" height={220} key={`issue-${selectionKey}`}>
            <BarChart data={issueData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={theme.border} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar
                dataKey="value"
                name={t('workspace.closureReportChartCount')}
                fill={theme.primary}
                radius={[4, 4, 0, 0]}
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
        hint={
          flags.resourcesNotLinkedToSprint
            ? t('workspace.closureReportHoursSprintHint')
            : undefined
        }
      >
        {hoursData.length ? (
          <ResponsiveContainer width="100%" height={220} key={`hours-${selectionKey}`}>
            <BarChart data={hoursData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={theme.border} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar
                dataKey="plannedHours"
                name={t('workspace.closureReportHoursPlanned')}
                fill={theme.chartPlanned}
                radius={[4, 4, 0, 0]}
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
                radius={[4, 4, 0, 0]}
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

      <ChartCard title={t('workspace.closureReportChartCr')}>
        {crData.length ? (
          <ResponsiveContainer width="100%" height={220} key={`cr-${selectionKey}`}>
            <BarChart data={crData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={theme.border} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar
                dataKey="value"
                name={t('workspace.closureReportChartCount')}
                fill={theme.secondary}
                stroke={theme.primary}
                radius={[4, 4, 0, 0]}
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

      <ChartCard title={t('workspace.closureReportChartQuality')}>
        <div className="flex h-40 flex-col justify-center gap-3 px-2">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xs text-muted-foreground">{t('workspace.closureReportBugs')}</span>
            <span className="text-2xl font-semibold tabular-nums text-foreground">
              {view?.kpis?.bugCount ?? 0}
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xs text-muted-foreground">{t('workspace.closureReportDefectRate')}</span>
            <span className="text-2xl font-semibold tabular-nums text-foreground">
              {view?.kpis?.defectRate == null ? '—' : Number(view.kpis.defectRate).toFixed(3)}
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xs text-muted-foreground">{t('workspace.closureReportReopen')}</span>
            <span className="text-2xl font-semibold tabular-nums text-foreground">
              {view?.kpis?.reopenCount == null ? '—' : view.kpis.reopenCount}
            </span>
          </div>
        </div>
      </ChartCard>
    </div>
  );
}
