import { useEffect, useState, type FormEvent } from 'react';
import { createPayment } from '../../api/payments';
import { PrintReceiptActions } from '../receipts/PrintReceiptActions';
import type { CreatePaymentInput, PaymentMethod } from '../../types/payment';
import type { ReceiptPrintTarget } from '../../types/receipt';
import { FormModal } from '../ui/FormModal';
import '../../styles/forms.css';

export type PaymentFormPreset = {
  paymentForType: 'BOOKING' | 'MONTHLY_TENANCY';
  bookingId?: string;
  monthlyTenancyId?: string;
};

type Props = {
  open: boolean;
  token: string;
  isSuperAdmin: boolean;
  preset?: PaymentFormPreset;
  billingMonth?: string;
  onClose: () => void;
  onSaved: () => void;
  onError: (message: string) => void;
};

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

export function PaymentFormModal({
  open,
  token,
  preset,
  billingMonth,
  onClose,
  onSaved,
  onError,
}: Props) {
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [paymentDate, setPaymentDate] = useState(todayDate());
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [printTarget, setPrintTarget] = useState<ReceiptPrintTarget | null>(
    null,
  );
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAmount('');
    setPaymentMethod('CASH');
    setPaymentDate(todayDate());
    setReference('');
    setNotes('');
    setPrintTarget(null);
    setSaved(false);
  }, [open, preset]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const value = Number(amount);
    if (!value || value <= 0) {
      onError('Payment amount must be greater than zero.');
      return;
    }
    const payload: CreatePaymentInput = {
      paymentForType: preset?.paymentForType ?? 'MONTHLY_TENANCY',
      amount: value,
      paymentMethod,
      paymentDate: new Date(`${paymentDate}T12:00:00`).toISOString(),
      transactionReference: reference.trim() || undefined,
      notes: notes.trim() || undefined,
      bookingId: preset?.bookingId,
      monthlyTenancyId: preset?.monthlyTenancyId,
    };
    setSaving(true);
    try {
      const payment = await createPayment(token, payload);
      setSaved(true);
      setPrintTarget({
        sourceType: 'payment',
        sourceId: payment.id,
        billingMonth,
      });
      onSaved();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Unable to record payment.');
    } finally {
      setSaving(false);
    }
  }

  function handleClose() {
    if (saving) return;
    onClose();
  }

  return (
    <FormModal
      open={open}
      title={saved ? 'Payment Recorded' : 'Record Payment'}
      onClose={handleClose}
    >
      {saved ? (
        <>
          <p className="form-hint">
            Payment saved successfully. Print the bill now — works for half
            payment and remaining pending. You can reprint later from the list.
          </p>
          <PrintReceiptActions
            token={token}
            target={printTarget}
            onError={onError}
          />
          <div className="form-actions">
            <button type="button" className="btn btn--primary" onClick={handleClose}>
              Done
            </button>
          </div>
        </>
      ) : (
        <form className="form-grid" onSubmit={handleSubmit}>
          <label className="form-field">
            <span>Amount</span>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              required
              autoFocus
            />
          </label>
          <label className="form-field">
            <span>Method</span>
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
            <span>Date</span>
            <input
              type="date"
              value={paymentDate}
              onChange={(event) => setPaymentDate(event.target.value)}
              required
            />
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
            <button type="button" className="btn btn--ghost" onClick={handleClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save Payment'}
            </button>
          </div>
        </form>
      )}
    </FormModal>
  );
}
