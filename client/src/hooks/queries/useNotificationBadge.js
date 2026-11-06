import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { queryKeys } from '../../lib/queryKeys';
import { STALE_TIME_BADGE_MS } from '../../lib/queryClient';
import { fetchNotificationBadge, fetchNotificationsPreview } from './fetchers';

/** Personal badge chia sẻ cache với Dashboard preview (limit=8) — tránh GET /notifications?limit=1 trùng. */
export const PERSONAL_NOTIF_PREVIEW_LIMIT = 8;

export function useNotificationBadge({
  scope = 'personal',
  organizationId = '',
  enabled: enabledProp = true,
} = {}) {
  const { isAuthenticated } = useAuth();
  const { connected: socketConnected } = useSocket();
  const queryClient = useQueryClient();
  const enabled = enabledProp && isAuthenticated;
  const normalizedScope = scope === 'organization' ? 'organization' : 'personal';
  const sharePersonalPreview = normalizedScope === 'personal';

  const query = useQuery({
    queryKey: sharePersonalPreview
      ? queryKeys.notifications.list('personal', '', PERSONAL_NOTIF_PREVIEW_LIMIT)
      : queryKeys.notifications.badge(normalizedScope, organizationId),
    queryFn: () =>
      sharePersonalPreview
        ? fetchNotificationsPreview({
            scope: 'personal',
            limit: PERSONAL_NOTIF_PREVIEW_LIMIT,
          })
        : fetchNotificationBadge({
            scope: normalizedScope,
            organizationId,
          }),
    staleTime: socketConnected ? Number.POSITIVE_INFINITY : STALE_TIME_BADGE_MS,
    refetchOnWindowFocus: !socketConnected,
    enabled,
  });

  const unreadCount = query.data?.unreadCount ?? 0;

  useEffect(() => {
    if (!sharePersonalPreview || !query.isSuccess) return;
    queryClient.setQueryData(queryKeys.notifications.badge('personal', ''), {
      unreadCount,
    });
  }, [sharePersonalPreview, query.isSuccess, unreadCount, queryClient]);

  return { ...query, unreadCount };
}
