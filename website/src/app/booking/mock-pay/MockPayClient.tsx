'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiFetch, isMockMode } from '@/lib/api/client';

/**
 * Local test checkout stand-in when SAFE_PAY_ENVIRONMENT=mock.
 * Does NOT auto-confirm — the customer must click to simulate payment,
 * then the backend mock-complete endpoint verifies and confirms.
 */
export default function MockPayClient() {
  const router = useRouter();
  const params = useSearchParams();
  const bookingNumber = params.get('bookingNumber') || '';
  const tracker = params.get('tracker') || '';
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function simulatePay() {
    if (!bookingNumber) {
      setError('Missing booking number.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      if (isMockMode()) {
        setError(
          'Website mock catalogue mode cannot verify payments. Set NEXT_PUBLIC_USE_MOCK_DATA=false and use the live API.',
        );
        return;
      }
      await apiFetch(
        `/public/online-bookings/${encodeURIComponent(bookingNumber)}/mock-complete`,
        { method: 'POST', body: '{}' },
      );
      router.replace(
        `/booking/confirmation?ref=${encodeURIComponent(bookingNumber)}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment simulation failed.');
    } finally {
      setBusy(false);
    }
  }

  function cancelPay() {
    if (!bookingNumber) {
      router.push('/booking');
      return;
    }
    router.push(`/booking/pending?ref=${encodeURIComponent(bookingNumber)}`);
  }

  return (
    <section className="section">
      <div className="container" style={{ maxWidth: 560 }}>
        <div className="booking-panel">
          <p className="eyebrow">Secure checkout (test mode)</p>
          <h1>Complete online payment</h1>
          <p>
            This is the local payment test page. Your booking is still{' '}
            <strong>Pending Payment</strong> until you complete payment below.
            Live Safepay keys replace this page in production.
          </p>
          {bookingNumber ? (
            <p>
              Booking: <strong>{bookingNumber}</strong>
              {tracker ? (
                <>
                  <br />
                  Reference: <code>{tracker}</code>
                </>
              ) : null}
            </p>
          ) : (
            <div className="alert alert--error">Missing booking number.</div>
          )}
          {error ? <div className="alert alert--error">{error}</div> : null}
          <div className="booking-panel__actions">
            <button
              type="button"
              className="btn btn--gold"
              disabled={busy || !bookingNumber}
              onClick={() => void simulatePay()}
            >
              {busy ? 'Verifying…' : 'SIMULATE SUCCESSFUL PAYMENT'}
            </button>
            <button
              type="button"
              className="btn btn--ghost-dark"
              disabled={busy}
              onClick={cancelPay}
            >
              Cancel / pay later
            </button>
            <Link href="/booking" className="btn btn--ghost-dark">
              Start over
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
