import { queryClient } from './queryClient';
import { queryKeys } from './queryKeys';

/** Đọc cache đã hydrate từ bootstrap — tránh refetch trùng khi mount public pages. */
export function getCachedOrganizationsMy() {
  return queryClient.getQueryData(queryKeys.organizations.my());
}

export function getCachedNotificationBadge(scope = 'personal', organizationId = '') {
  return queryClient.getQueryData(queryKeys.notifications.badge(scope, organizationId));
}
