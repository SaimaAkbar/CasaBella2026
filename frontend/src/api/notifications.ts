import { apiRequest, toQueryString } from './client';
import type { AppNotification } from '../types/approval';

export type NotificationQuery = {
  unreadOnly?: boolean;
  priority?: string;
  module?: string;
  search?: string;
  take?: number;
};

export type NotificationSummary = {
  unread: number;
  critical: number;
  todayReminders: number;
  upcomingExpiry: number;
};

export function fetchNotifications(
  token: string,
  query: NotificationQuery | boolean = false,
): Promise<AppNotification[]> {
  const params =
    typeof query === 'boolean'
      ? { unreadOnly: query ? 'true' : undefined }
      : {
          unreadOnly: query.unreadOnly ? 'true' : undefined,
          priority: query.priority,
          module: query.module,
          search: query.search,
          take: query.take,
        };

  return apiRequest<AppNotification[]>(
    `/notifications${toQueryString(params)}`,
    { token },
  );
}

export function fetchUnreadNotificationCount(
  token: string,
): Promise<{ count: number }> {
  return apiRequest<{ count: number }>('/notifications/unread-count', {
    token,
  });
}

export function fetchNotificationSummary(
  token: string,
): Promise<NotificationSummary> {
  return apiRequest<NotificationSummary>('/notifications/summary', { token });
}

export function markNotificationRead(
  token: string,
  id: string,
): Promise<AppNotification> {
  return apiRequest<AppNotification>(`/notifications/${id}/read`, {
    method: 'PATCH',
    token,
  });
}

export function markAllNotificationsRead(token: string): Promise<{ ok: boolean }> {
  return apiRequest<{ ok: boolean }>('/notifications/read-all', {
    method: 'PATCH',
    token,
  });
}
