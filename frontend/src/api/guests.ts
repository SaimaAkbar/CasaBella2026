import { apiRequest, toQueryString } from './client';
import type { Guest, GuestInput } from '../types/guest';

export function fetchGuests(
  token: string,
  query: { search?: string; isActive?: boolean } = {},
): Promise<Guest[]> {
  return apiRequest<Guest[]>(`/guests${toQueryString(query)}`, { token });
}

export function createGuest(
  token: string,
  payload: GuestInput,
): Promise<Guest> {
  return apiRequest<Guest>('/guests', {
    method: 'POST',
    token,
    body: payload,
  });
}

export function updateGuest(
  token: string,
  id: string,
  payload: GuestInput,
): Promise<Guest> {
  return apiRequest<Guest>(`/guests/${id}`, {
    method: 'PATCH',
    token,
    body: payload,
  });
}

export function archiveGuest(token: string, id: string): Promise<Guest> {
  return apiRequest<Guest>(`/guests/${id}`, {
    method: 'DELETE',
    token,
  });
}
