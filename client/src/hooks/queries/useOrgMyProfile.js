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

/** @type {Map<string, string>} */
const myProfileEtagByKey = new Map();
/** @type {Map<string, unknown>} */
const myProfileBodyByKey = new Map();

function profileCacheKey(orgId, include) {
  return `${String(orgId || '')}|${String(include || '')}`;
}

function readResponseEtag(headers) {
  if (!headers || typeof headers !== 'object') return '';
  return String(headers.etag || headers.ETag || '').trim();
}

export async function fetchOrgMyProfile(orgId, { include = 'organization' } = {}) {
  const key = profileCacheKey(orgId, include);
  const ifNoneMatch = myProfileEtagByKey.get(key) || '';
  const response = await organizationAPI.getOrgMyProfile(orgId, {
    include,
    ifNoneMatch,
  });

  const status = response?.status;
  const headers = response?.headers;
  const payload = response?.data !== undefined && response?.headers !== undefined
    ? response.data
    : response;

  if (status === 304) {
    const cached = myProfileBodyByKey.get(key);
    if (cached !== undefined) return cached;
  }

  const data = unwrap(payload);
  const etag = readResponseEtag(headers);
  if (etag) myProfileEtagByKey.set(key, etag);
  myProfileBodyByKey.set(key, data);
  return data;
}

export function useOrgMyProfile(
  orgId,
  { enabled: enabledProp = true, include = 'organization' } = {}
) {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const id = orgId ? String(orgId) : '';
  const authReady = Boolean(getResolvedBearerToken());
  const enabled =
    enabledProp && !authLoading && isAuthenticated && authReady && Boolean(id);

  return useQuery({
    queryKey: [...queryKeys.org.myProfile(id, include), authReady ? 'auth' : 'anon'],
    queryFn: () => fetchOrgMyProfile(id, { include }),
    staleTime: STALE_TIME_ORGS_MS,
    enabled,
    retry: (failureCount, error) => {
      const status = error?.response?.status ?? error?.status;
      if (status === 404 || status === 403 || status === 401) return false;
      return failureCount < 1;
    },
  });
}
