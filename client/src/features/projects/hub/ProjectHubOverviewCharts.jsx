/**
 * Overview Summary charts — SVG/CSS + DS tokens.
 * Callout (sm+) + tooltip hover/focus + click drilldown danh sách hạng mục.
 */

import { useEffect, useId, useMemo, useState } from 'react';
import QueryStateView from '../../../components/Shared/QueryStateView';
import MotionFadeIn from '../../../motion/primitives/MotionFadeIn';
import MotionStagger from '../../../motion/primitives/MotionStagger';
import useCountUp from './reports/useCountUp';
import { REPORT_CARD_HEAD, REPORT_CARD_TITLE } from './reports/hubDashboardUi';
import {
  listOverviewChartSegmentCards,
  overviewDonutAnnulusPath,
  overviewDonutCalloutPoints,
} from './projectHubUtils';

function hubBarLabel(row, t) {
  if (row.labelKey) {
    const translated = t(row.labelKey);
    if (translated && translated !== row.labelKey) return translated;
  }
  return row.label || row.key;
}

function HubChartLegend({
  items = [],
  valueMode = 'countPct',
  muted,
  titleCls,
  t,
  activeKey = null,
  onSelect,
  /** Giới hạn chiều cao + scroll khi nhiều dòng (assignee…). */
  scrollable = false,
  maxHeightClass = 'max-h-40',
}) {
  return (
    <ul
      className={`min-w-0 w-full space-y-1.5 ${
        scrollable ? `scrollbar-overlay overflow-y-auto pr-0.5 ${maxHeightClass}` : ''
      }`}
      role="list"
    >
      {items.map((seg) => {
        const label = hubBarLabel(seg, t);
        const value =
          valueMode === 'count'
            ? t('workspace.projectHubOverviewChartCount', { n: seg.count })
            : t('workspace.projectHubOverviewChartCountPct', {
                n: seg.count,
                pct: seg.pct,
              });
        const dimmed = !(Number(seg.count) > 0);
        const selected = activeKey === seg.key;
        const clickable = Number(seg.count) > 0 && typeof onSelect === 'function';
        return (
          <li key={seg.key}>
            <button
              type="button"
              disabled={!clickable}
              onClick={() => clickable && onSelect(seg.key)}
              className={`flex w-full items-center justify-between gap-2 rounded-md px-1 py-0.5 text-left text-xs transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                dimmed ? 'opacity-50' : ''
              } ${clickable ? 'cursor-pointer hover:bg-muted/60' : 'cursor-default'} ${
                selected ? 'bg-muted ring-1 ring-border' : ''
              }`}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-sm ${seg.barClass}`} aria-hidden />
                <span className={`truncate font-semibold uppercase tracking-wide ${titleCls}`}>
                  {label}
                </span>
              </span>
              <span className={`shrink-0 tabular-nums font-medium ${muted}`}>{value}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function HubDonutTooltip({ seg, valueMode, t, titleCls }) {
  if (!seg) return null;
  const label = hubBarLabel(seg, t);
  const text =
    valueMode === 'count'
      ? t('workspace.projectHubOverviewChartTooltipCount', { label, n: seg.count })
      : t('workspace.projectHubOverviewChartTooltipPct', {
          label,
          pct: seg.pct,
          n: seg.count,
        });
  return (
    <div
      role="status"
      className="pointer-events-none absolute left-1/2 top-2 z-10 w-max max-w-[14rem] -translate-x-1/2 rounded-md border border-border bg-surface px-2.5 py-1.5 shadow-md"
    >
      <div className="flex items-center gap-2 text-xs">
        <span className={`h-2.5 w-2.5 shrink-0 rounded-sm ${seg.barClass}`} aria-hidden />
        <span className={`font-medium tabular-nums ${titleCls}`}>{text}</span>
      </div>
    </div>
  );
}

function OverviewChartDrilldown({
  title,
  items = [],
  loading = false,
  muted,
  titleCls,
  t,
  onClose,
  onOpenCard,
}) {
  return (
    <div
      className="mt-3 rounded-lg border border-border bg-background p-3"
      role="region"
      aria-label={title}
      aria-busy={loading ? 'true' : undefined}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={`text-xs font-semibold ${titleCls}`}>{title}</p>
          <p className={`text-[10px] ${muted}`}>
            {loading
              ? t('common.loading')
              : t('workspace.projectHubOverviewDrilldownCount', { n: items.length })}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-md px-2 py-1 text-[10px] font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={t('workspace.projectHubOverviewDrilldownClose')}
        >
          {t('workspace.projectHubOverviewDrilldownClose')}
        </button>
      </div>
      {loading ? (
        <QueryStateView loading loadingClassName="py-2" skeletonLines={3} />
      ) : items.length === 0 ? (
        <p className={`text-xs ${muted}`}>{t('workspace.projectHubOverviewDrilldownEmpty')}</p>
      ) : (
        <ul className="max-h-40 space-y-1 overflow-y-auto">
          {items.map((row) => (
            <li key={row.id || row.title}>
              <button
                type="button"
                onClick={() => row.id && onOpenCard?.(row.id)}
                className="flex w-full items-start gap-2 rounded-md px-1.5 py-1 text-left text-xs transition-colors hover:bg-muted/70 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className={`min-w-0 flex-1 truncate font-medium ${titleCls}`}>{row.title}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function HubDonutChart({
  segments = [],
  total = 0,
  centerValue,
  centerLabel,
  ariaLabel,
  emptyLabel,
  legendValueMode = 'countPct',
  muted,
  titleCls,
  t,
  selectedKey = null,
  onSelectSegment,
}) {
  const tipId = useId();
  const [hoverKey, setHoverKey] = useState(null);
  const hasWork = Number(total) > 0;
  const tipKey = hoverKey || null;
  const tipSeg = hasWork ? segments.find((s) => s.key === tipKey) : null;
  const canSelect = typeof onSelectSegment === 'function';
  const centerNumeric = Number(String(centerValue ?? total).replace(/[^\d.-]/g, ''));
  const animatedCenter = useCountUp(hasWork && Number.isFinite(centerNumeric) ? centerNumeric : 0, {
    durationMs: 900,
  });

  useEffect(() => {
    if (!selectedKey) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onSelectSegment?.(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedKey, onSelectSegment]);

  const renderSlices = (cx, cy, outerR, innerR) =>
    segments.map((seg) => {
      if (!(Number(seg.sweepAngle) > 0)) return null;
      const d = overviewDonutAnnulusPath(cx, cy, outerR, innerR, seg.startAngle, seg.sweepAngle);
      if (!d) return null;
      const label = hubBarLabel(seg, t);
      const tipText =
        legendValueMode === 'count'
          ? t('workspace.projectHubOverviewChartTooltipCount', { label, n: seg.count })
          : t('workspace.projectHubOverviewChartTooltipPct', {
              label,
              pct: seg.pct,
              n: seg.count,
            });
      const selected = selectedKey === seg.key;
      return (
        <path
          key={seg.key}
          d={d}
          tabIndex={canSelect ? 0 : undefined}
          role={canSelect ? 'button' : undefined}
          aria-label={tipText}
          aria-pressed={selected}
          aria-describedby={tipKey === seg.key ? tipId : undefined}
          className={`${seg.fillClass} stroke-surface outline-none transition-opacity motion-reduce:transition-none focus-visible:stroke-primary focus-visible:stroke-2 ${
            canSelect ? 'cursor-pointer' : ''
          } ${
            selected ? 'opacity-100' : selectedKey ? 'opacity-55' : ''
          }`}
          strokeWidth="1.5"
          onMouseEnter={() => setHoverKey(seg.key)}
          onMouseLeave={() => setHoverKey(null)}
          onFocus={() => setHoverKey(seg.key)}
          onBlur={() => setHoverKey(null)}
          onClick={(e) => {
            if (!canSelect) return;
            e.preventDefault();
            onSelectSegment(selected ? null : seg.key);
          }}
          onKeyDown={(e) => {
            if (!canSelect) return;
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onSelectSegment(selected ? null : seg.key);
            }
          }}
        />
      );
    });

  const callouts = hasWork
    ? overviewDonutCalloutPoints(segments, {
        cx: 100,
        cy: 80,
        rimR: 38,
        elbowR: 50,
        labelPad: 10,
        labelX: 168,
      })
    : [];

  const calloutValue = (row) =>
    legendValueMode === 'count'
      ? t('workspace.projectHubOverviewChartCount', { n: row.count })
      : t('workspace.projectHubOverviewChartPctOnly', { pct: row.pct });

  const legendScrollable = segments.length > 5;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="relative hidden shrink-0 sm:block">
        <div className="relative mx-auto w-full max-w-[20rem]">
          <svg
            viewBox="0 0 200 160"
            className="h-44 w-full overflow-visible"
            role="img"
            aria-label={hasWork ? ariaLabel : emptyLabel}
          >
            <circle
              cx={100}
              cy={80}
              r={(36 + 22) / 2}
              className="fill-none stroke-muted"
              strokeWidth={14}
            />
            {hasWork ? renderSlices(100, 80, 36, 22) : null}
            {callouts.map((c) => {
              // rim → elbow → ngang cột chữ → dọc tới y đã tách (nếu collision).
              const linePts =
                Math.abs(Number(c.y3) - Number(c.y2)) > 0.5
                  ? `${c.x1},${c.y1} ${c.x2},${c.y2} ${c.x3},${c.y2} ${c.x3},${c.y3}`
                  : `${c.x1},${c.y1} ${c.x2},${c.y2} ${c.x3},${c.y3}`;
              return (
              <g key={`callout-${c.key}`} aria-hidden className="pointer-events-none">
                <polyline
                  points={linePts}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.25"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-muted-foreground"
                  opacity={0.75}
                />
                <circle cx={c.x1} cy={c.y1} r="1.75" className="fill-muted-foreground" opacity={0.85} />
                <text
                  x={c.x3 + c.dx}
                  y={c.y3 - 3}
                  textAnchor={c.textAnchor}
                  className="fill-foreground text-[9px] font-bold uppercase"
                >
                  {hubBarLabel(c, t)}
                </text>
                <text
                  x={c.x3 + c.dx}
                  y={c.y3 + 9}
                  textAnchor={c.textAnchor}
                  className="fill-muted-foreground text-[9px] font-semibold tabular-nums"
                >
                  {calloutValue(c)}
                </text>
              </g>
              );
            })}
            <text
              x={100}
              y={78}
              textAnchor="middle"
              className="pointer-events-none fill-foreground text-[16px] font-bold tabular-nums"
            >
              {hasWork ? animatedCenter : '—'}
            </text>
            {centerLabel ? (
              <text
                x={100}
                y={92}
                textAnchor="middle"
                className="pointer-events-none fill-muted-foreground text-[8px] font-semibold uppercase"
              >
                {centerLabel}
              </text>
            ) : null}
          </svg>
          <div id={tipId} className="contents">
            <HubDonutTooltip seg={tipSeg} valueMode={legendValueMode} t={t} titleCls={titleCls} />
          </div>
        </div>
      </div>

      <div className="relative shrink-0 sm:hidden">
        <div className="relative mx-auto h-36 w-36">
          <svg
            viewBox="0 0 100 100"
            className="h-full w-full"
            role="img"
            aria-label={hasWork ? ariaLabel : emptyLabel}
          >
            <circle
              cx={50}
              cy={50}
              r={(38 + 24) / 2}
              className="fill-none stroke-muted"
              strokeWidth={14}
            />
            {hasWork ? renderSlices(50, 50, 38, 24) : null}
          </svg>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-2 text-center">
            <span className={`text-xl font-bold tabular-nums leading-none ${titleCls}`}>
              {hasWork ? animatedCenter : '—'}
            </span>
            {centerLabel ? (
              <span className={`mt-1 text-[10px] font-semibold uppercase tracking-wide ${muted}`}>
                {centerLabel}
              </span>
            ) : null}
          </div>
          <HubDonutTooltip seg={tipSeg} valueMode={legendValueMode} t={t} titleCls={titleCls} />
        </div>
      </div>

      {!hasWork ? (
        <p className={`text-sm ${muted}`}>{emptyLabel}</p>
      ) : (
        <HubChartLegend
          items={segments}
          valueMode={legendValueMode}
          muted={muted}
          titleCls={titleCls}
          t={t}
          activeKey={selectedKey}
          scrollable={legendScrollable}
          maxHeightClass="max-h-36 sm:max-h-40"
          onSelect={
            canSelect ? (key) => onSelectSegment(selectedKey === key ? null : key) : undefined
          }
        />
      )}
    </div>
  );
}

function HubPriorityVerticalBars({
  items = [],
  emptyLabel,
  muted,
  titleCls,
  t,
  selectedKey = null,
  onSelectSegment,
}) {
  if (!items.length) {
    return <p className={`text-sm ${muted}`}>{emptyLabel}</p>;
  }

  const n = items.length;
  const maxCount = Math.max(...items.map((row) => Number(row.count) || 0), 1);
  const chartH = 100;
  const gap = 14;
  const barW = n <= 4 ? 32 : 24;
  const width = n * barW + Math.max(0, n - 1) * gap;
  const padX = 12;
  const padTop = 16;
  const padBottom = 42;
  const svgW = width + padX * 2;
  const svgH = chartH + padTop + padBottom;
  const stubH = 4;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <p className={`shrink-0 text-[10px] font-semibold uppercase tracking-wide ${muted}`}>
        {t('workspace.projectHubOverviewPriorityAxis')}
      </p>
      <div className="flex shrink-0 justify-center">
        <svg
          viewBox={`0 0 ${svgW} ${svgH}`}
          className="h-44 w-full max-w-[17rem]"
          role="img"
          aria-label={t('workspace.projectHubOverviewPriorityBreakdown')}
        >
          {items.map((row, index) => {
            const count = Number(row.count) || 0;
            const h = count > 0 ? Math.max(Math.round((count / maxCount) * chartH), 6) : stubH;
            const x = padX + index * (barW + gap);
            const y = padTop + (chartH - h);
            const label = hubBarLabel(row, t);
            const cx = x + barW / 2;
            const selected = selectedKey === row.key;
            const clickable = count > 0;
            return (
              <g
                key={row.key}
                opacity={count > 0 ? (selectedKey && !selected ? 0.45 : 1) : 0.45}
                role={clickable ? 'button' : undefined}
                tabIndex={clickable ? 0 : undefined}
                aria-label={`${label}: ${count}`}
                aria-pressed={selected}
                className={`outline-none ${clickable ? 'cursor-pointer focus-visible:opacity-100' : ''}`}
                onClick={() => {
                  if (!clickable) return;
                  onSelectSegment?.(selected ? null : row.key);
                }}
                onKeyDown={(e) => {
                  if (!clickable) return;
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectSegment?.(selected ? null : row.key);
                  }
                }}
              >
                <rect
                  x={x}
                  y={y}
                  width={barW}
                  height={h}
                  rx="3"
                  className={`${row.fillClass || 'fill-primary'} ${
                    clickable ? 'focus-visible:stroke-primary' : ''
                  }`}
                />
                <title>{`${label}: ${count}`}</title>
                <text
                  x={cx}
                  y={count > 0 ? Math.max(padTop + 12, y - 5) : padTop + chartH - stubH - 6}
                  textAnchor="middle"
                  className="fill-foreground text-[10px] font-semibold"
                >
                  {count}
                </text>
                {/* Xoay nhãn — tránh cắt "Trung bình" / "Khẩn cấp" */}
                <text
                  x={cx}
                  y={padTop + chartH + 12}
                  textAnchor="end"
                  transform={`rotate(-32 ${cx} ${padTop + chartH + 12})`}
                  className="fill-muted-foreground text-[8px] font-medium"
                >
                  {label}
                </text>
                <rect
                  x={x + 2}
                  y={padTop + chartH + 2}
                  width={barW - 4}
                  height="2"
                  rx="1"
                  className={row.fillClass || 'fill-primary'}
                />
              </g>
            );
          })}
        </svg>
      </div>
      <HubChartLegend
        items={items}
        valueMode="countPct"
        muted={muted}
        titleCls={titleCls}
        t={t}
        activeKey={selectedKey}
        scrollable={items.length > 5}
        onSelect={(key) => onSelectSegment?.(selectedKey === key ? null : key)}
      />
    </div>
  );
}

/** Thanh xếp chồng theo % — bổ sung diversity cạnh donut. */
function HubStackedStatusBar({
  segments = [],
  total = 0,
  muted,
  t,
  selectedKey = null,
  onSelectSegment,
}) {
  const hasWork = Number(total) > 0;
  if (!hasWork) return null;
  return (
    <div className="mt-1 space-y-2">
      <p className={`text-[10px] font-semibold uppercase tracking-wide ${muted}`}>
        {t('workspace.projectHubOverviewStatusDonut')}
      </p>
      <div
        className="flex h-3 overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={t('workspace.projectHubOverviewStatusDonut')}
      >
        {segments.map((seg) => {
          const pct = Number(seg.pct) || 0;
          if (!(pct > 0)) return null;
          const selected = selectedKey === seg.key;
          return (
            <button
              key={seg.key}
              type="button"
              title={`${hubBarLabel(seg, t)} · ${pct}%`}
              onClick={() =>
                onSelectSegment?.(selected ? null : seg.key)
              }
              className={`h-full transition-[width,opacity] duration-[var(--vh-motion-slow)] ease-[var(--vh-motion-ease)] motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                seg.barClass
              } ${selectedKey && !selected ? 'opacity-40' : 'opacity-100'}`}
              style={{ width: `${pct}%` }}
            />
          );
        })}
      </div>
    </div>
  );
}

/** Horizontal bars — loại hạng mục / assignee (đa dạng hơn donut). */
function HubHorizontalBars({
  items = [],
  emptyLabel,
  muted,
  titleCls,
  t,
  valueMode = 'countPct',
  selectedKey = null,
  onSelectSegment,
}) {
  if (!items.length) {
    return <p className={`text-sm ${muted}`}>{emptyLabel}</p>;
  }
  const maxCount = Math.max(...items.map((row) => Number(row.count) || 0), 1);

  return (
    <MotionStagger className="flex min-h-0 flex-1 flex-col gap-2.5">
      {items.map((row) => {
        const count = Number(row.count) || 0;
        const widthPct = Math.max(count > 0 ? (count / maxCount) * 100 : 0, count > 0 ? 4 : 0);
        const label = hubBarLabel(row, t);
        const selected = selectedKey === row.key;
        const clickable = count > 0;
        const value =
          valueMode === 'count'
            ? t('workspace.projectHubOverviewChartCount', { n: count })
            : t('workspace.projectHubOverviewChartCountPct', {
                n: count,
                pct: row.pct ?? 0,
              });
        return (
          <button
            key={row.key}
            type="button"
            disabled={!clickable}
            onClick={() => clickable && onSelectSegment?.(selected ? null : row.key)}
            className={`rounded-lg px-1 py-1 text-left transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              clickable ? 'hover:bg-muted/50' : 'cursor-default opacity-60'
            } ${selected ? 'bg-muted/70 ring-1 ring-border' : ''}`}
          >
            <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
              <span className={`truncate font-semibold ${titleCls}`}>{label}</span>
              <span className={`shrink-0 tabular-nums ${muted}`}>{value}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full transition-[width] duration-[var(--vh-motion-slow)] ease-[var(--vh-motion-ease)] motion-reduce:transition-none ${row.barClass || 'bg-primary'}`}
                style={{ width: `${widthPct}%` }}
              />
            </div>
          </button>
        );
      })}
    </MotionStagger>
  );
}

