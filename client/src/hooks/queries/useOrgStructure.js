import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { queryKeys } from '../../lib/queryKeys';
import { STALE_TIME_ORGS_MS } from '../../lib/queryClient';
import { organizationAPI } from '../../services/api/organizationAPI';
import { getResolvedBearerToken } from '../../utils/tokenStorage';

const unwrap = (payload) => {
  const raw = payload?.data ?? payload;
  return raw?.data ?? raw;
};

export async function fetchOrgStructure(orgId, { view = 'full', includeInactive = false } = {}) {
  const payload = await organizationAPI.getStructure(orgId, { view, includeInactive });
  return unwrap(payload);
}

/**
 * @param {string} orgId
 * @param {{ enabled?: boolean, view?: 'nav'|'full', includeInactive?: boolean }} [options]
 */
export function useOrgStructure(
  orgId,
  { enabled: enabledProp = true, view = 'full', includeInactive = false } = {}
) {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const id = orgId ? String(orgId) : '';
  const authReady = Boolean(getResolvedBearerToken());
  const normalizedView = view === 'nav' ? 'nav' : 'full';
  const enabled =
    enabledProp && !authLoading && isAuthenticated && authReady && Boolean(id);

  return useQuery({
    queryKey: [
      ...queryKeys.org.structure(id, includeInactive, normalizedView),
      authReady ? 'auth' : 'anon',
    ],
    queryFn: () => fetchOrgStructure(id, { view: normalizedView, includeInactive }),
    staleTime: STALE_TIME_ORGS_MS,
    enabled,
    retry: (failureCount, error) => {
      const status = error?.response?.status ?? error?.status;
      if (status === 404 || status === 403 || status === 401) return false;
      return failureCount < 1;
    },
  });
}

export function useOrgStructureNav(orgId, options = {}) {
  return useOrgStructure(orgId, { ...options, view: 'nav' });
}
