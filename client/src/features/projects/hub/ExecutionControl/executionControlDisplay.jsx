/**
 * Human-readable Execution Control detail blocks (no raw JSON dumps).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  isScrollNearBottom,
  listViewportNeedsMoreRoots,
  nextRootLimit,
} from '../projectHubListLazy';

/** Infinite scroll Bằng chứng (client reveal) — card cao hơn row Issues. */
export const EXECUTION_EVIDENCE_PAGE_SIZE = 8;

function formatDateTime(value) {
  if (value == null || value === '') return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  try {
    return d.toLocaleString();
  } catch {
    return d.toISOString();
  }
}

function formatScalar(value) {
  if (value == null || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '—';
  if (value instanceof Date) return formatDateTime(value) || '—';
  if (typeof value === 'string') {
    const asDate = formatDateTime(value);
    if (/^\d{4}-\d{2}-\d{2}T/.test(value) && asDate) return asDate;
    return value;
  }
  return null;
}

function KeyValueList({ rows }) {
  const list = (rows || []).filter((r) => r && r.value != null && r.value !== '');
  if (!list.length) return null;
  return (
    <dl className="mt-1 space-y-0.5 text-[11px] text-muted-foreground">
      {list.map((row) => (
        <div key={row.label} className="flex flex-wrap gap-x-1">
          <dt className="font-medium text-foreground/80">{row.label}:</dt>
          <dd className="min-w-0 break-words">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function evidenceTitle(type, t) {
  const key = `workspace.executionControlEvType_${String(type || 'UNKNOWN')}`;
  const labeled = t(key);
  if (labeled && labeled !== key) return labeled;
  return String(type || t('workspace.executionControlEvUnknown'));
}

function actionLabel(op, t) {
  const key = `workspace.executionControlOp_${String(op || '')}`;
  const labeled = t(key);
  if (labeled && labeled !== key) return labeled;
  return String(op || '—');
}

function followUpLabel(type, t) {
  const key = `workspace.executionControlFollowUpType_${String(type || 'unknown')}`;
  const labeled = t(key);
  if (labeled && labeled !== key) return labeled;
  return String(type || t('workspace.executionControlEvUnknown'));
}

/** @param {{ item: object, t: function }} props */
export function EvidenceItemCard({ item, t }) {
  const type = item?.type || 'UNKNOWN';
  const rows = [];

  if (type === 'OVERDUE') {
    rows.push(
      { label: t('workspace.executionControlFieldDue'), value: formatDateTime(item.dueDate) },
      { label: t('workspace.executionControlFieldCheckedAt'), value: formatDateTime(item.now) }
    );
  } else if (type === 'AT_RISK') {
    rows.push(
      {
        label: t('workspace.executionControlFieldRemaining'),
        value:
          item.remainingHours != null
            ? `${item.remainingHours}h`
            : null,
      },
      {
        label: t('workspace.executionControlFieldCapacity'),
        value:
          item.availableCapacityToDueHours != null
            ? `${item.availableCapacityToDueHours}h`
            : null,
      },
      {
        label: t('workspace.executionControlFieldGap'),
        value:
          item.gapHours != null
            ? `${item.gapHours}h`
            : Number.isFinite(Number(item.remainingHours)) &&
                Number.isFinite(Number(item.availableCapacityToDueHours))
              ? `${Math.max(0, Number(item.remainingHours) - Number(item.availableCapacityToDueHours))}h`
              : null,
      },
      {
        label: t('workspace.executionControlFieldRemainingUpdated'),
        value: formatDateTime(item.remainingUpdatedAt),
      }
    );
  } else if (type === 'BLOCKED') {
    const blockers = Array.isArray(item.blockers) ? item.blockers : [];
    rows.push({
      label: t('workspace.executionControlFieldBlockers'),
      value: blockers.length
        ? blockers
            .map((b) => {
              const kind = b?.kind || 'blocker';
              const reason = b?.reason ? `: ${b.reason}` : '';
              return `${kind}${reason}`;
            })
            .join(' · ')
        : t('workspace.executionControlEmptyValue'),
    });
  } else if (type === 'STALE_PROGRESS') {
    rows.push(
      {
        label: t('workspace.executionControlFieldLastProgress'),
        value: formatDateTime(item.lastProgressAt),
      },
      {
        label: t('workspace.executionControlFieldStaleDays'),
        value: item.staleDays != null ? String(item.staleDays) : null,
      }
    );
  } else if (type === 'NEEDS_DATA') {
    rows.push({
      label: t('workspace.executionControlFieldReason'),
      value: item.reason || item.message || null,
    });
  } else if (type === 'QUALITY_FAIL') {
    rows.push(
      {
        label: t('workspace.executionControlFieldTcFailed'),
        value: formatScalar(item.tcFailed),
      },
      {
        label: t('workspace.executionControlFieldBlockingBug'),
        value: formatScalar(item.blockingBug),
      },
      {
        label: t('workspace.executionControlFieldReopenCount'),
        value: item.reopenCount != null ? String(item.reopenCount) : null,
      }
    );
  } else if (type === 'COST_OVERRUN') {
    rows.push(
      {
        label: t('workspace.executionControlFieldVariance'),
        value: item.varianceRatio != null ? String(item.varianceRatio) : null,
      },
      {
        label: t('workspace.executionControlFieldThreshold'),
        value: item.threshold != null ? String(item.threshold) : null,
      }
    );
  } else if (type === 'INCIDENT') {
    rows.push({
      label: t('workspace.executionControlFieldIncidentId'),
      value: item.incidentId ? String(item.incidentId) : null,
    });
  } else if (type === 'DEPENDENCY_CONFLICT') {
    const edges = Array.isArray(item.edges) ? item.edges : [];
    rows.push({
      label: t('workspace.executionControlFieldEdges'),
      value: edges.length
        ? t('workspace.executionControlFieldEdgesCount', { n: edges.length })
        : t('workspace.executionControlEmptyValue'),
    });
  } else if (item?.message) {
    rows.push({
      label: t('workspace.executionControlFieldNote'),
      value: String(item.message),
    });
  } else {
    // Fallback: show known scalar fields only (never dump nested objects as JSON).
    for (const [k, v] of Object.entries(item || {})) {
      if (k === 'type' || k === '_id') continue;
      const scalar = formatScalar(v);
      if (scalar == null) continue;
      rows.push({ label: k, value: scalar });
    }
  }

  return (
    <li className="rounded border border-border/70 bg-muted/20 px-2 py-1.5">
      <p className="font-medium text-foreground">{evidenceTitle(type, t)}</p>
      <KeyValueList rows={rows} />
    </li>
  );
}

/**
 * @param {{
 *   evidence?: array,
 *   t: function,
 *   emptyLabel: string,
 *   resetKey?: string|number|null,
 *   pageSize?: number,
 *   listActive?: boolean,
 * }} props
 */
export function EvidenceList({
  evidence,
  t,
  emptyLabel,
  resetKey = null,
  pageSize = EXECUTION_EVIDENCE_PAGE_SIZE,
  listActive = true,
}) {
  const items = Array.isArray(evidence) ? evidence : [];
  const total = items.length;
  const step = Math.max(1, Math.floor(Number(pageSize) || EXECUTION_EVIDENCE_PAGE_SIZE));
  const [visibleLimit, setVisibleLimit] = useState(step);
  const scrollRef = useRef(null);

  useEffect(() => {
    setVisibleLimit(step);
  }, [resetKey, step]);

  const visibleItems = useMemo(() => items.slice(0, visibleLimit), [items, visibleLimit]);
  const hasMore = visibleLimit < total;

  useEffect(() => {
    if (!listActive || !hasMore) return undefined;
    const el = scrollRef.current;
    if (!el) return undefined;
    const onScroll = () => {
      if (!isScrollNearBottom(el, 80)) return;
      setVisibleLimit((prev) => nextRootLimit(prev, total, step));
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [listActive, hasMore, total, step]);

  useEffect(() => {
    if (!listActive || !hasMore) return undefined;
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const revealIfShort = () => {
      if (
        !listViewportNeedsMoreRoots({
          scrollHeight: el.scrollHeight,
          clientHeight: el.clientHeight,
          hasMoreRoots: true,
        })
      ) {
        return;
      }
      setVisibleLimit((prev) => nextRootLimit(prev, total, step));
    };
    revealIfShort();
    const observer = new ResizeObserver(() => revealIfShort());
    observer.observe(el);
    return () => observer.disconnect();
  }, [listActive, hasMore, total, step, visibleLimit, visibleItems.length]);

  if (!total) {
    return <p className="mt-1 text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <div className="mt-1">
      {total > step ? (
        <p className="mb-1 text-[10px] text-muted-foreground">
          {Math.min(visibleLimit, total)}/{total}
        </p>
      ) : null}
      <div
        ref={scrollRef}
        className="max-h-56 min-h-0 overflow-y-auto"
        data-testid="execution-control-evidence-scroll"
      >
        <ul className="space-y-1.5">
          {visibleItems.map((item, idx) => (
            <EvidenceItemCard
              key={`${item?.type || 'ev'}-${item?.id || item?.incidentId || idx}`}
              item={item}
              t={t}
            />
          ))}
        </ul>
        {hasMore ? (
          <p className="py-2 text-center text-[10px] text-muted-foreground">…</p>
        ) : null}
      </div>
    </div>
  );
}

/** @param {{ goalImpact?: object, impactStatus?: string, interventionLevel?: string, t: function }} props */
export function GoalImpactBlock({ goalImpact, impactStatus, interventionLevel, t }) {
  const g = goalImpact && typeof goalImpact === 'object' ? goalImpact : {};
  const rows = [
    {
      label: t('workspace.executionControlFieldGoalStatus'),
      value: g.goalImpactStatus || impactStatus || '—',
    },
    {
      label: t('workspace.executionControlFieldAffectsSprintGoal'),
      value: formatScalar(Boolean(g.affectsSprintGoal)),
    },
    {
      label: t('workspace.executionControlFieldImpactStatus'),
      value: impactStatus || '—',
    },
    {
      label: t('workspace.executionControlFieldIntervention'),
      value: interventionLevel || '—',
    },
  ];
  const milestones = Array.isArray(g.milestoneIds) ? g.milestoneIds.filter(Boolean) : [];
  if (milestones.length) {
    rows.push({
      label: t('workspace.executionControlFieldMilestones'),
      value: milestones.map(String).join(', '),
    });
  }
  if (g.evidence && typeof g.evidence === 'string') {
    rows.push({ label: t('workspace.executionControlFieldNote'), value: g.evidence });
  }
  return <KeyValueList rows={rows} />;
}

/** @param {{ refs?: array, t: function }} props */
export function ProposalEvidenceRefs({ refs, t }) {
  const items = Array.isArray(refs) ? refs : [];
  if (!items.length) return null;
  return (
    <ul className="mt-1 space-y-1.5">
      {items.map((ref, idx) => (
        <EvidenceItemCard key={ref?.id || `${ref?.type}-${idx}`} item={ref} t={t} />
      ))}
    </ul>
  );
}

/** @param {{ actions?: array, t: function }} props */
export function ProposalActionsList({ actions, t }) {
  const list = Array.isArray(actions) ? actions : [];
  if (!list.length) return null;
  return (
    <ul className="mt-1 space-y-1.5">
      {list.map((a) => {
        const isRecommend = String(a?.op || '').startsWith('recommend_');
        const detail = isRecommend
          ? a?.payload?.message || t('workspace.executionControlRecommendOnly')
          : [
              a?.payload?.riskLabel
                ? `${t('workspace.executionControlFieldRiskLabel')}: ${a.payload.riskLabel}`
                : null,
              a?.payload?.remainingHours != null
                ? `${t('workspace.executionControlFieldRemaining')}: ${a.payload.remainingHours}h`
                : null,
              a?.entityId
                ? `${t('workspace.executionControlFieldEntity')}: ${a.entityType || 'task'} ${a.entityId}`
                : null,
            ]
              .filter(Boolean)
              .join(' · ');
        return (
          <li
            key={a.actionId || a.op}
            className="rounded border border-border/70 bg-muted/20 px-2 py-1.5 text-[11px]"
          >
            <p className="font-medium text-foreground">{actionLabel(a.op, t)}</p>
            {detail ? <p className="mt-0.5 text-muted-foreground">{detail}</p> : null}
          </li>
        );
      })}
    </ul>
  );
}

/** @param {{ results?: array, t: function, emptyLabel: string }} props */
export function FollowUpResultsList({ results, t, emptyLabel }) {
  const items = Array.isArray(results) ? results : [];
  if (!items.length) {
    return <p className="mt-1 text-muted-foreground">{emptyLabel}</p>;
  }
  return (
    <ul className="mt-1 space-y-1.5">
      {items.map((r, idx) => {
        const passed = r?.passed === true;
        const failed = r?.passed === false;
        return (
          <li
            key={`${r?.type || 'fu'}-${idx}`}
            className="rounded border border-border/70 bg-muted/20 px-2 py-1.5 text-[11px]"
          >
            <p className="font-medium text-foreground">
              {followUpLabel(r?.type, t)}
              <span
                className={`ml-2 ${
                  passed ? 'text-emerald-700' : failed ? 'text-amber-700' : 'text-muted-foreground'
                }`}
              >
                {passed
                  ? t('workspace.executionControlFollowUpPassed')
                  : failed
                    ? t('workspace.executionControlFollowUpFailed')
                    : '—'}
              </span>
            </p>
            {r?.message ? (
              <p className="mt-0.5 text-muted-foreground">{String(r.message)}</p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
