import { useEffect, useState, type FormEvent } from 'react';
import { createPayment } from '../../api/payments';
import { recordElectricityPayment } from '../../api/electricity-readings';
import { formatPkr } from '../../lib/format';
import type { MonthlyTenancy } from '../../types/monthly-tenancy';
import type { PaymentMethod } from '../../types/payment';
import type { ReceiptPrintTarget } from '../../types/receipt';
import { PrintReceiptActions } from '../receipts/PrintReceiptActions';
import { FormModal } from '../ui/FormModal';
import '../../styles/forms.css';

const METHODS: PaymentMethod[] = [
  'CASH',
  'BANK_TRANSFER',
  'CARD',
  'EASYPAISA',
  'JAZZCASH',
  'OTHER',
];

function todayDate() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

type ApplyTo = 'RENT' | 'ELECTRICITY' | 'BOTH';

type Props = {
  open: boolean;
  token: string;
  tenancy: MonthlyTenancy | null;
  periodLabel: string;
  rentOutstanding: number;
  electricityOutstanding: number;
  electricityReadingId?: string;
  lockApply?: ApplyTo;
  onClose: () => void;
  onSaved: () => void;
  onError: (message: string) => void;
};

export function ReceiveTenantPaymentModal({
  open,
  token,
  tenancy,
  periodLabel,
  rentOutstanding,
  electricityOutstanding,
  electricityReadingId,
  lockApply,
  onClose,
  onSaved,
  onError,
}: Props) {
  const canPayElectricity =
    Boolean(electricityReadingId) && electricityOutstanding > 0;
  const defaultApply: ApplyTo =
    lockApply ??
    (rentOutstanding > 0 && canPayElectricity
      ? 'BOTH'
      : canPayElectricity && rentOutstanding <= 0
        ? 'ELECTRICITY'
        : 'RENT');

  const [applyTo, setApplyTo] = useState<ApplyTo>(defaultApply);
  const [amount, setAmount] = useState('');
  const [rentAlloc, setRentAlloc] = useState('');
  const [elecAlloc, setElecAlloc] = useState('');
  const [paymentDate, setPaymentDate] = useState(todayDate());
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [printTargets, setPrintTargets] = useState<ReceiptPrintTarget[]>([]);

  useEffect(() => {
    if (!open) return;
    setSaved(false);
    setPrintTargets([]);
    setApplyTo(defaultApply);
    setAmount(
      String(
        (lockApply === 'ELECTRICITY'
          ? electricityOutstanding
          : lockApply === 'RENT'
            ? rentOutstanding
            : rentOutstanding + (canPayElectricity ? electricityOutstanding : 0)) ||
          '',
      ),
    );
    setRentAlloc(String(rentOutstanding));
    setElecAlloc(String(canPayElectricity ? electricityOutstanding : 0));
    setPaymentDate(todayDate());
    setPaymentMethod('CASH');
    setReference('');
    setNotes('');
  }, [
    open,
    tenancy?.id,
    defaultApply,
    rentOutstanding,
    electricityOutstanding,
    canPayElectricity,
    lockApply,
  ]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!tenancy || saving) return;
    const payment = Number(amount);
    if (!payment || payment <= 0) {
      onError('Payment amount must be greater than zero.');
      return;
    }

    let rentAmount = 0;
    let electricityAmount = 0;
    if (applyTo === 'RENT') rentAmount = payment;
    else if (applyTo === 'ELECTRICITY') electricityAmount = payment;
    else {
      rentAmount = Number(rentAlloc) || 0;
      electricityAmount = Number(elecAlloc) || 0;
      if (
        Number((rentAmount + electricityAmount).toFixed(2)) !==
        Number(payment.toFixed(2))
      ) {
        onError('Rent and electricity allocation must equal the payment amount.');
        return;
      }
    }

    if (electricityAmount > 0 && !electricityReadingId) {
      onError('No electricity bill is linked for this room yet.');
      return;
    }

    setSaving(true);
    try {
      const targets: ReceiptPrintTarget[] = [];
      if (rentAmount > 0) {
        const payment = await createPayment(token, {
          paymentForType: 'MONTHLY_TENANCY',
          monthlyTenancyId: tenancy.id,
          amount: rentAmount,
          paymentMethod,
          paymentDate: new Date(`${paymentDate}T12:00:00`).toISOString(),
          transactionReference: reference.trim() || undefined,
          notes: notes.trim() || undefined,
        });
        targets.push({
          sourceType: 'payment',
          sourceId: payment.id,
          billingMonth: periodLabel,
        });
      }
      if (electricityAmount > 0 && electricityReadingId) {
        const reading = await recordElectricityPayment(token, electricityReadingId, {
          amountPaid: electricityAmount,
          paymentDate: new Date(`${paymentDate}T12:00:00`).toISOString(),
          paymentMethod,
          transactionReference: reference.trim() || undefined,
          notes: notes.trim() || undefined,
        });
        if (reading.expensePaymentId) {
          targets.push({
            sourceType: 'expense_payment',
            sourceId: reading.expensePaymentId,
          });
        }
      }
      setPrintTargets(targets);
      setSaved(true);
      onSaved();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Unable to record payment.');
    } finally {
      setSaving(false);
    }
  }

  const totalDue = rentOutstanding + (canPayElectricity ? electricityOutstanding : 0);

  return (
    <FormModal
      open={open}
      title={saved ? 'Payment Recorded' : 'Receive Payment'}
      onClose={() => !saving && onClose()}
    >
      {saved ? (
        <>
          <p className="form-hint">
            Payment saved successfully. Print bill below — half payment and
            remaining pending are shown on the slip.
          </p>
          {printTargets.map((target) => (
            <PrintReceiptActions
              key={`${target.sourceType}-${target.sourceId}`}
              token={token}
              target={target}
              onError={onError}
            />
          ))}
          <div className="form-actions">
            <button type="button" className="btn btn--primary" onClick={onClose}>
              Done
            </button>
          </div>
        </>
      ) : (
      <form className="form-grid" onSubmit={handleSubmit}>
        <p className="form-hint">
          Tenant: <strong>{tenancy?.tenant?.fullName ?? '—'}</strong>
          <br />
          Room: <strong>{tenancy?.unit?.unitNumber ?? '—'}</strong>
          <br />
          Month: <strong>{periodLabel}</strong>
        </p>
        <p className="form-hint">
          Rent outstanding: {formatPkr(rentOutstanding)}
          <br />
          Electricity outstanding:{' '}
          {formatPkr(canPayElectricity ? electricityOutstanding : 0)}
          <br />
          <strong>Total outstanding: {formatPkr(totalDue)}</strong>
        </p>
        <label className="form-field">
          <span>Payment Amount</span>
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            required
          />
        </label>
        <fieldset className="form-field">
          <legend>Apply Payment To</legend>
          <label>
            <input
              type="radio"
              name="applyTo"
              checked={applyTo === 'RENT'}
              onChange={() => setApplyTo('RENT')}
              disabled={lockApply === 'ELECTRICITY'}
            />{' '}
            Rent
          </label>
          <label>
            <input
              type="radio"
              name="applyTo"
              checked={applyTo === 'ELECTRICITY'}
              onChange={() => setApplyTo('ELECTRICITY')}
              disabled={!canPayElectricity || lockApply === 'RENT'}
            />{' '}
            Electricity
          </label>
          <label>
            <input
              type="radio"
              name="applyTo"
              checked={applyTo === 'BOTH'}
              onChange={() => setApplyTo('BOTH')}
              disabled={!canPayElectricity || Boolean(lockApply)}
            />{' '}
            Both / Allocate
          </label>
        </fieldset>
        {applyTo === 'BOTH' ? (
          <div className="form-grid form-grid--2">
            <label className="form-field">
              <span>Allocate to Rent</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={rentAlloc}
                onChange={(event) => setRentAlloc(event.target.value)}
              />
            </label>
            <label className="form-field">
              <span>Allocate to Electricity</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={elecAlloc}
                onChange={(event) => setElecAlloc(event.target.value)}
              />
            </label>
          </div>
        ) : null}
        <label className="form-field">
          <span>Payment Method</span>
          <select
            value={paymentMethod}
            onChange={(event) =>
              setPaymentMethod(event.target.value as PaymentMethod)
            }
          >
            {METHODS.map((method) => (
              <option key={method} value={method}>
                {method.replaceAll('_', ' ')}
              </option>
            ))}
          </select>
        </label>
        <label className="form-field">
          <span>Reference</span>
          <input
            value={reference}
            onChange={(event) => setReference(event.target.value)}
          />
        </label>
        <label className="form-field">
          <span>Notes</span>
          <textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
        </label>
        <div className="form-actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving ? 'Saving…' : 'Receive Payment'}
          </button>
        </div>
      </form>
      )}
    </FormModal>
  );
}
