import { useEffect, useRef, useState } from 'react';
import {
  eligibleUnitsQueryKey,
  getQueryData,
  setQueryData,
  subscribeQueryCache,
} from '../lib/query-cache';

type UseEligibleUnitsOptions<T> = {
  token: string;
  propertyId: string;
  scope: 'monthly' | 'booking' | 'hotel-use';
  enabled?: boolean;
  extras?: Record<string, string | boolean | number | null | undefined>;
  fetcher: () => Promise<T[]>;
  onError?: (message: string) => void;
};

export function useEligibleUnitsQuery<T>({
  token,
  propertyId,
  scope,
  enabled = true,
  extras = {},
  fetcher,
  onError,
}: UseEligibleUnitsOptions<T>): {
  units: T[];
  loading: boolean;
  loadError: string | null;
  queryKey: readonly unknown[];
} {
  const queryKey = eligibleUnitsQueryKey(scope, propertyId, extras);
  const canFetch = Boolean(token && propertyId && enabled);
  const fetcherRef = useRef(fetcher);
  const onErrorRef = useRef(onError);
  fetcherRef.current = fetcher;
  onErrorRef.current = onError;

  const [units, setUnits] = useState<T[]>(() =>
    canFetch ? (getQueryData<T[]>(queryKey) ?? []) : [],
  );
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [invalidateVersion, setInvalidateVersion] = useState(0);

  useEffect(
    () =>
      subscribeQueryCache(() => {
        // Only invalidateEligibleUnitsQueries notifies. Refetch when cache cleared.
        setInvalidateVersion((v) => v + 1);
      }),
    [],
  );

  useEffect(() => {
    if (!canFetch) {
      setUnits([]);
      setLoading(false);
      setLoadError(null);
      return;
    }

    const cached = getQueryData<T[]>(queryKey);
    if (cached) {
      setUnits(cached);
      setLoadError(null);
      // Still revalidate in background after invalidate; for normal property
      // changes prefer cache then fetch once below.
    }

    let cancelled = false;
    setLoading(true);

    void fetcherRef
      .current()
      .then((data) => {
        if (cancelled) return;
        const rows = Array.isArray(data) ? data : [];
        setQueryData(queryKey, rows);
        setUnits(rows);
        setLoadError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message =
          err instanceof Error && err.message.trim()
            ? err.message
            : 'Unable to load eligible units.';
        // Keep prior units if we already showed cached rows; otherwise clear.
        if (!getQueryData<T[]>(queryKey)) {
          setUnits([]);
        }
        setLoadError(message);
        onErrorRef.current?.(message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // invalidateVersion bumps only on invalidateEligibleUnitsQueries
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canFetch, token, propertyId, scope, invalidateVersion, JSON.stringify(extras)]);

  return { units, loading, loadError, queryKey };
}
