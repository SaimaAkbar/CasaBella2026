'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type Props = {
  checkIn?: string;
  checkOut?: string;
  availableOnly?: boolean;
  basePath: string;
  availableCount?: number;
  totalCount?: number;
};

export function RoomsDateFilter({
  checkIn = '',
  checkOut = '',
  availableOnly = true,
  basePath,
  availableCount,
  totalCount,
}: Props) {
  const router = useRouter();
  const [from, setFrom] = useState(checkIn);
  const [to, setTo] = useState(checkOut);
  const [onlyAvailable, setOnlyAvailable] = useState(availableOnly);
  const [error, setError] = useState('');

  useEffect(() => {
    setFrom(checkIn);
    setTo(checkOut);
    setOnlyAvailable(availableOnly);
  }, [checkIn, checkOut, availableOnly]);

  function pushFilter(nextFrom: string, nextTo: string, nextOnly: boolean) {
    const params = new URLSearchParams();
    if (nextFrom && nextTo) {
      params.set('checkIn', nextFrom);
      params.set('checkOut', nextTo);
      params.set('availableOnly', nextOnly ? '1' : '0');
    }
    const q = params.toString();
    router.push(q ? `${basePath}?${q}` : basePath);
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (!from || !to) {
      setError('Select both check-in and check-out dates.');
      return;
    }
    if (to <= from) {
      setError('Check-out must be after check-in.');
      return;
    }
    pushFilter(from, to, onlyAvailable);
  }

  function onClear() {
    setFrom('');
    setTo('');
    setError('');
    setOnlyAvailable(true);
    router.push(basePath);
  }

  const hasDates = Boolean(checkIn && checkOut);

  return (
    <form
      className="booking-panel rooms-date-filter"
      onSubmit={onSubmit}
      style={{ marginBottom: '1.5rem' }}
    >
      <h2 style={{ marginTop: 0 }}>Filter by dates</h2>
      <p style={{ marginTop: 0 }}>
        Choose check-in and check-out to see which rooms are free for that stay.
      </p>
      <div className="form-grid">
        <label className="form-field">
          <span>Check-in</span>
          <input
            type="date"
            value={from}
            min={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setFrom(e.target.value)}
            required
          />
        </label>
        <label className="form-field">
          <span>Check-out</span>
          <input
            type="date"
            value={to}
            min={from || new Date().toISOString().slice(0, 10)}
            onChange={(e) => setTo(e.target.value)}
            required
          />
        </label>
      </div>

      <label className="form-field form-field--checkbox rooms-date-filter__toggle">
        <input
          type="checkbox"
          checked={onlyAvailable}
          onChange={(e) => setOnlyAvailable(e.target.checked)}
        />
        <span>Show only available rooms for these dates</span>
      </label>

      {error ? <p className="stay-cal__error">{error}</p> : null}

      {hasDates && totalCount != null && availableCount != null ? (
        <p className="rooms-date-filter__summary">
          <strong>{availableCount}</strong> available of{' '}
          <strong>{totalCount}</strong> rooms for {checkIn} → {checkOut}
        </p>
      ) : null}

      <div className="booking-panel__actions">
        <button type="submit" className="btn btn--primary">
          SHOW AVAILABLE ROOMS
        </button>
        <button type="button" className="btn btn--ghost-dark" onClick={onClear}>
          Clear dates
        </button>
      </div>
    </form>
  );
}
