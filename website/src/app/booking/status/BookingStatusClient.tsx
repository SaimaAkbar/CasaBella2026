'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { fetchBookingStatus } from '@/lib/api/bookings';
import { formatMoney } from '@/lib/booking';
import type { BookingStatusResponse } from '@/types';

function statusHeadline(status: BookingStatusResponse) {
  if (status.bookingStatus === 'CONFIRMED' && status.paymentStatus === 'PAID') {
    return '✓ Booking Confirmed';
  }
  if (
    status.bookingStatus === 'PAYMENT_VERIFICATION_PENDING' ||
    status.paymentStatus === 'AUTHORIZED'
  ) {
    return 'Payment Verification Pending';
  }
  if (status.paymentStatus === 'FAILED') {
    return 'Payment Verification Unsuccessful';
  }
  if (status.bookingStatus === 'CANCELLED') {
    return 'Booking Cancelled';
  }
  return status.paymentLabel || status.bookingStatus;
}

export default function BookingStatusClient() {
  const params = useSearchParams();
  const [ref, setRef] = useState(params.get('ref') || '');
  const [status, setStatus] = useState<BookingStatusResponse | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const initial = params.get('ref');
    if (!initial) return;
    setRef(initial);
    void (async () => {
      setBusy(true);
      try {
        setStatus(await fetchBookingStatus(initial.trim()));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load booking status.');
      } finally {
        setBusy(false);
      }
    })();
  }, [params]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const next = await fetchBookingStatus(ref.trim());
      setStatus(next);
    } catch (err) {
      setStatus(null);
      setError(err instanceof Error ? err.message : 'Unable to load booking status.');
    } finally {
      setBusy(false);
    }
  }

  const needsPayment =
    status &&
    status.bookingStatus === 'PENDING' &&
    status.paymentStatus === 'PENDING';

  const awaitingVerification =
    status &&
    (status.paymentStatus === 'AUTHORIZED' ||
      status.bookingStatus === 'PAYMENT_VERIFICATION_PENDING');

  const rejected = status?.paymentStatus === 'FAILED';
  const confirmed =
    status?.bookingStatus === 'CONFIRMED' && status.paymentStatus === 'PAID';

  return (
    <section className="section">
      <div className="container" style={{ maxWidth: 720 }}>
        <div className="booking-panel">
          <p className="eyebrow">Look up</p>
          <h1>Booking status</h1>
          <form onSubmit={onSubmit} className="form-grid">
            <label className="form-field form-field--full">
              <span>Booking number</span>
              <input
                required
                value={ref}
                onChange={(e) => setRef(e.target.value)}
                placeholder="CB-…"
              />
            </label>
            <div className="booking-panel__actions">
              <button type="submit" className="btn btn--primary" disabled={busy}>
                {busy ? 'Checking…' : 'Check status'}
              </button>
              <Link href="/booking" className="btn btn--ghost-dark">
                New booking
              </Link>
            </div>
          </form>
          {error ? <div className="alert alert--error">{error}</div> : null}
          {status ? (
            <>
              <h2 style={{ marginTop: '1.5rem', fontSize: '1.25rem' }}>
                {statusHeadline(status)}
              </h2>
              {status.message ? <p>{status.message}</p> : null}
              {rejected && status.rejectionReason ? (
                <p>
                  <strong>Reason:</strong> {status.rejectionReason}
                </p>
              ) : null}
              {rejected ? (
                <p>
                  Please review your payment details or contact Casa Bella Hotel
                  & Residence for assistance.
                </p>
              ) : null}
              {confirmed ? (
                <p>
                  Your payment has been successfully verified and your
                  reservation is now confirmed.
                </p>
              ) : null}
              <dl className="summary-list" style={{ marginTop: '1.5rem' }}>
                <div>
                  <dt>Booking Number</dt>
                  <dd>{status.bookingNumber}</dd>
                </div>
                <div>
                  <dt>Room/Apartment</dt>
                  <dd>{status.unitLabel}</dd>
                </div>
                <div>
                  <dt>Check-in</dt>
                  <dd>{new Date(status.checkInDateTime).toLocaleDateString()}</dd>
                </div>
                <div>
                  <dt>Check-out</dt>
                  <dd>{new Date(status.checkOutDateTime).toLocaleDateString()}</dd>
                </div>
                <div>
                  <dt>Booking Status</dt>
                  <dd>
                    {status.bookingStatus === 'CONFIRMED'
                      ? 'BOOKING CONFIRMED'
                      : status.bookingStatus === 'PAYMENT_VERIFICATION_PENDING'
                        ? 'PAYMENT VERIFICATION PENDING'
                        : status.bookingStatus === 'CANCELLED'
                          ? 'BOOKING CANCELLED'
                          : status.paymentLabel || status.bookingStatus}
                  </dd>
                </div>
                <div>
                  <dt>Payment Status</dt>
                  <dd>{status.paymentLabel || status.paymentStatus}</dd>
                </div>
                <div>
                  <dt>Payment Type</dt>
                  <dd>{status.paymentTypeLabel || '—'}</dd>
                </div>
                <div>
                  <dt>Payment Received</dt>
                  <dd>{formatMoney(status.receivedAmount ?? 0)}</dd>
                </div>
                <div>
                  <dt>Remaining Balance</dt>
                  <dd>{formatMoney(status.remainingAmount ?? 0)}</dd>
                </div>
              </dl>
              {needsPayment ? (
                <div className="booking-panel__actions" style={{ marginTop: '1rem' }}>
                  <Link
                    href={`/booking/payment?ref=${encodeURIComponent(status.bookingNumber)}`}
                    className="btn btn--gold"
                  >
                    Complete payment
                  </Link>
                </div>
              ) : null}
              {awaitingVerification ? (
                <p className="muted" style={{ marginTop: '1rem' }}>
                  Our team is verifying your bank transfer. This page updates
                  automatically when you check again.
                </p>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}
