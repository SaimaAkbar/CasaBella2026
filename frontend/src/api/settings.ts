import { apiRequest, toQueryString } from './client';
import type { SettingCategory, SystemSetting } from '../types/settings';

export function fetchPublicSettings(): Promise<SystemSetting[]> {
  return apiRequest<SystemSetting[]>('/settings/public');
}

export function fetchSettings(
  token: string,
  category?: SettingCategory,
): Promise<SystemSetting[]> {
  return apiRequest<SystemSetting[]>(
    `/settings${toQueryString({ category })}`,
    { token },
  );
}

export function fetchSetting(
  token: string,
  key: string,
): Promise<SystemSetting> {
  return apiRequest<SystemSetting>(`/settings/${encodeURIComponent(key)}`, {
    token,
  });
}

export function updateSetting(
  token: string,
  key: string,
  value: unknown,
  reason?: string,
): Promise<SystemSetting> {
  return apiRequest<SystemSetting>(`/settings/${encodeURIComponent(key)}`, {
    method: 'PATCH',
    token,
    body: { value, reason },
  });
}

export function bulkUpdateSettings(
  token: string,
  settings: Array<{ key: string; value: unknown }>,
  reason?: string,
): Promise<SystemSetting[]> {
  return apiRequest<SystemSetting[]>('/settings/bulk', {
    method: 'PATCH',
    token,
    body: { settings, reason },
  });
}

export function resetSettingsCategory(
  token: string,
  category: SettingCategory,
): Promise<SystemSetting[]> {
  return apiRequest<SystemSetting[]>(
    `/settings/reset/${encodeURIComponent(category)}`,
    { method: 'POST', token },
  );
}
