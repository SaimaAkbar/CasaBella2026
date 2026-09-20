import { apiRequest, toQueryString } from './client';
import type {
  WebsiteFacility,
  WebsiteFacilityInput,
} from '../types/website-facility';

export function fetchWebsiteFacilities(
  token: string,
  includeInactive = true,
): Promise<WebsiteFacility[]> {
  return apiRequest<WebsiteFacility[]>(
    `/website-facilities${toQueryString({
      includeInactive: includeInactive ? 'true' : undefined,
    })}`,
    { token },
  );
}

export function createWebsiteFacility(
  token: string,
  payload: WebsiteFacilityInput,
): Promise<WebsiteFacility> {
  return apiRequest<WebsiteFacility>('/website-facilities', {
    method: 'POST',
    token,
    body: payload,
  });
}

export function updateWebsiteFacility(
  token: string,
  id: string,
  payload: Partial<WebsiteFacilityInput>,
): Promise<WebsiteFacility> {
  return apiRequest<WebsiteFacility>(`/website-facilities/${id}`, {
    method: 'PATCH',
    token,
    body: payload,
  });
}

export function archiveWebsiteFacility(
  token: string,
  id: string,
): Promise<WebsiteFacility> {
  return apiRequest<WebsiteFacility>(`/website-facilities/${id}`, {
    method: 'DELETE',
    token,
  });
}

export async function uploadFacilityImage(
  token: string,
  file: File,
): Promise<{ url: string; filename: string }> {
  const form = new FormData();
  form.append('image', file);
  const API_URL = import.meta.env.VITE_API_URL as string;
  const response = await fetch(
    `${API_URL.replace(/\/$/, '')}/website-facilities/upload-image`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: form,
    },
  );
  const raw = await response.text();
  const parsed = raw
    ? (JSON.parse(raw) as {
        url?: string;
        filename?: string;
        message?: string | string[];
      })
    : {};
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
