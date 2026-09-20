import { apiRequest, toQueryString } from './client';
import type { Unit, UnitInput, UnitQuery } from '../types/unit';

export function fetchUnits(token: string, query: UnitQuery = {}): Promise<Unit[]> {
  return apiRequest<Unit[]>(
    `/units${toQueryString({
      propertyId: query.propertyId,
      unitType: query.unitType || undefined,
      status: query.status || undefined,
      isActive:
        query.isActive === '' || query.isActive === undefined
          ? undefined
          : query.isActive,
      search: query.search,
    })}`,
    { token },
  );
}

export function fetchUnit(token: string, id: string): Promise<Unit> {
  return apiRequest<Unit>(`/units/${id}`, { token });
}

export function createUnit(token: string, payload: UnitInput): Promise<Unit> {
  return apiRequest<Unit>('/units', {
    method: 'POST',
    token,
    body: payload,
  });
}

export function updateUnit(
  token: string,
  id: string,
  payload: Partial<UnitInput>,
): Promise<Unit> {
  return apiRequest<Unit>(`/units/${id}`, {
    method: 'PATCH',
    token,
    body: payload,
  });
}

export async function uploadUnitImage(
  token: string,
  file: File,
): Promise<{ url: string; filename: string }> {
  const form = new FormData();
  form.append('image', file);
  const API_URL = import.meta.env.VITE_API_URL as string;
  const response = await fetch(`${API_URL.replace(/\/$/, '')}/units/upload-image`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: form,
  });
  const raw = await response.text();
  const parsed = raw ? (JSON.parse(raw) as { url?: string; filename?: string; message?: string | string[]; pendingApproval?: boolean }) : {};
  if (!response.ok) {
    const message = Array.isArray(parsed.message)
      ? parsed.message.join(', ')
      : parsed.message || `Upload failed (${response.status})`;
    throw new Error(message);
  }
  if (!parsed.url) {
    throw new Error('Upload succeeded but no image URL was returned.');
  }
  return { url: parsed.url, filename: parsed.filename || '' };
}

export function archiveUnit(token: string, id: string): Promise<Unit> {
  return apiRequest<Unit>(`/units/${id}`, {
    method: 'DELETE',
    token,
  });
}
