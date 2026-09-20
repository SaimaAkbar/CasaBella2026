'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { fetchBookingStatus } from '@/lib/api/bookings';
import { formatMoney } from '@/lib/booking';
import type { BookingStatusResponse } from '@/types';

export default function PendingPaymentClient() {
  const params = useSearchParams();
  const router = useRouter();
  const ref = params.get('ref') || '';
  const [status, setStatus] = useState<BookingStatusResponse | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    if (!ref) {
      setBusy(false);
      setError('Missing booking reference.');
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const next = await fetchBookingStatus(ref);
        if (cancelled) return;
        setStatus(next);
        if (next.paymentStatus === 'PAID' && next.bookingStatus === 'CONFIRMED') {
          router.replace(`/booking/confirmation?ref=${encodeURIComponent(ref)}`);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to load booking.');
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    }

    void load();
    const id = window.setInterval(() => void load(), 5000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [ref, router]);

  if (!ref) {
    return (
      <section className="section">
        <div className="container" style={{ maxWidth: 720 }}>
          <div className="booking-panel">
            <h1>Payment required</h1>
            <p>Provide a booking number to continue.</p>
            <Link href="/booking/status" className="btn btn--primary">
              Look up booking
            </Link>
          </div>
        </div>
      </section>
    );
  }

  const unpaid =
    status &&
    status.bookingStatus === 'PENDING' &&
    status.paymentStatus !== 'PAID';
  const total = status?.totalAmount ?? 0;
  const minAdvance = Math.round(total * 50) / 100;

  return (
    <section className="section">
      <div className="container" style={{ maxWidth: 720 }}>
        <div className="booking-panel">
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

          {busy && !status ? <p>Checking booking…</p> : null}
          {error ? <div className="alert alert--error">{error}</div> : null}

          {status ? (
            <dl className="summary-list">
              <div>
                <dt>Booking Number</dt>
                <dd>
                  <strong>{status.bookingNumber}</strong>
                </dd>
              </div>
              <div>
                <dt>Booking Status</dt>
                <dd>{status.paymentLabel || 'Pending Payment'}</dd>
              </div>
              <div>
                <dt>Stay</dt>
                <dd>{status.unitLabel}</dd>
              </div>
              <div>
                <dt>Check-in</dt>
                <dd>{new Date(status.checkInDateTime).toLocaleString()}</dd>
              </div>
              <div>
                <dt>Check-out</dt>
                <dd>{new Date(status.checkOutDateTime).toLocaleString()}</dd>
              </div>
              <div>
                <dt>Total Amount</dt>
                <dd className="price">{formatMoney(total)}</dd>
              </div>
              <div>
                <dt>Minimum Required Today</dt>
                <dd className="price">{formatMoney(minAdvance)}</dd>
              </div>
              <div>
                <dt>Selected payment</dt>
                <dd>{status.paymentTypeLabel || '—'}</dd>
              </div>
              <div>
                <dt>Amount Paid</dt>
                <dd>{formatMoney(status.receivedAmount ?? 0)}</dd>
              </div>
              <div>
                <dt>Remaining</dt>
                <dd>{formatMoney(status.remainingAmount ?? total)}</dd>
              </div>
            </dl>
          ) : null}

          <div className="booking-panel__actions">
            {unpaid && status?.checkoutUrl ? (
              <a className="btn btn--gold" href={status.checkoutUrl}>
                PROCEED TO SECURE PAYMENT
              </a>
            ) : unpaid ? (
              <Link
                href={`/booking/payment?ref=${encodeURIComponent(ref)}`}
                className="btn btn--gold"
              >
                PROCEED TO PAYMENT
              </Link>
            ) : null}
            <Link
              href={`/booking/confirmation?ref=${encodeURIComponent(ref)}`}
              className="btn btn--ghost-dark"
            >
              Check confirmation status
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
