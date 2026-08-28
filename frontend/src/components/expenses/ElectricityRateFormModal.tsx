import { useEffect, useState, type FormEvent } from 'react';
import {
  fetchElectricityRate,
  updateElectricityRate,
} from '../../api/electricity-readings';
import { formatPkr } from '../../lib/format';
import { FormModal } from '../ui/FormModal';
import '../../styles/forms.css';

type ElectricityRateFormModalProps = {
  open: boolean;
  token: string;
  onClose: () => void;
  onSaved: (rate: string) => void;
  onError: (message: string) => void;
};

export function ElectricityRateFormModal({
  open,
  token,
  onClose,
  onSaved,
  onError,
}: ElectricityRateFormModalProps) {
  const [ratePerUnit, setRatePerUnit] = useState('95');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !token) return;
    setLoading(true);
    setReason('');
    void fetchElectricityRate(token)
      .then((rate) => setRatePerUnit(rate.ratePerUnit))
      .catch(() => setRatePerUnit('95'))
      .finally(() => setLoading(false));
  }, [open, token]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;

    const value = Number(ratePerUnit);
    if (!value || value <= 0) {
      onError('Rate per unit must be greater than zero.');
      return;
    }

    setSaving(true);
    try {
      const result = await updateElectricityRate(
        token,
        value,
        reason.trim() || undefined,
      );
      if (
        result &&
        typeof result === 'object' &&
        'ratePerUnit' in result &&
        result.ratePerUnit
      ) {
        onSaved(String(result.ratePerUnit));
      } else {
        onSaved(String(value));
      }
    } catch (err) {
      onError(
        err instanceof Error
          ? err.message
          : 'Unable to update electricity rate.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormModal open={open} title="Electricity Rate" onClose={onClose}>
      <form className="form-grid" onSubmit={handleSubmit}>
        <p className="form-hint">
          Default rate used when creating electricity readings. Current preview:{' '}
          <strong>{formatPkr(ratePerUnit)}</strong> per unit.
        </p>
        <label className="form-field">
          <span>Rate Per Unit (PKR)</span>
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={ratePerUnit}
            onChange={(e) => setRatePerUnit(e.target.value)}
            disabled={loading || saving}
            required
          />
        </label>
        <label className="form-field">
          <span>Reason (optional)</span>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={loading || saving}
            placeholder="Why is the rate changing?"
          />
        </label>
        <div className="form-actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn--primary"
            disabled={loading || saving}
          >
            {saving ? 'Saving…' : 'Save Rate'}
          </button>
        </div>
      </form>
    </FormModal>
  );
}
