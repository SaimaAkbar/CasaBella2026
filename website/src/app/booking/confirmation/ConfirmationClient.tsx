'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { fetchBookingStatus } from '@/lib/api/bookings';
import { isMockMode } from '@/lib/api/client';
import { formatMoney } from '@/lib/booking';
import type { BookingConfirmation, BookingStatusResponse } from '@/types';

/**
 * Success UI is driven ONLY by verified backend status.
 * SessionStorage is used for display fallback fields, never to claim "confirmed".
 */
export default function ConfirmationClient() {
  const params = useSearchParams();
  const [booking, setBooking] = useState<BookingConfirmation | null>(null);
  const [status, setStatus] = useState<BookingStatusResponse | null>(null);
  const [polling, setPolling] = useState(false);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    const raw = sessionStorage.getItem('casaBellaBooking');
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as BookingConfirmation;
        const ref = params.get('ref');
        if (!ref || parsed.reference === ref) setBooking(parsed);
      } catch {
        setBooking(null);
      }
    }
  }, [params]);

  useEffect(() => {
    const ref = params.get('ref') || booking?.reference;
    if (!ref) return;
    if (isMockMode()) {
      setLoadError(
        'Mock catalogue mode cannot verify payment. Use the live POS API.',
      );
      return;
    }

    let cancelled = false;
    setPolling(true);

    async function poll() {
      try {
        const next = await fetchBookingStatus(ref!);
        if (cancelled) return;
        setStatus(next);
        setLoadError('');
        if (next.paymentStatus === 'PAID' && next.bookingStatus === 'CONFIRMED') {
          setPolling(false);
          return;
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(
            err instanceof Error ? err.message : 'Unable to verify booking status.',
          );
        }
      }
      if (!cancelled) {
        window.setTimeout(() => void poll(), 4000);
      }
    }

    void poll();
    return () => {
      cancelled = true;
    };
  }, [booking?.reference, params]);

  const reference = status?.bookingNumber || booking?.reference || params.get('ref');

  // ONLY backend-verified confirmation may show success.
  const verifiedConfirmed =
    status?.bookingStatus === 'CONFIRMED' && status?.paymentStatus === 'PAID';

  if (!booking && !params.get('ref')) {
    return (
      <section className="section">
        <div className="container">
          <div className="empty-state">
            <h1>No booking found</h1>
            <p>Complete a reservation first, or your session data may have cleared.</p>
            <Link href="/booking" className="btn btn--primary">
              Start booking
            </Link>
            <Link href="/booking/status" className="btn btn--ghost-dark">
              Check booking status
            </Link>
          </div>
        </div>
      </section>
    );
  }

  if (!verifiedConfirmed) {
    const totalAmount = status?.totalAmount ?? booking?.quote.total ?? null;
    const minAdvance =
      totalAmount != null ? Math.round(Number(totalAmount) * 50) / 100 : null;

    return (
      <section className="section">
        <div className="container" style={{ maxWidth: '780px' }}>
          <div className="booking-panel reveal">
            <p className="eyebrow">Payment required</p>
            <h1>PAYMENT REQUIRED</h1>
            <p>
              <strong>Your booking is not confirmed yet.</strong>
            </p>
            <p className="booking-secure-note">
              Our booking policy requires a minimum 50% advance payment before a
              reservation can be confirmed. Your reservation will be confirmed
              immediately after successful payment verification.
            </p>
            {polling ? <p>Checking payment status…</p> : null}
            {loadError ? <div className="alert alert--error">{loadError}</div> : null}

            <dl className="summary-list">
              <div>
                <dt>Booking Number</dt>
                <dd>
                  <strong>{reference || '—'}</strong>
                </dd>
              </div>
              <div>
                <dt>Booking Status</dt>
                <dd>{status?.paymentLabel || 'Pending Payment'}</dd>
              </div>
              <div>
                <dt>Total Amount</dt>
                <dd className="price">{formatMoney(totalAmount)}</dd>
              </div>
              <div>
                <dt>Minimum Required Today</dt>
                <dd className="price">{formatMoney(minAdvance)}</dd>
              </div>
              <div>
                <dt>Amount Paid</dt>
                <dd>{formatMoney(status?.receivedAmount ?? 0)}</dd>
              </div>
              <div>
                <dt>Remaining</dt>
                <dd>
                  {formatMoney(
                    status?.remainingAmount ?? totalAmount ?? 0,
                  )}
                </dd>
              </div>
            </dl>

            <div className="booking-panel__actions">
              <Link
                href={`/booking/pending?ref=${encodeURIComponent(reference || '')}`}
                className="btn btn--gold"
              >
                COMPLETE PAYMENT
              </Link>
              <Link href="/booking" className="btn btn--ghost-dark">
                Start over
              </Link>
            </div>
          </div>
        </div>
      </section>
    );
  }

  const totalAmount = status!.totalAmount;
  const paidToday = status!.receivedAmount ?? 0;
  const remaining = status!.remainingAmount ?? 0;
  const paymentLabel = status!.paymentLabel || 'Fully Paid';

  return (
    <section className="section">
      <div className="container" style={{ maxWidth: '780px' }}>
        <div className="booking-panel reveal">
          <p className="eyebrow">Success</p>
          <h1>✓ BOOKING CONFIRMED</h1>
          <p>Your reservation has been successfully secured.</p>

          <dl className="summary-list">
            <div>
              <dt>Booking Number</dt>
              <dd>
                <strong>{reference}</strong>
              </dd>
            </div>
            <div>
              <dt>Customer</dt>
              <dd>{status?.guestName || booking?.guest.fullName || '—'}</dd>
            </div>
            <div>
              <dt>Appointment / Stay</dt>
              <dd>{status?.unitLabel || booking?.stay.propertyName || '—'}</dd>
            </div>
            <div>
              <dt>Check-in</dt>
              <dd>
                {status?.checkInDateTime
                  ? new Date(status.checkInDateTime).toLocaleString()
                  : booking?.stay.checkIn}
              </dd>
            </div>
            <div>
              <dt>Check-out</dt>
              <dd>
                {status?.checkOutDateTime
                  ? new Date(status.checkOutDateTime).toLocaleString()
                  : booking?.stay.checkOut}
              </dd>
            </div>
            <div>
              <dt>Payment Type</dt>
              <dd>{status?.paymentTypeLabel || '—'}</dd>
            </div>
            <div>
              <dt>Total Amount</dt>
              <dd className="price">{formatMoney(totalAmount)}</dd>
            </div>
            <div>
              <dt>Paid Today</dt>
              <dd className="price">{formatMoney(paidToday)}</dd>
            </div>
            <div>
              <dt>Remaining Balance</dt>
              <dd>{formatMoney(remaining)}</dd>
            </div>
            <div>
              <dt>Payment Status</dt>
              <dd>{paymentLabel}</dd>
            </div>
            <div>
              <dt>Payment Provider</dt>
              <dd>{status?.paymentProvider || '—'}</dd>
            </div>
            <div>
              <dt>Transaction ID</dt>
              <dd>{status?.paymentReference || '—'}</dd>
            </div>
          </dl>

          <div className="booking-panel__actions">
            <button type="button" className="btn btn--ghost-dark" onClick={() => window.print()}>
              PRINT CONFIRMATION
            </button>
            <Link href={`/booking/status?ref=${reference || ''}`} className="btn btn--ghost-dark">
              BOOKING STATUS
            </Link>
            <Link href="/" className="btn btn--primary">
              BACK TO HOME
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
