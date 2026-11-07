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
  try {
    const payload = await organizationAPI.getStructure(orgId, { view, includeInactive });
    // #region agent log
    fetch('http://127.0.0.1:7781/ingest/25418548-5637-4f11-a834-1c7c198bc9cb',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'bbb8bb'},body:JSON.stringify({sessionId:'bbb8bb',runId:'pre-fix',hypothesisId:'C',location:'useOrgStructure.js:ok',message:'org structure OK',data:{orgId:String(orgId||''),view:String(view||'full')},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    return unwrap(payload);
  } catch (err) {
    // #region agent log
    fetch('http://127.0.0.1:7781/ingest/25418548-5637-4f11-a834-1c7c198bc9cb',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'bbb8bb'},body:JSON.stringify({sessionId:'bbb8bb',runId:'pre-fix',hypothesisId:'C',location:'useOrgStructure.js:fail',message:'org structure FAIL',data:{orgId:String(orgId||''),view:String(view||'full'),status:err?.status||err?.response?.status||null,errorCode:err?.errorCode||err?.response?.data?.errorCode||err?.code||null,errMessage:String(err?.message||'').slice(0,200)},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    throw err;
  }
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
