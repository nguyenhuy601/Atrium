import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSocket } from '../../context/SocketContext';
import { queryKeys } from '../../lib/queryKeys';
import { NOTIFICATIONS_REFRESH_EVENT } from '../../services/notificationSync';
import { RBAC_GRANTS_CHANGED_EVENT } from '../../utils/rbacUi';

const PERSONAL_NOTIF_PREVIEW_LIMIT = 8;

function patchDashboardSummaryUnread(queryClient, unread) {
  const n = Math.max(0, Number(unread) || 0);
  queryClient.setQueriesData({ queryKey: queryKeys.dashboard.all }, (prev) => {
    if (!prev || typeof prev !== 'object') return prev;
    return { ...prev, unread: n };
  });
}

/**
 * Invalidate / hydrate React Query cache khi có snapshot realtime (wave-3c).
 * Không invalidate dashboard summary trên mỗi notification — tránh double GET /reports/.../dashboard/me
 * (DashboardPage đã patch unread local / poll interval riêng).
 */
export default function QueryRealtimeSync() {
  const queryClient = useQueryClient();
  const { on, off, connected } = useSocket();

  useEffect(() => {
    const onWindowRefresh = () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    };

    const onRbacGrantsChanged = () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.rbac.all });
    };

    window.addEventListener(NOTIFICATIONS_REFRESH_EVENT, onWindowRefresh);
    window.addEventListener(RBAC_GRANTS_CHANGED_EVENT, onRbacGrantsChanged);

    return () => {
      window.removeEventListener(NOTIFICATIONS_REFRESH_EVENT, onWindowRefresh);
      window.removeEventListener(RBAC_GRANTS_CHANGED_EVENT, onRbacGrantsChanged);
    };
  }, [queryClient]);

  useEffect(() => {
    if (!connected) return undefined;

    const onUnreadUpdated = (payload = {}) => {
      const scope = payload.scope === 'organization' ? 'organization' : 'personal';
      const organizationId =
        scope === 'organization' ? String(payload.organizationId || '') : '';
      const count = Number(payload.count);

      if (!Number.isFinite(count)) {
        queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
        return;
      }

      const unread = Math.max(0, count);
      queryClient.setQueryData(queryKeys.notifications.badge(scope, organizationId), {
        unreadCount: unread,
      });

      if (scope === 'personal') {
        queryClient.setQueryData(
          queryKeys.notifications.list('personal', '', PERSONAL_NOTIF_PREVIEW_LIMIT),
          (prev) =>
            prev && typeof prev === 'object'
              ? { ...prev, unreadCount: unread }
              : { unreadCount: unread, notifications: [] }
        );
        patchDashboardSummaryUnread(queryClient, unread);
      }

      if (scope === 'organization' && organizationId) {
        queryClient.setQueryData(queryKeys.notifications.badge('organization', organizationId), {
          unreadCount: unread,
        });
      }
    };

    const onOrgShellUpdated = (payload = {}) => {
      const orgId = String(payload.organizationId || '').trim();
      if (!orgId) return;
      queryClient.invalidateQueries({ queryKey: queryKeys.org.myProfileAll(orgId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.org.structureAll(orgId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.org.accessibleChannels(orgId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.org.taskWorkspaceScope(orgId) });
    };

    const onLegacyNotification = () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    };

    const notificationEvents = [
      'notification:new',
      'notification:bulk_new',
      'notification:read',
      'notification:read_many',
      'notification:read_all',
      'notification:deleted',
      'notification:deleted_read_all',
    ];

    notificationEvents.forEach((ev) => on(ev, onLegacyNotification));
    on('notification:unread_updated', onUnreadUpdated);
    on('org:shell:updated', onOrgShellUpdated);

    return () => {
      notificationEvents.forEach((ev) => off(ev, onLegacyNotification));
      off('notification:unread_updated', onUnreadUpdated);
      off('org:shell:updated', onOrgShellUpdated);
    };
  }, [connected, on, off, queryClient]);

  return null;
}
