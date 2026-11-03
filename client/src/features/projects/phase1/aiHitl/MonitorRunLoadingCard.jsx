/**
 * Live Monitor loading — current work only (no pending/upcoming checklist).
 */
import { Loader2 } from 'lucide-react';
import { formatMonitorLayerActivity } from './monitorActivityLabels';

function labelOf(t, key, fallback) {
  const value = typeof t === 'function' ? t(key) : '';
  return value || fallback;
}

/**
 * @param {object} activity — vm.activity
 * @param {string[]} currentIds — in-flight tool/substep ids (names never shown for pending)
 * @param {function} t
 */
export function resolveMonitorHeroText(activity, currentIds, t) {
  const ids = Array.isArray(currentIds) ? currentIds.filter(Boolean) : [];
  if (ids.length > 0 && (activity?.kind === 'call_tool' || !activity?.labelKey)) {
    return formatMonitorLayerActivity(ids, t);
  }
  if (activity?.kind === 'call_tool') {
    const names = activity.toolNames?.length ? activity.toolNames : [activity.toolName];
    const filtered = (Array.isArray(names) ? names : [names])
      .map((n) => String(n || '').trim())
      .filter(Boolean);
    // Prefer intersection with currentIds when both present (RULE-05).
    const onlyCurrent =
      ids.length > 0 ? filtered.filter((n) => ids.includes(n)) : filtered;
    return formatMonitorLayerActivity(onlyCurrent.length ? onlyCurrent : filtered, t);
  }
  if (activity?.labelKey) {
    const fallbacks = {
      understand: 'Đang chuẩn bị ngữ cảnh HOW…',
      plan: 'Đang chọn tools planning…',
      observe: 'Đang tổng hợp kết quả…',
      evaluate: 'Đang đánh giá…',
    };
    return labelOf(
      t,
      activity.labelKey,
      fallbacks[activity.kind] || labelOf(t, 'requirements.aiHitlMonitorProcessing', 'Đang xử lý…')
    );
  }
  if (ids.length === 1) {
    return formatMonitorLayerActivity(ids, t);
  }
  return labelOf(t, 'requirements.aiHitlMonitorProcessing', 'Đang xử lý…');
}

/**
 * @param {{
 *   phaseLabel: string,
 *   done: number,
 *   total: number,
 *   heroText: string,
 *   showSpinner?: boolean,
 *   t: function,
 * }} props
 */
export default function MonitorRunLoadingCard({
  phaseLabel,
  done = 0,
  total = 0,
  heroText,
  showSpinner = true,
  t,
}) {
  const safeTotal = Number(total) > 0 ? Number(total) : 0;
  const safeDone = Math.max(0, Math.min(Number(done) || 0, safeTotal || Number(done) || 0));
  const pct = safeTotal > 0 ? Math.round((safeDone / safeTotal) * 100) : 0;
  const countLabel =
    safeTotal > 0
      ? labelOf(t, 'requirements.aiHitlMonitorProgressCount', '{done}/{total}')
          .replace('{done}', String(safeDone))
          .replace('{total}', String(safeTotal))
      : '';

  return (
    <div
      className="mt-3 rounded-lg border border-border/70 bg-muted/30 px-3 py-3"
      role="status"
      aria-live="polite"
      aria-busy={showSpinner ? 'true' : undefined}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="inline-flex max-w-full items-center rounded-md bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground shadow-sm sm:text-xs">
          {phaseLabel}
        </p>
        {countLabel ? (
          <p className="text-xs tabular-nums text-muted-foreground">
            <span className="sr-only">
              {labelOf(t, 'requirements.aiHitlMonitorProgressAria', 'Tiến độ')}
              {': '}
            </span>
            {countLabel}
          </p>
        ) : null}
      </div>

      {safeTotal > 0 ? (
        <div
          className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted"
          aria-hidden
        >
          <div
            className="h-full rounded-full bg-primary vh-motion-respect transition-[width] duration-[var(--vh-motion-base,150ms)] ease-[var(--vh-motion-ease,cubic-bezier(0.4,0,0.2,1))]"
            style={{ width: `${pct}%` }}
          />
        </div>
      ) : null}

      <p className="mt-2.5 flex items-center gap-2 text-sm font-medium text-foreground">
        {showSpinner ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin motion-reduce:animate-none" aria-hidden />
        ) : null}
        <span>{heroText || labelOf(t, 'requirements.aiHitlMonitorProcessing', 'Đang xử lý…')}</span>
      </p>
    </div>
  );
}
