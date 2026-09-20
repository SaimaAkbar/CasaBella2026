'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { StayDateCalendar } from '@/components/booking/StayDateCalendar';
import { BookingChoicePanel } from '@/components/booking/WhatsAppBookingCta';
import { checkAvailability } from '@/lib/api/bookings';
import { formatMoney, nightsBetween } from '@/lib/booking';
import type { StaySelection } from '@/types';

type Props = {
  unitId: string;
  unitName: string;
  propertyType: 'room' | 'residence';
  nightlyRate: number | null;
  maxGuests?: number;
  detailPath: string;
};

export function UnitStayAvailabilityPanel({
  unitId,
  unitName,
  propertyType,
  nightlyRate,
  maxGuests = 2,
  detailPath,
}: Props) {
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [adults, setAdults] = useState(Math.min(2, maxGuests));
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<'idle' | 'available' | 'booked'>('idle');
  const [message, setMessage] = useState('');

  const nights = nightsBetween(checkIn, checkOut);
  const estimate =
    nightlyRate != null && nights > 0 ? nightlyRate * nights : null;

  const stay = useMemo<StaySelection>(
    () => ({
      propertyType,
      propertyId: unitId,
      propertySlug: unitId,
      propertyName: unitName,
      checkIn,
      checkOut,
      adults,
      children: 0,
      units: 1,
    }),
    [propertyType, unitId, unitName, checkIn, checkOut, adults],
  );

  const bookingHref =
    checkIn && checkOut
      ? `/booking?type=${propertyType}&id=${unitId}&checkIn=${checkIn}&checkOut=${checkOut}&adults=${adults}`
      : `/booking?type=${propertyType}&id=${unitId}`;

  async function onCheck() {
    setMessage('');
    if (!checkIn || !checkOut) {
      setStatus('idle');
      setMessage('Select check-in and check-out dates.');
      return;
    }
    if (checkOut <= checkIn) {
      setStatus('idle');
      setMessage('Check-out must be after check-in.');
      return;
    }
    setBusy(true);
    try {
      const result = await checkAvailability(stay);
      if (result.available) {
        setStatus('available');
        setMessage('AVAILABLE for your selected dates.');
      } else {
        setStatus('booked');
        setMessage(
          result.message ||
            'NOT AVAILABLE FOR SELECTED DATES — this stay overlaps an existing booking.',
        );
      }
    } catch (err) {
      setStatus('idle');
      setMessage(
        err instanceof Error ? err.message : 'Unable to check availability.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="unit-avail booking-panel">
      <h2 style={{ marginTop: 0 }}>Book this stay</h2>
      <p className="price" style={{ marginTop: 0 }}>
        {formatMoney(nightlyRate)}
        <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}> / night</span>
      </p>

      <label className="form-field">
        <span>Stay dates</span>
        <StayDateCalendar
          unitId={unitId}
          checkIn={checkIn}
          checkOut={checkOut}
          onChange={({ checkIn: nextIn, checkOut: nextOut }) => {
            setCheckIn(nextIn);
            setCheckOut(nextOut);
            setStatus('idle');
            setMessage('');
          }}
        />
      </label>

      <label className="form-field" style={{ marginTop: '0.75rem' }}>
        <span>Guests</span>
        <input
          type="number"
          min={1}
          max={maxGuests}
          value={adults}
          onChange={(e) => setAdults(Number(e.target.value) || 1)}
        />
      </label>

      {nights > 0 ? (
        <p style={{ marginTop: '0.75rem' }}>
          {nights} night{nights === 1 ? '' : 's'}
          {estimate != null ? (
            <>
              {' '}
              · estimated total <strong>{formatMoney(estimate)}</strong>
            </>
          ) : null}
        </p>
      ) : null}

      <div className="booking-panel__actions">
        <button
          type="button"
          className="btn btn--ghost-dark"
          disabled={busy}
          onClick={() => void onCheck()}
        >
          {busy ? 'Checking…' : 'CHECK AVAILABILITY'}
        </button>
      </div>

      {message ? (
        <p
          className={`availability-pill${
            status === 'booked'
              ? ' is-booked'
              : status === 'available'
                ? ' is-open'
                : ''
          }`}
          style={{ marginTop: '0.85rem' }}
        >
          {status === 'available' ? '✓ ' : status === 'booked' ? '✕ ' : ''}
          {message}
        </p>
      ) : null}

      <BookingChoicePanel
        details={{
          roomId: unitId,
          roomName: unitName,
          propertyType,
          checkIn: checkIn || undefined,
          checkOut: checkOut || undefined,
          adults,
          totalAmount: estimate,
        }}
        onlineAction={
          status === 'booked' ? (
            <button type="button" className="btn btn--primary" disabled>
              ALREADY BOOKED
            </button>
          ) : status === 'available' ? (
            <Link href={bookingHref} className="btn btn--primary">
              BOOK NOW
            </Link>
          ) : (
            <Link href={bookingHref} className="btn btn--primary">
              {checkIn && checkOut ? 'CONTINUE TO BOOKING' : 'SELECT DATES'}
            </Link>
          )
        }
      />

      <p style={{ marginTop: '0.75rem', fontSize: '0.82rem', color: 'var(--muted)' }}>
        Final price is confirmed by Casa Bella POS during checkout.{' '}
        <Link href={detailPath}>Refresh page</Link> after changing dates on the
        rooms list.
      </p>
    </div>
  );
}
