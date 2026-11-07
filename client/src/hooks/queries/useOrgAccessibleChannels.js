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

export async function fetchOrgAccessibleChannels(orgId) {
  try {
    const payload = await organizationAPI.getAccessibleChannelIds(orgId);
    // #region agent log
    fetch('http://127.0.0.1:7781/ingest/25418548-5637-4f11-a834-1c7c198bc9cb',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'bbb8bb'},body:JSON.stringify({sessionId:'bbb8bb',runId:'pre-fix',hypothesisId:'C',location:'useOrgAccessibleChannels.js:ok',message:'accessible channels OK',data:{orgId:String(orgId||'')},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    return unwrap(payload);
  } catch (err) {
    // #region agent log
    fetch('http://127.0.0.1:7781/ingest/25418548-5637-4f11-a834-1c7c198bc9cb',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'bbb8bb'},body:JSON.stringify({sessionId:'bbb8bb',runId:'pre-fix',hypothesisId:'C',location:'useOrgAccessibleChannels.js:fail',message:'accessible channels FAIL',data:{orgId:String(orgId||''),status:err?.status||err?.response?.status||null,errorCode:err?.errorCode||err?.response?.data?.errorCode||err?.code||null,errMessage:String(err?.message||'').slice(0,200)},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    throw err;
  }
}

export function useOrgAccessibleChannels(orgId, { enabled: enabledProp = true } = {}) {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const id = orgId ? String(orgId) : '';
  const authReady = Boolean(getResolvedBearerToken());
  const enabled =
    enabledProp && !authLoading && isAuthenticated && authReady && Boolean(id);

  return useQuery({
    queryKey: [...queryKeys.org.accessibleChannels(id), authReady ? 'auth' : 'anon'],
    queryFn: () => fetchOrgAccessibleChannels(id),
    staleTime: STALE_TIME_ORGS_MS,
    enabled,
    retry: (failureCount, error) => {
      const status = error?.response?.status ?? error?.status;
      if (status === 404 || status === 403 || status === 401) return false;
      return failureCount < 1;
    },
  });
}