export function ProjectHubOverviewCharts({
  charts,
  cards = [],
  lists = [],
  members = [],
  cardsLoading = false,
  showAssigneeChart = true,
  muted,
  titleCls,
  cardCls,
  t,
  onOpenCard,
}) {
  const [drill, setDrill] = useState(null);

  const drillItems = useMemo(() => {
    if (!drill?.key) return [];
    const limit = Math.max(40, Number(drill.count) || 0);
    return listOverviewChartSegmentCards({
      cards,
      lists,
      members,
      chart: drill.chart,
      segmentKey: drill.key,
      limit,
    });
  }, [cards, lists, members, drill]);

  if (!charts) return null;

  const priorityEmpty = charts.hasPriorityData
    ? t('workspace.projectHubOverviewChartEmpty')
    : t('workspace.projectHubOverviewPriorityEmpty');

  const select = (chart, key, segments) => {
    if (!key) {
      setDrill(null);
      return;
    }
    const seg = (segments || []).find((s) => s.key === key);
    const label = seg ? hubBarLabel(seg, t) : key;
    setDrill((prev) =>
      prev?.chart === chart && prev?.key === key
        ? null
        : { chart, key, label, count: Number(seg?.count) || 0 }
    );
  };

  const drillFor = (chart) => (drill?.chart === chart ? drill : null);
  const drillLoading = Boolean(cardsLoading && drill);

  const chartSectionCls = `${cardCls} flex h-full min-h-0 flex-col`;
  const typeEmpty = t('workspace.projectHubOverviewChartEmpty');

  return (
    <div
      className="grid items-stretch gap-4 sm:grid-cols-2"
      data-testid="overview-charts-grid"
    >
      <MotionFadeIn delay={0} className="h-full min-h-0">
        <section className={chartSectionCls} aria-labelledby="overview-status-donut">
          <header className={`${REPORT_CARD_HEAD} shrink-0`}>
            <h3 id="overview-status-donut" className={REPORT_CARD_TITLE}>
              {t('workspace.projectHubOverviewStatusDonut')}
            </h3>
          </header>
          <HubDonutChart
            segments={charts.statusSegments}
            total={charts.statusTotal}
            centerValue={String(charts.statusTotal || 0)}
            centerLabel={t('workspace.projectHubStatCards')}
            ariaLabel={t('workspace.projectHubOverviewStatusDonutAria', {
              n: charts.statusTotal || 0,
            })}
            emptyLabel={t('workspace.projectHubOverviewChartEmpty')}
            legendValueMode="countPct"
            muted={muted}
            titleCls={titleCls}
            t={t}
            selectedKey={drillFor('status')?.key || null}
            onSelectSegment={(key) => select('status', key, charts.statusSegments)}
          />
          <HubStackedStatusBar
            segments={charts.statusSegments}
            total={charts.statusTotal}
            muted={muted}
            t={t}
            selectedKey={drillFor('status')?.key || null}
            onSelectSegment={(key) => select('status', key, charts.statusSegments)}
          />
          {drillFor('status') ? (
            <OverviewChartDrilldown
              title={t('workspace.projectHubOverviewDrilldownTitle', {
                label: drillFor('status').label,
              })}
              items={drillItems}
              loading={drillLoading}
              muted={muted}
              titleCls={titleCls}
              t={t}
              onClose={() => setDrill(null)}
              onOpenCard={onOpenCard}
            />
          ) : null}
        </section>
      </MotionFadeIn>

      <MotionFadeIn delay={0.05} className="h-full min-h-0">
        <section className={chartSectionCls} aria-labelledby="overview-priority-breakdown">
          <header className={`${REPORT_CARD_HEAD} shrink-0`}>
            <h3 id="overview-priority-breakdown" className={REPORT_CARD_TITLE}>
              {t('workspace.projectHubOverviewPriorityBreakdown')}
            </h3>
          </header>
          <HubPriorityVerticalBars
            items={charts.prioritySegments}
            emptyLabel={priorityEmpty}
            muted={muted}
            titleCls={titleCls}
            t={t}
            selectedKey={drillFor('priority')?.key || null}
            onSelectSegment={(key) => select('priority', key, charts.prioritySegments)}
          />
          {drillFor('priority') ? (
            <OverviewChartDrilldown
              title={t('workspace.projectHubOverviewDrilldownTitle', {
                label: drillFor('priority').label,
              })}
              items={drillItems}
              loading={drillLoading}
              muted={muted}
              titleCls={titleCls}
              t={t}
              onClose={() => setDrill(null)}
              onOpenCard={onOpenCard}
            />
          ) : null}
        </section>
      </MotionFadeIn>

      <MotionFadeIn delay={0.1} className="h-full min-h-0">
        <section className={chartSectionCls} aria-labelledby="overview-type-breakdown">
          <header className={`${REPORT_CARD_HEAD} shrink-0`}>
            <h3 id="overview-type-breakdown" className={REPORT_CARD_TITLE}>
              {t('workspace.projectHubOverviewTypeBreakdown')}
            </h3>
          </header>
          <HubHorizontalBars
            items={charts.typeSegments || []}
            emptyLabel={typeEmpty}
            muted={muted}
            titleCls={titleCls}
            t={t}
            valueMode="countPct"
            selectedKey={drillFor('type')?.key || null}
            onSelectSegment={(key) => select('type', key, charts.typeSegments)}
          />
          {drillFor('type') ? (
            <OverviewChartDrilldown
              title={t('workspace.projectHubOverviewDrilldownTitle', {
                label: drillFor('type').label,
              })}
              items={drillItems}
              loading={drillLoading}
              muted={muted}
              titleCls={titleCls}
              t={t}
              onClose={() => setDrill(null)}
              onOpenCard={onOpenCard}
            />
          ) : null}
        </section>
      </MotionFadeIn>

      {showAssigneeChart ? (
        <MotionFadeIn delay={0.14} className="h-full min-h-0">
          <section className={chartSectionCls} aria-labelledby="overview-assignee-bars">
            <header className={`${REPORT_CARD_HEAD} shrink-0`}>
              <h3 id="overview-assignee-bars" className={REPORT_CARD_TITLE}>
                {t('workspace.projectHubOverviewAssigneeDonut')}
              </h3>
            </header>
            <div className="scrollbar-overlay max-h-64 min-h-0 overflow-y-auto overscroll-contain pr-0.5">
              <HubHorizontalBars
                items={charts.assigneeSegments || []}
                emptyLabel={t('workspace.projectHubOverviewAssigneeEmpty')}
                muted={muted}
                titleCls={titleCls}
                t={t}
                valueMode="count"
                selectedKey={drillFor('assignee')?.key || null}
                onSelectSegment={(key) => select('assignee', key, charts.assigneeSegments)}
              />
            </div>
            {drillFor('assignee') ? (
              <OverviewChartDrilldown
                title={t('workspace.projectHubOverviewDrilldownTitle', {
                  label: drillFor('assignee').label,
                })}
                items={drillItems}
                loading={drillLoading}
                muted={muted}
                titleCls={titleCls}
                t={t}
                onClose={() => setDrill(null)}
                onOpenCard={onOpenCard}
              />
            ) : null}
          </section>
        </MotionFadeIn>
      ) : null}
    </div>
  );
}

export default ProjectHubOverviewCharts;
