import { ApiError } from '../api/client';

export function getAuthErrorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error && err.message.trim()) return err.message;
  return 'Unable to sign in. Check your email and password.';
}
