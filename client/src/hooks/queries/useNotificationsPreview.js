import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { queryKeys } from '../../lib/queryKeys';
import { STALE_TIME_BADGE_MS } from '../../lib/queryClient';
import { fetchNotificationsPreview } from './fetchers';
import { PERSONAL_NOTIF_PREVIEW_LIMIT } from './useNotificationBadge';

export function useNotificationsPreview({
  scope = 'personal',
  organizationId = '',
  limit = PERSONAL_NOTIF_PREVIEW_LIMIT,
  enabled: enabledProp = true,
} = {}) {
  const { isAuthenticated } = useAuth();
  const enabled = enabledProp && isAuthenticated;
  const normalizedScope = scope === 'organization' ? 'organization' : 'personal';
  const resolvedLimit =
    normalizedScope === 'personal' ? PERSONAL_NOTIF_PREVIEW_LIMIT : Math.max(1, Number(limit) || 8);

  return useQuery({
    queryKey: queryKeys.notifications.list(normalizedScope, organizationId, resolvedLimit),
    queryFn: () =>
      fetchNotificationsPreview({
        scope: normalizedScope,
        organizationId,
        limit: resolvedLimit,
      }),
    staleTime: STALE_TIME_BADGE_MS,
    enabled,
  });
}
