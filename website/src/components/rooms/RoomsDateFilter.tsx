'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

type Props = {
  checkIn?: string;
  checkOut?: string;
  basePath: string;
};

export function RoomsDateFilter({ checkIn = '', checkOut = '', basePath }: Props) {
  const router = useRouter();
  const [from, setFrom] = useState(checkIn);
  const [to, setTo] = useState(checkOut);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (from) params.set('checkIn', from);
    if (to) params.set('checkOut', to);
    const q = params.toString();
    router.push(q ? `${basePath}?${q}` : basePath);
  }

  function onClear() {
    setFrom('');
    setTo('');
    router.push(basePath);
  }

  return (
    <form
      className="booking-panel"
      onSubmit={onSubmit}
      style={{ marginBottom: '1.5rem' }}
    >
      <h2 style={{ marginTop: 0 }}>Check availability</h2>
      <p style={{ marginTop: 0 }}>
        All rooms stay visible. Dates only change BOOK NOW vs ALREADY BOOKED.
      </p>
      <div className="form-grid">
        <label className="form-field">
          <span>Check-in</span>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label className="form-field">
          <span>Check-out</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
      </div>
      <div className="booking-panel__actions">
        <button type="submit" className="btn btn--primary">
          UPDATE AVAILABILITY
        </button>
        <button type="button" className="btn btn--ghost-dark" onClick={onClear}>
          Clear dates
        </button>
      </div>
    </form>
  );
}
