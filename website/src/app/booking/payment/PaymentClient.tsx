'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  fetchBankTransferPaymentPage,
  submitBankTransferPayment,
  type BankTransferPaymentPage,
  type BankTransferSubmitResult,
} from '@/lib/api/bookings';
import { formatMoney } from '@/lib/booking';
import type { OnlinePaymentSelection } from '@/types';

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(iso));
}

export default function PaymentClient() {
  const params = useSearchParams();
  const ref = params.get('ref') || '';
  const [page, setPage] = useState<BankTransferPaymentPage | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [result, setResult] = useState<BankTransferSubmitResult | null>(null);

  const [transferDate, setTransferDate] = useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const [transactionReference, setTransactionReference] = useState('');
  const [senderName, setSenderName] = useState('');
  const [senderBank, setSenderBank] = useState('');
  const [receipt, setReceipt] = useState<File | null>(null);

  useEffect(() => {
    if (!ref) {
      setBusy(false);
      setError('Missing booking reference.');
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const next = await fetchBankTransferPaymentPage(ref);
        if (cancelled) return;
        setPage(next);
        setSenderName(next.guestName || '');
        if (next.alreadySubmitted && next.paymentStatus === 'AUTHORIZED') {
          setResult({
            ok: true,
            bookingNumber: next.bookingNumber,
            bookingStatus: 'PAYMENT_VERIFICATION_PENDING',
            paymentStatus: 'PENDING_VERIFICATION',
            paymentTypeLabel: next.paymentTypeLabel,
            submittedAmount: next.submitted?.submittedAmount ?? next.expectedAmount,
            expectedAmount: next.expectedAmount,
            remainingAfterPayment: next.remainingAfterPayment,
            message:
              'Payment details already submitted and awaiting staff verification.',
          });
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to load payment page.');
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ref]);

  const selection = (page?.paymentSelection || 'FULL_100') as OnlinePaymentSelection;
  const expectedAmount = Number(page?.expectedAmount ?? 0);
  const totalAmount = Number(page?.bookingTotalAmount ?? 0);
  const remaining = Number(page?.remainingAfterPayment ?? 0);

  const canSubmit = useMemo(() => {
    if (!page) return false;
    if (page.paymentStatus === 'PAID' || page.paymentStatus === 'FAILED') return false;
    if (page.alreadySubmitted && page.paymentStatus === 'AUTHORIZED') return false;
    return true;
  }, [page]);

  async function copyIban() {
    if (!page?.bank.iban) return;
    try {
      await navigator.clipboard.writeText(page.bank.iban);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Unable to copy IBAN. Please copy it manually.');
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!page || !canSubmit) return;
    setSubmitting(true);
    setError('');
    try {
      const next = await submitBankTransferPayment({
        bookingNumber: page.bookingNumber,
        paymentSelection: selection,
        submittedAmount: expectedAmount,
        transferDate,
        transactionReference: transactionReference.trim(),
        senderName: senderName.trim(),
        senderBank: senderBank.trim(),
        receipt,
      });
      setResult(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit payment.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!ref) {
    return (
      <section className="section">
        <div className="container" style={{ maxWidth: 760 }}>
          <div className="booking-panel">
            <h1>PAYMENT</h1>
            <p>Provide a booking number to continue.</p>
            <Link href="/booking/status" className="btn btn--primary">
              Look up booking
            </Link>
          </div>
        </div>
      </section>
    );
  }

  if (busy) {
    return (
      <section className="section">
        <div className="container" style={{ maxWidth: 760 }}>
          <div className="booking-panel">Loading payment details…</div>
        </div>
      </section>
    );
  }

  if (result) {
    return (
      <section className="section">
        <div className="container" style={{ maxWidth: 760 }}>
          <div className="booking-panel">
            <p className="eyebrow">Casa Bella Hotel & Residence</p>
            <h1>Payment Submitted Successfully</h1>
            <p>
              Thank you for choosing Casa Bella Hotel & Residence. Your payment
              details have been received and are currently being verified by our
              team.
            </p>
            <p>
              Your reservation will be confirmed once our team verifies the
              payment against our bank records.
            </p>
            <p>Please keep your transaction reference for your records.</p>
            <dl className="summary-list" style={{ marginTop: '1.5rem' }}>
              <div>
                <dt>Booking Number</dt>
                <dd>{result.bookingNumber}</dd>
              </div>
              <div>
                <dt>Payment Type</dt>
                <dd>{result.paymentTypeLabel}</dd>
              </div>
              <div>
                <dt>Submitted Amount</dt>
                <dd>{formatMoney(Number(result.submittedAmount))}</dd>
              </div>
              <div>
                <dt>Payment Status</dt>
                <dd>Pending Verification</dd>
              </div>
            </dl>
            <div className="booking-panel__actions">
              <Link
                href={`/booking/status?ref=${encodeURIComponent(result.bookingNumber)}`}
                className="btn btn--primary"
              >
                Check booking status
              </Link>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (!page) {
    return (
      <section className="section">
        <div className="container" style={{ maxWidth: 760 }}>
          <div className="booking-panel">
            <h1>PAYMENT</h1>
            {error ? <div className="alert alert--error">{error}</div> : null}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="section">
      <div className="container" style={{ maxWidth: 760 }}>
        <div className="booking-panel">
          <p className="eyebrow">Casa Bella Hotel & Residence</p>
          <h1>PAYMENT</h1>

          <h2 style={{ marginTop: '1.5rem', fontSize: '1.1rem' }}>Your Booking</h2>
          <dl className="summary-list">
            <div>
              <dt>Room</dt>
              <dd>{page.unitLabel}</dd>
            </div>
            <div>
              <dt>Check-in</dt>
              <dd>{fmtDate(page.checkInDateTime)}</dd>
            </div>
            <div>
              <dt>Check-out</dt>
              <dd>{fmtDate(page.checkOutDateTime)}</dd>
            </div>
            <div>
              <dt>Guests</dt>
              <dd>{page.numberOfGuests}</dd>
            </div>
            <div>
              <dt>Number of Nights</dt>
              <dd>{page.nights}</dd>
            </div>
            <div>
              <dt>Room Amount</dt>
              <dd>{formatMoney(Number(page.quote.roomCharges))}</dd>
            </div>
            <div>
              <dt>Taxes</dt>
              <dd>{formatMoney(Number(page.quote.taxes || 0))}</dd>
            </div>
            <div>
              <dt>Total Booking Amount</dt>
              <dd>{formatMoney(totalAmount)}</dd>
            </div>
          </dl>

          <h2 style={{ marginTop: '2rem', fontSize: '1.1rem' }}>Select Payment</h2>
          <div className="payment-options" role="radiogroup" aria-label="Payment option">
            <label
              className={`payment-option${selection === 'ADVANCE_50' ? ' is-selected' : ''}`}
            >
              <input
                type="radio"
                name="paymentSelection"
                checked={selection === 'ADVANCE_50'}
                readOnly
              />
              <span>
                <strong>50% Advance Payment</strong>
                <em>
                  {selection === 'ADVANCE_50'
                    ? formatMoney(expectedAmount)
                    : formatMoney(Math.round(totalAmount * 50) / 100)}
                </em>
                {selection === 'ADVANCE_50' ? (
                  <small>Remaining balance: {formatMoney(remaining)}</small>
                ) : null}
              </span>
            </label>
            <label
              className={`payment-option${selection === 'FULL_100' ? ' is-selected' : ''}`}
            >
              <input
                type="radio"
                name="paymentSelection"
                checked={selection === 'FULL_100'}
                readOnly
              />
              <span>
                <strong>Full Payment</strong>
                <em>
                  {selection === 'FULL_100'
                    ? formatMoney(expectedAmount)
                    : formatMoney(totalAmount)}
                </em>
                {selection === 'FULL_100' ? (
                  <small>Remaining balance: {formatMoney(0)}</small>
                ) : null}
              </span>
            </label>
          </div>
          <p className="muted" style={{ marginTop: '0.75rem' }}>
            Payment option was selected during checkout and locked for this
            booking. Amount to transfer:{' '}
            <strong>{formatMoney(expectedAmount)}</strong>
          </p>

          <h2 style={{ marginTop: '2rem', fontSize: '1.1rem' }}>
            Bank Transfer Details
          </h2>
          <dl className="summary-list">
            <div>
              <dt>Account Name</dt>
              <dd>{page.bank.accountName}</dd>
            </div>
            <div>
              <dt>IBAN</dt>
              <dd>
                <code style={{ letterSpacing: '0.04em' }}>{page.bank.iban}</code>
              </dd>
            </div>
            <div>
              <dt>Branch</dt>
              <dd>{page.bank.branch}</dd>
            </div>
          </dl>
          <button type="button" className="btn btn--ghost-dark" onClick={() => void copyIban()}>
            {copied ? 'IBAN Copied' : 'Copy IBAN'}
          </button>

          <div className="alert" style={{ marginTop: '1.5rem' }}>
            <strong>How to complete your payment</strong>
            <ol style={{ margin: '0.75rem 0 0', paddingLeft: '1.2rem' }}>
              <li>Select your preferred payment amount.</li>
              <li>Transfer the displayed amount to the Casa Bella bank account.</li>
              <li>Keep your bank transfer receipt/transaction reference.</li>
              <li>Enter the transfer details below.</li>
              <li>Submit your payment for verification.</li>
              <li>Our team will verify the payment with our bank records.</li>
              <li>Your booking will be confirmed once the payment has been verified.</li>
            </ol>
            <p style={{ marginTop: '0.85rem' }}>{page.bank.instructions}</p>
          </div>

          {canSubmit ? (
            <form onSubmit={onSubmit} className="form-grid" style={{ marginTop: '1.75rem' }}>
              <h2 style={{ gridColumn: '1 / -1', fontSize: '1.1rem', margin: 0 }}>
                Payment Verification Details
              </h2>
              <label className="form-field">
                <span>Payment Amount</span>
                <input readOnly value={formatMoney(expectedAmount)} />
              </label>
              <label className="form-field">
                <span>Payment Type</span>
                <input readOnly value={page.paymentTypeLabel} />
              </label>
              <label className="form-field">
                <span>Bank Transfer Date</span>
                <input
                  required
                  type="date"
                  value={transferDate}
                  onChange={(e) => setTransferDate(e.target.value)}
                />
              </label>
              <label className="form-field">
                <span>Bank Transaction ID / Reference Number</span>
                <input
                  required
                  value={transactionReference}
                  onChange={(e) => setTransactionReference(e.target.value)}
                  placeholder="e.g. TXN123456"
                />
              </label>
              <label className="form-field">
                <span>Sender Name</span>
                <input
                  required
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                />
              </label>
              <label className="form-field">
                <span>Sender Bank</span>
                <input
                  required
                  value={senderBank}
                  onChange={(e) => setSenderBank(e.target.value)}
                  placeholder="e.g. Faysal Bank"
                />
              </label>
              <label className="form-field form-field--full">
                <span>Upload Payment Receipt (optional — JPG, PNG, PDF, max 5MB)</span>
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
                  onChange={(e) => setReceipt(e.target.files?.[0] ?? null)}
                />
              </label>
              {error ? (
                <div className="alert alert--error" style={{ gridColumn: '1 / -1' }}>
                  {error}
                </div>
              ) : null}
              <div className="booking-panel__actions" style={{ gridColumn: '1 / -1' }}>
                <button
                  type="submit"
                  className="btn btn--gold"
                  disabled={submitting}
                >
                  {submitting
                    ? 'Submitting…'
                    : 'Submit Payment for Verification'}
                </button>
              </div>
              <p className="muted" style={{ gridColumn: '1 / -1' }}>
                Your booking will remain pending until our team verifies your
                payment.
              </p>
            </form>
          ) : (
            <div className="alert" style={{ marginTop: '1.5rem' }}>
              {page.paymentStatus === 'PAID'
                ? 'This payment has already been verified.'
                : page.paymentStatus === 'FAILED'
                  ? `Payment verification was unsuccessful${
                      page.submitted?.rejectionReason
                        ? `: ${page.submitted.rejectionReason}`
                        : '.'
                    }`
                  : 'Payment details have already been submitted.'}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
