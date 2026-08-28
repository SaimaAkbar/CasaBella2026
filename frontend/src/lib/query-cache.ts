type CacheKey = readonly unknown[];

const store = new Map<string, unknown>();
const listeners = new Set<() => void>();

function serializeKey(key: CacheKey): string {
  return JSON.stringify(key);
}

export function eligibleUnitsQueryKey(
  scope: string,
  propertyId: string,
  extras: Record<string, string | boolean | number | null | undefined> = {},
): CacheKey {
  return ['eligible-units', scope, propertyId, extras];
}

export function getQueryData<T>(key: CacheKey): T | undefined {
  return store.get(serializeKey(key)) as T | undefined;
}

export function setQueryData<T>(key: CacheKey, data: T): void {
  store.set(serializeKey(key), data);
}

export function subscribeQueryCache(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function invalidateEligibleUnitsQueries(): void {
  for (const key of [...store.keys()]) {
    if (key.startsWith('["eligible-units"')) {
      store.delete(key);
    }
  }
  listeners.forEach((listener) => listener());
}
