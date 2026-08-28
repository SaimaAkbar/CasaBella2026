import { apiRequest } from './client';
import type { AuthUser } from '../types/auth';

export type NewUserPayload = {
  fullName: string;
  email: string;
  phone?: string;
  role: 'ADMIN' | 'RECEPTIONIST';
  password: string;
  forcePasswordChange?: boolean;
  status?: 'ACTIVE' | 'INACTIVE';
};

export type UpdateUserPayload = Partial<{
  fullName: string;
  email: string;
  phone: string;
  role: 'ADMIN' | 'RECEPTIONIST' | 'SUPER_ADMIN';
  status: 'ACTIVE' | 'INACTIVE';
}>;

export type ResetPasswordPayload = {
  newPassword: string;
  confirmPassword: string;
  forceChangeOnNextLogin?: boolean;
};

export async function fetchUsers(token: string) {
  return apiRequest<AuthUser[]>('/users', { token });
}

export async function createUser(token: string, payload: NewUserPayload) {
  return apiRequest<AuthUser>('/users', { method: 'POST', token, body: payload });
}

export async function updateUser(
  token: string,
  id: string,
  payload: UpdateUserPayload,
) {
  return apiRequest<AuthUser>(`/users/${id}`, {
    method: 'PATCH',
    token,
    body: payload,
  });
}

export async function resetUserPassword(
  token: string,
  id: string,
  payload: ResetPasswordPayload,
) {
  return apiRequest<AuthUser>(`/users/${id}/password`, {
    method: 'PATCH',
    token,
    body: payload,
  });
}

export async function changeUserStatus(
  token: string,
  id: string,
  status: 'ACTIVE' | 'INACTIVE',
) {
  return apiRequest<AuthUser>(`/users/${id}/status`, {
    method: 'PATCH',
    token,
    body: { status },
  });
}

export async function changeUserRole(
  token: string,
  id: string,
  role: 'ADMIN' | 'RECEPTIONIST',
) {
  return apiRequest<AuthUser>(`/users/${id}/role`, {
    method: 'PATCH',
    token,
    body: { role },
  });
}
