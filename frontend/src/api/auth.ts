import { apiRequest } from './client';
import type { AuthProfile, LoginRequest, LoginResponse } from '../types/auth';

export function loginRequest(payload: LoginRequest): Promise<LoginResponse> {
  return apiRequest<LoginResponse>('/auth/login', {
    method: 'POST',
    body: payload,
  });
}

export function getProfileRequest(token: string): Promise<AuthProfile> {
  return apiRequest<AuthProfile>('/auth/profile', {
    method: 'GET',
    token,
  });
}
