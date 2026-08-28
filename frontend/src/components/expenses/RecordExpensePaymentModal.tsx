import { useEffect, useState, type FormEvent } from 'react';
import { recordExpensePayment } from '../../api/expenses';
import { recordElectricityPayment } from '../../api/electricity-readings';
import type { PaymentMethod } from '../../types/expense';
import { formatPkr } from '../../lib/format';
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

type Props = {
  open: boolean;
  token: string;
  mode: 'expense' | 'electricity';
  targetId: string;
  label: string;
  finalBill: string;
  alreadyPaid: string;
  remaining: string;
  onClose: () => void;
  onSaved: () => void;
  onError: (message: string) => void;
};

export function RecordExpensePaymentModal({
  open,
  token,
  mode,
  targetId,
  label,
  finalBill,
  alreadyPaid,
  remaining,
  onClose,
  onSaved,
  onError,
}: Props) {
  const [amountPaid, setAmountPaid] = useState(remaining);
  const [paymentDate, setPaymentDate] = useState(todayDate());
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [bankName, setBankName] = useState('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAmountPaid(remaining);
    setPaymentDate(todayDate());
    setPaymentMethod('CASH');
    setBankName('');
    setReference('');
    setNotes('');
  }, [open, remaining]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const payload = {
        amountPaid: Number(amountPaid),
        paymentDate,
        paymentMethod,
        bankName: bankName.trim() || undefined,
        transactionReference: reference.trim() || undefined,
        notes: notes.trim() || undefined,
      };
      if (mode === 'electricity') {
        await recordElectricityPayment(token, targetId, payload);
      } else {
        await recordExpensePayment(token, targetId, payload);
      }
      onSaved();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Unable to record payment.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormModal open={open} title="Record Payment" onClose={onClose}>
      <form className="form-grid" onSubmit={handleSubmit}>
        <p className="form-hint">
          <strong>{label}</strong>
          <br />
          Final bill {formatPkr(finalBill)} · Paid {formatPkr(alreadyPaid)} ·
          Remaining {formatPkr(remaining)}
        </p>
        <label className="form-field">
          <span>Amount Paid</span>
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={amountPaid}
            onChange={(e) => setAmountPaid(e.target.value)}
            required
          />
        </label>
        <label className="form-field">
          <span>Payment Date</span>
          <input
            type="date"
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
            required
          />
        </label>
        <label className="form-field">
          <span>Payment Method</span>
          <select
            value={paymentMethod}
            onChange={(e) =>
              setPaymentMethod(e.target.value as PaymentMethod)
            }
          >
            {METHODS.map((m) => (
              <option key={m} value={m}>
                {m.replaceAll('_', ' ')}
              </option>
            ))}
          </select>
        </label>
        <label className="form-field">
          <span>Bank (optional)</span>
          <input
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
          />
        </label>
        <label className="form-field">
          <span>Reference (optional)</span>
          <input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          />
        </label>
        <label className="form-field">
          <span>Notes</span>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
        <div className="form-actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save Payment'}
          </button>
        </div>
      </form>
    </FormModal>
  );
}
