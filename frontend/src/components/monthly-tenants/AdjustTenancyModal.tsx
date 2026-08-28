import { useEffect, useState, type FormEvent } from 'react';
import { createPaymentAdjustment } from '../../api/payments';
import type { MonthlyTenancy } from '../../types/monthly-tenancy';
import { FormModal } from '../ui/FormModal';
import '../../styles/forms.css';

type Props = {
  open: boolean;
  token: string;
  tenancy: MonthlyTenancy | null;
  onClose: () => void;
  onSaved: () => void;
  onError: (message: string) => void;
};

function todayDate() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function AdjustTenancyModal({
  open,
  token,
  tenancy,
  onClose,
  onSaved,
  onError,
}: Props) {
  const [amount, setAmount] = useState('');
  const [direction, setDirection] = useState<'CREDIT' | 'DEBIT'>('CREDIT');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAmount('');
    setDirection('CREDIT');
    setReason('');
  }, [open, tenancy?.id]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!tenancy) return;
    const value = Number(amount);
    if (!value || value <= 0) {
      onError('Amount must be greater than zero.');
      return;
    }
    if (reason.trim().length < 3) {
      onError('A reason is required.');
      return;
    }
    setSaving(true);
    try {
      await createPaymentAdjustment(token, {
        paymentForType: 'MONTHLY_TENANCY',
        monthlyTenancyId: tenancy.id,
        amount: value,
        adjustmentDirection: direction,
        reason: reason.trim(),
        paymentDate: new Date(`${todayDate()}T12:00:00`).toISOString(),
      });
      onSaved();
      onClose();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Unable to adjust balance.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormModal open={open} title="Adjust / Waive" onClose={() => !saving && onClose()}>
      <form className="form-grid" onSubmit={handleSubmit}>
        <p className="form-hint">
          Uses the existing payment adjustment API. CREDIT reduces what is owed
          (waive). History is preserved.
        </p>
        <label className="form-field">
          <span>Amount</span>
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            required
          />
        </label>
        <label className="form-field">
          <span>Direction</span>
          <select
            value={direction}
            onChange={(event) =>
              setDirection(event.target.value as 'CREDIT' | 'DEBIT')
            }
          >
            <option value="CREDIT">Credit / Waive</option>
            <option value="DEBIT">Debit / Add due</option>
          </select>
        </label>
        <label className="form-field">
          <span>Reason</span>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            required
          />
        </label>
        <div className="form-actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save Adjustment'}
          </button>
        </div>
      </form>
    </FormModal>
  );
}
