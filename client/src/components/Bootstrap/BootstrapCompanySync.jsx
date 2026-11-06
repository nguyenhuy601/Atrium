import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import {
  getLastBootstrapShellPayload,
  loadBootstrapShell,
} from '../../services/bootstrapService';
import { fetchDashboardSummary } from '../../services/dashboardService';
import { queryKeys } from '../../lib/queryKeys';
import { STALE_TIME_DASHBOARD_MS } from '../../lib/queryClient';

/**
 * Đồng bộ company từ bootstrap sau khi đăng nhập (single-org).
 * Prefetch dashboard/me (lite→full) ngay sau auth — Overview lần đầu thường HIT/LITE đã ấm.
 */
export default function BootstrapCompanySync() {
  const { isAuthenticated } = useAuth();
  const { applyBootstrapCompany } = useWorkspace();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isAuthenticated) return undefined;
    let cancelled = false;
    (async () => {
      try {
        let boot = getLastBootstrapShellPayload();
        if (!boot) {
          boot = await loadBootstrapShell();
        }
        if (!cancelled && boot) applyBootstrapCompany(boot);
      } catch {
        /* bootstrap retry on next navigation */
      }
      if (cancelled) return;
      void queryClient.prefetchQuery({
        queryKey: queryKeys.dashboard.summary('', ''),
        queryFn: fetchDashboardSummary,
        staleTime: STALE_TIME_DASHBOARD_MS,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, applyBootstrapCompany, queryClient]);

  return null;
}
