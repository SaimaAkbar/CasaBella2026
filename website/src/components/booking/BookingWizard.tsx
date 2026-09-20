'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { rooms } from '@/data/rooms';
import { residences } from '@/data/residences';
import {
  checkAvailability,
  fetchPublicUnits,
  submitBooking,
} from '@/lib/api/bookings';
import { apiFetch, isMockMode } from '@/lib/api/client';
import { formatMoney } from '@/lib/booking';
import { StayDateCalendar } from '@/components/booking/StayDateCalendar';
import type { BookingQuote, GuestDetails, OnlinePaymentSelection, PublicUnit, StaySelection } from '@/types';

const emptyGuest: GuestDetails = {
  fullName: '',
  phone: '',
  alternatePhone: '',
  email: '',
  cnicOrPassport: '',
  address: '',
  nationality: 'Pakistan',
  emergencyContactName: '',
  emergencyContactPhone: '',
  vehicleNumber: '',
  notes: '',
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function BookingWizard() {
  const router = useRouter();
  const params = useSearchParams();
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [quote, setQuote] = useState<BookingQuote | null>(null);
  const [guest, setGuest] = useState<GuestDetails>(emptyGuest);
  const [liveUnits, setLiveUnits] = useState<PublicUnit[]>([]);
  const [paymentSelection, setPaymentSelection] =
    useState<OnlinePaymentSelection>('ADVANCE_50');
  const [paymentConfig, setPaymentConfig] = useState<{
    mode: string;
    acceptsRealCards: boolean;
    canStartCheckout: boolean;
    message: string;
  } | null>(null);

  const initialType = (params.get('type') === 'room' ? 'room' : 'residence') as
    | 'room'
    | 'residence';

  const [stay, setStay] = useState<StaySelection>({
    propertyType: initialType,
    propertyId: params.get('id') || '',
    propertySlug: '',
    propertyName: '',
    posPropertyId: undefined,
    checkIn: params.get('checkIn') || '',
    checkOut: params.get('checkOut') || '',
    adults: Number(params.get('adults') || 2),
    children: Number(params.get('children') || 0),
    units: 1,
  });

  useEffect(() => {
    if (isMockMode()) return;
    void apiFetch<{
      mode: string;
      acceptsRealCards: boolean;
      canStartCheckout: boolean;
      message: string;
    }>('/public/online-bookings/payment-config')
      .then(setPaymentConfig)
      .catch(() =>
        setPaymentConfig({
          mode: 'unknown',
          acceptsRealCards: false,
          canStartCheckout: false,
          message:
            'Unable to load payment configuration. Real Safepay merchant keys may be missing.',
        }),
      );
  }, []);

  useEffect(() => {
    if (isMockMode()) return;
    const unitType = stay.propertyType === 'room' ? 'ROOM' : 'APARTMENT';
    void fetchPublicUnits(unitType)
      .then((units) => {
        setLiveUnits(units);
        if (!stay.propertyId && units[0]) {
          setStay((prev) => ({
            ...prev,
            propertyId: units[0].id,
            propertyName: units[0].displayName || units[0].unitNumber,
            posPropertyId: units[0].propertyId,
          }));
        }
      })
      .catch(() => setLiveUnits([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stay.propertyType]);

  const catalog = stay.propertyType === 'room' ? rooms : residences;
  const selectedLive = useMemo(
    () => liveUnits.find((u) => u.id === stay.propertyId) || null,
    [liveUnits, stay.propertyId],
  );
  const selectedMock = useMemo(
    () => catalog.find((item) => item.id === stay.propertyId) || null,
    [catalog, stay.propertyId],
  );

  useEffect(() => {
    if (selectedLive) {
      setStay((prev) => ({
        ...prev,
        propertySlug: selectedLive.unitNumber,
        propertyName: selectedLive.displayName || selectedLive.unitNumber,
        posPropertyId: selectedLive.propertyId,
      }));
      return;
    }
    if (selectedMock) {
      setStay((prev) => ({
        ...prev,
        propertySlug: selectedMock.slug,
        propertyName: selectedMock.name,
      }));
    }
  }, [selectedLive, selectedMock]);

  async function runAvailability() {
    setError('');
    setBusy(true);
    try {
      const result = await checkAvailability(stay);
      setQuote(result);
      if (!result.available) {
        setError(result.message || 'NOT AVAILABLE FOR SELECTED DATES');
        return false;
      }
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to check availability.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function onStaySubmit(event: FormEvent) {
    event.preventDefault();
    if (!stay.propertyId) {
      setError('Select a room or residence.');
      return;
    }
    if (!stay.checkIn || !stay.checkOut) {
      setError('Select check-in and check-out dates on the calendar.');
      return;
    }
    if (stay.checkOut <= stay.checkIn) {
      setError('Check-out must be after check-in.');
      return;
    }
    const ok = await runAvailability();
    if (ok) setStep(2);
  }

  function onGuestSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (!guest.fullName.trim() || !guest.phone.trim()) {
      setError('Full name and phone are required (same as POS daily guest form).');
      return;
    }
    if (guest.email.trim() && !EMAIL_PATTERN.test(guest.email.trim())) {
      setError('Enter a valid email address.');
      return;
    }
    setStep(3);
  }

  async function onConfirm() {
    if (!quote || !paymentSelection) return;
    setBusy(true);
    setError('');
    try {
      const confirmation = await submitBooking({
        stay,
        guest,
        quote,
        paymentSelection,
      });
      sessionStorage.setItem('casaBellaBooking', JSON.stringify(confirmation));
      // Always send the customer into checkout / pending — never confirmation.
      if (confirmation.checkoutUrl) {
        window.location.href = confirmation.checkoutUrl;
        return;
      }
      router.push(
        `/booking/pending?ref=${encodeURIComponent(confirmation.reference)}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start payment.');
    } finally {
      setBusy(false);
    }
  }

  const totalAmount = Number(quote?.total ?? 0);
  const advanceAmount = Math.round(totalAmount * 50) / 100;
  const fullAmount = totalAmount;
  const selectedPayNow =
    paymentSelection === 'ADVANCE_50' ? advanceAmount : fullAmount;
  const selectedRemaining = totalAmount - selectedPayNow;

  const unitOptions = !isMockMode() && liveUnits.length > 0
    ? liveUnits.map((u) => ({
        id: u.id,
        label: `${u.displayName || u.unitNumber} · ${u.propertyName}${
          u.dailyRate != null ? ` · PKR ${u.dailyRate.toLocaleString()}/night` : ''
        }`,
      }))
    : catalog.map((item) => ({ id: item.id, label: item.name }));

  return (
    <div className="booking-wizard">
      <ol className="booking-steps" aria-label="Booking steps">
        {['Select stay', 'Guest details', 'Payment', 'Confirmation'].map((label, index) => (
          <li
            key={label}
            className={
              step === index + 1 ? 'is-active' : step > index + 1 ? 'is-done' : ''
            }
          >
            <span>{index + 1}</span>
            {label}
          </li>
        ))}
      </ol>

      {error ? <div className="alert alert--error">{error}</div> : null}

      {step === 1 ? (
        <form className="booking-panel" onSubmit={onStaySubmit}>
          <h2>Select your stay</h2>
          <div className="form-grid">
            <label className="form-field">
              <span>Type</span>
              <select
                value={stay.propertyType}
                onChange={(event) => {
                  const type = event.target.value as 'room' | 'residence';
                  setStay((prev) => ({
                    ...prev,
                    propertyType: type,
                    propertyId: '',
                  }));
                  setQuote(null);
                  setLiveUnits([]);
                }}
              >
                <option value="residence">Residence / Apartment</option>
                <option value="room">Hotel room</option>
              </select>
            </label>
            <label className="form-field">
              <span>{stay.propertyType === 'room' ? 'Room' : 'Apartment'}</span>
              <select
                required
                value={stay.propertyId}
                onChange={(event) =>
                  setStay((prev) => ({ ...prev, propertyId: event.target.value }))
                }
              >
                <option value="">Select…</option>
                {unitOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-field form-field--full">
              <span>Stay dates</span>
              <StayDateCalendar
                unitId={stay.propertyId || null}
                checkIn={stay.checkIn}
                checkOut={stay.checkOut}
                onChange={({ checkIn, checkOut }) =>
                  setStay((prev) => ({ ...prev, checkIn, checkOut }))
                }
              />
            </label>
            <label className="form-field">
              <span>Adults</span>
              <input
                type="number"
                min={1}
                max={12}
                value={stay.adults}
                onChange={(event) =>
                  setStay((prev) => ({ ...prev, adults: Number(event.target.value) }))
                }
              />
            </label>
            <label className="form-field">
              <span>Children</span>
              <input
                type="number"
                min={0}
                max={8}
                value={stay.children}
                onChange={(event) =>
                  setStay((prev) => ({
                    ...prev,
                    children: Number(event.target.value),
                  }))
                }
              />
            </label>
          </div>
          <div className="booking-panel__actions">
            <button type="submit" className="btn btn--primary" disabled={busy}>
              {busy ? 'Checking…' : 'CHECK AVAILABILITY'}
            </button>
          </div>
        </form>
      ) : null}

      {step === 2 ? (
        <form className="booking-panel" onSubmit={onGuestSubmit}>
          <h2>Guest details</h2>
          <p className="eyebrow">Same fields as Casa Bella POS daily guest form</p>

          <h3>Personal information</h3>
          <div className="form-grid">
            <label className="form-field">
              <span>Full name *</span>
              <input
                required
                value={guest.fullName}
                onChange={(e) => setGuest({ ...guest, fullName: e.target.value })}
              />
            </label>
            <label className="form-field">
              <span>Nationality</span>
              <input
                value={guest.nationality}
                onChange={(e) => setGuest({ ...guest, nationality: e.target.value })}
              />
            </label>
          </div>

          <h3>Identification information</h3>
          <div className="form-grid">
            <label className="form-field form-field--full">
              <span>CNIC / Passport</span>
              <input
                value={guest.cnicOrPassport}
                onChange={(e) =>
                  setGuest({ ...guest, cnicOrPassport: e.target.value })
                }
              />
            </label>
          </div>

          <h3>Contact information</h3>
          <div className="form-grid">
            <label className="form-field">
              <span>Mobile number *</span>
              <input
                required
                value={guest.phone}
                onChange={(e) => setGuest({ ...guest, phone: e.target.value })}
              />
            </label>
            <label className="form-field">
              <span>Alternate phone</span>
              <input
                value={guest.alternatePhone}
                onChange={(e) =>
                  setGuest({ ...guest, alternatePhone: e.target.value })
                }
              />
            </label>
            <label className="form-field">
              <span>Email</span>
              <input
                type="email"
                value={guest.email}
                onChange={(e) => setGuest({ ...guest, email: e.target.value })}
              />
            </label>
            <label className="form-field form-field--full">
              <span>Address</span>
              <input
                value={guest.address}
                onChange={(e) => setGuest({ ...guest, address: e.target.value })}
              />
            </label>
            <label className="form-field">
              <span>Emergency contact name</span>
              <input
                value={guest.emergencyContactName}
                onChange={(e) =>
                  setGuest({ ...guest, emergencyContactName: e.target.value })
                }
              />
            </label>
            <label className="form-field">
              <span>Emergency contact phone</span>
              <input
                value={guest.emergencyContactPhone}
                onChange={(e) =>
                  setGuest({ ...guest, emergencyContactPhone: e.target.value })
                }
              />
            </label>
            <label className="form-field">
              <span>Vehicle number</span>
              <input
                value={guest.vehicleNumber}
                onChange={(e) =>
                  setGuest({ ...guest, vehicleNumber: e.target.value })
                }
              />
            </label>
          </div>

          <h3>Stay information</h3>
          <div className="form-grid">
            <label className="form-field form-field--full">
              <span>Notes / special requests</span>
              <textarea
                value={guest.notes}
                onChange={(e) => setGuest({ ...guest, notes: e.target.value })}
              />
            </label>
          </div>

          <div className="booking-panel__actions">
            <button type="button" className="btn btn--ghost-dark" onClick={() => setStep(1)}>
              Back
            </button>
            <button type="submit" className="btn btn--primary">
              CONTINUE TO PAYMENT
            </button>
          </div>
        </form>
      ) : null}

      {step === 3 && quote ? (
        <div className="booking-panel">
          <h2>Booking Confirmation Policy</h2>
          {paymentConfig && !paymentConfig.acceptsRealCards ? (
            <div className="alert alert--error">
              <strong>
                {paymentConfig.mode === 'mock'
                  ? 'Test mode — no real money is collected.'
                  : 'Real card payments are not active yet.'}
              </strong>
              <br />
              {paymentConfig.message}
              <br />
              To receive money in your account: open a Safepay merchant account at{' '}
              <a href="https://getsafepay.com" target="_blank" rel="noreferrer">
                getsafepay.com
              </a>
              , put API Key + Secret Key in <code>backend/.env</code>, set{' '}
              <code>SAFE_PAY_ENVIRONMENT=sandbox</code> (then production), restart
              backend. Customers enter their card on Safepay — not your personal
              card, and not a form on this website.
            </div>
          ) : null}
          <p className="booking-secure-note">
            To confirm and secure your reservation, an advance payment is required.
            You may pay 50% of the total amount now or pay the full amount. Your
            booking will only be confirmed after successful payment. Customers pay
            on Safepay’s secure page (card details never stored by Casa Bella).
          </p>

          <p style={{ marginBottom: '1rem' }}>
            Choose Payment Option:
          </p>

          <dl className="summary-list">
            <div>
              <dt>Customer</dt>
              <dd>{guest.fullName}</dd>
            </div>
            <div>
              <dt>Apartment</dt>
              <dd>{stay.propertyName}</dd>
            </div>
            <div>
              <dt>Check-in</dt>
              <dd>{stay.checkIn}</dd>
            </div>
            <div>
              <dt>Check-out</dt>
              <dd>{stay.checkOut}</dd>
            </div>
            <div>
              <dt>Nights</dt>
              <dd>{quote.nights}</dd>
            </div>
            <div>
              <dt>Total Booking Amount</dt>
              <dd className="price">{formatMoney(totalAmount)}</dd>
            </div>
          </dl>

          <div className="payment-option-grid" role="radiogroup" aria-label="Payment option">
            <button
              type="button"
              className={`payment-option${paymentSelection === 'ADVANCE_50' ? ' is-selected' : ''}`}
              aria-pressed={paymentSelection === 'ADVANCE_50'}
              onClick={() => setPaymentSelection('ADVANCE_50')}
            >
              <span className="payment-option__eyebrow">50% Advance</span>
              <strong>{formatMoney(advanceAmount)}</strong>
              <p>Pay Now: {formatMoney(advanceAmount)}</p>
              <p>Remaining Balance: {formatMoney(totalAmount - advanceAmount)}</p>
            </button>
            <button
              type="button"
              className={`payment-option${paymentSelection === 'FULL_100' ? ' is-selected' : ''}`}
              aria-pressed={paymentSelection === 'FULL_100'}
              onClick={() => setPaymentSelection('FULL_100')}
            >
              <span className="payment-option__eyebrow">Pay Full Amount</span>
              <strong>{formatMoney(fullAmount)}</strong>
              <p>Pay Now: {formatMoney(fullAmount)}</p>
              <p>Remaining Balance: {formatMoney(0)}</p>
            </button>
          </div>

          <dl className="summary-list">
            <div>
              <dt>Pay today</dt>
              <dd className="price">{formatMoney(selectedPayNow)}</dd>
            </div>
            <div>
              <dt>Remaining balance</dt>
              <dd>{formatMoney(selectedRemaining)}</dd>
            </div>
            <div>
              <dt>After verified payment</dt>
              <dd>
                Confirmed ·{' '}
                {paymentSelection === 'ADVANCE_50' ? 'Partially Paid' : 'Fully Paid'}
              </dd>
            </div>
          </dl>

          {quote.message ? <div className="alert alert--warn">{quote.message}</div> : null}
          <div className="booking-panel__actions">
            <button type="button" className="btn btn--ghost-dark" onClick={() => setStep(2)}>
              Back
            </button>
            <button
              type="button"
              className="btn btn--gold"
              disabled={
                busy ||
                !quote.available ||
                Boolean(paymentConfig && !paymentConfig.canStartCheckout)
              }
              onClick={() => void onConfirm()}
            >
              {busy
                ? 'Preparing secure checkout…'
                : paymentConfig && !paymentConfig.canStartCheckout
                  ? 'PAYMENT GATEWAY NOT CONFIGURED'
                  : 'PROCEED TO SECURE PAYMENT'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
