const listeners = new Set<() => void>();

/** Notify dashboard / profit-loss views that bookings or payments changed. */
export function notifyFinanceChanged(): void {
  listeners.forEach((listener) => listener());
}

export function subscribeFinanceChanged(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
