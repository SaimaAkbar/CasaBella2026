import { apiRequest } from './client';
import type { Property, PropertyInput } from '../types/property';

export function fetchProperties(token: string): Promise<Property[]> {
  return apiRequest<Property[]>('/properties', { token });
}

export function fetchProperty(token: string, id: string): Promise<Property> {
  return apiRequest<Property>(`/properties/${id}`, { token });
}

export function createProperty(
  token: string,
  payload: PropertyInput,
): Promise<Property> {
  return apiRequest<Property>('/properties', {
    method: 'POST',
    token,
    body: payload,
  });
}

export function updateProperty(
  token: string,
  id: string,
  payload: Partial<PropertyInput>,
): Promise<Property> {
  return apiRequest<Property>(`/properties/${id}`, {
    method: 'PATCH',
    token,
    body: payload,
  });
}

export function archiveProperty(token: string, id: string): Promise<Property> {
  return apiRequest<Property>(`/properties/${id}`, {
    method: 'DELETE',
    token,
  });
}
