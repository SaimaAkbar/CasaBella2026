import { useCallback } from 'react';
import { ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';

export function useApiErrorHandler() {
  const { logout } = useAuth();

  return useCallback(
    (err: unknown, fallback: string): string => {
      if (err instanceof ApiError && err.status === 401) {
        logout();
        return 'Session expired. Please sign in again.';
      }
      if (err instanceof ApiError && err.status === 202) {
        return err.message;
      }
      if (err instanceof ApiError && err.message.trim()) {
        return err.message;
      }
      if (err instanceof Error && err.message.trim()) {
        return err.message;
      }
      return fallback;
    },
    [logout],
  );
}
