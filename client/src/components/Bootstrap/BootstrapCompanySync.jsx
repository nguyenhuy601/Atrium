import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { fetchOrganizationsMy } from '../../hooks/queries/fetchers';
import { fetchDashboardSummary } from '../../services/dashboardService';
import { queryKeys } from '../../lib/queryKeys';
import { STALE_TIME_DASHBOARD_MS } from '../../lib/queryClient';
import {
  readSingleOrgModeFlag,
  writeBootstrapCompanyFlags,
} from '../../utils/singleCompanyMode';

/**
 * Đồng bộ company từ GET /organizations/my sau khi đăng nhập (single-org).
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
        const organizations = await fetchOrganizationsMy();
        if (cancelled) return;
        queryClient.setQueryData(queryKeys.organizations.my(), organizations, {
          updatedAt: Date.now(),
        });
        const company = organizations[0] || null;
        const singleOrgMode = readSingleOrgModeFlag();
        const payload = { organizations, company, singleOrgMode };
        writeBootstrapCompanyFlags(payload);
        applyBootstrapCompany(payload);
      } catch {
        /* org sync retry on next navigation */
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
