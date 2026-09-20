'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { StayDateCalendar } from '@/components/booking/StayDateCalendar';

type Props = {
  compact?: boolean;
  defaultType?: 'room' | 'residence';
  propertyId?: string;
};

export function BookingSearch({
  compact = false,
  defaultType = 'residence',
  propertyId,
}: Props) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const data = new FormData(event.currentTarget);
    const adults = String(data.get('adults') || '2');
    const children = String(data.get('children') || '0');
    const type = String(data.get('type') || defaultType);
    if (!checkIn || !checkOut) {
      setError('Please choose check-in and check-out dates.');
      return;
    }
    if (checkOut <= checkIn) {
      setError('Check-out must be after check-in.');
      return;
    }
    const params = new URLSearchParams({
      type,
      checkIn,
      checkOut,
      adults,
      children,
    });
    if (propertyId) params.set('id', propertyId);
    router.push(`/booking?${params.toString()}`);
  }

  return (
    <form
      className={`booking-search${compact ? ' booking-search--compact' : ''}`}
      onSubmit={onSubmit}
    >
      {!compact ? (
        <div>
          <p className="eyebrow">Plan your stay</p>
          <h2 style={{ marginBottom: '0.4rem' }}>Check availability</h2>
          <p className="lead">
            Choose dates and guests. Booked nights for the selected room appear
            in red.
          </p>
        </div>
      ) : null}

      {error ? <div className="alert alert--error">{error}</div> : null}

      <div className="booking-search__grid">
        {!propertyId ? (
          <label className="form-field">
            <span>Stay type</span>
            <select name="type" defaultValue={defaultType}>
              <option value="residence">Residence</option>
              <option value="room">Hotel room</option>
            </select>
          </label>
        ) : (
          <input type="hidden" name="type" value={defaultType} />
        )}
        <label className="form-field">
          <span>Adults</span>
          <input name="adults" type="number" min={1} defaultValue={2} />
        </label>
        <label className="form-field">
          <span>Children</span>
          <input name="children" type="number" min={0} defaultValue={0} />
        </label>
        <div className="form-field form-field--full">
          <span>Stay dates</span>
          <StayDateCalendar
            unitId={propertyId || null}
            checkIn={checkIn}
            checkOut={checkOut}
            onChange={({ checkIn: nextIn, checkOut: nextOut }) => {
              setCheckIn(nextIn);
              setCheckOut(nextOut);
            }}
          />
          {!propertyId ? (
            <p className="stay-cal__hint" style={{ marginTop: '0.5rem' }}>
              Open a specific room page to see that room&apos;s booked dates in
              red, or continue and pick the room in the booking wizard.
            </p>
          ) : null}
        </div>
        <div className="booking-search__action">
          <button type="submit" className="btn btn--gold">
            Check availability
          </button>
        </div>
      </div>
    </form>
  );
}
