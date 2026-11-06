import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { queryKeys } from '../../lib/queryKeys';
import { STALE_TIME_DASHBOARD_MS } from '../../lib/queryClient';
import { fetchDashboardSummary } from '../../services/dashboardService';

/** Poll dưới BE maxAge (120s) — warm HIT / STALE-while-revalidate. */
export const DASHBOARD_SUMMARY_REFETCH_MS = 90_000;

/** Sau LITE: lấy full tasks/meetings khi nền đã ghi RM. */
const LITE_FOLLOWUP_MS = 1_800;

export function useDashboardSummary({
  enabled: enabledProp = true,
  orgId = '',
  role = '',
} = {}) {
  const { isAuthenticated } = useAuth();
  const enabled = enabledProp && isAuthenticated;
  const followUpSent = useRef(false);

  const query = useQuery({
    queryKey: queryKeys.dashboard.summary(orgId, role),
    queryFn: fetchDashboardSummary,
    staleTime: STALE_TIME_DASHBOARD_MS,
    refetchInterval: enabled ? DASHBOARD_SUMMARY_REFETCH_MS : false,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    enabled,
  });

  useEffect(() => {
    if (!enabled) {
      followUpSent.current = false;
      return undefined;
    }
    const pending =
      query.data?.refreshPending === true ||
      String(query.data?._rm || '').toUpperCase() === 'LITE';
    if (!pending || followUpSent.current) return undefined;
    followUpSent.current = true;
    const timer = window.setTimeout(() => {
      void query.refetch();
    }, LITE_FOLLOWUP_MS);
    return () => window.clearTimeout(timer);
  }, [enabled, query.data?.refreshPending, query.data?._rm, query.refetch]);

  return query;
}
