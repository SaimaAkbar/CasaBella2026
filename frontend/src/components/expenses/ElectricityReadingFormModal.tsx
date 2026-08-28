import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  createElectricityReading,
  fetchElectricityRate,
  fetchElectricityReadings,
} from '../../api/electricity-readings';
import { fetchProperties } from '../../api/properties';
import { fetchUnits } from '../../api/units';
import { formatPkr } from '../../lib/format';
import type { Property } from '../../types/property';
import type { Unit } from '../../types/unit';
import { FormModal } from '../ui/FormModal';
import '../../styles/forms.css';

type ElectricityReadingFormModalProps = {
  open: boolean;
  token: string;
  isSuperAdmin: boolean;
  preset?: {
    propertyId?: string;
    unitId?: string;
    billingMonth?: number;
    billingYear?: number;
    lockSelection?: boolean;
  };
  onClose: () => void;
  onSaved: () => void;
  onError: (message: string) => void;
};

function todayDate() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function ElectricityReadingFormModal({
  open,
  token,
  isSuperAdmin,
  preset,
  onClose,
  onSaved,
  onError,
}: ElectricityReadingFormModalProps) {
  const now = new Date();
  const [propertyId, setPropertyId] = useState('');
  const [unitId, setUnitId] = useState('');
  const [previousUnits, setPreviousUnits] = useState('');
  const [currentUnits, setCurrentUnits] = useState('');
  const [ratePerUnit, setRatePerUnit] = useState('95');
  const [billingMonth, setBillingMonth] = useState(String(now.getMonth() + 1));
  const [billingYear, setBillingYear] = useState(String(now.getFullYear()));
  const [readingDate, setReadingDate] = useState(todayDate());
  const [notes, setNotes] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [properties, setProperties] = useState<Property[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);

  const preview = useMemo(() => {
    const prev = Number(previousUnits);
    const curr = Number(currentUnits);
    const rate = Number(ratePerUnit);
    if (
      Number.isNaN(prev) ||
      Number.isNaN(curr) ||
      Number.isNaN(rate) ||
      curr < prev
    ) {
      return { consumed: 0, amount: 0, invalid: curr < prev && currentUnits !== '' };
    }
    const consumed = curr - prev;
    return { consumed, amount: consumed * rate, invalid: false };
  }, [previousUnits, currentUnits, ratePerUnit]);

  useEffect(() => {
    if (!open || !token) return;
    setPropertyId(preset?.propertyId ?? '');
    setUnitId(preset?.unitId ?? '');
    setPreviousUnits('');
    setCurrentUnits('');
    setBillingMonth(
      String(preset?.billingMonth ?? new Date().getMonth() + 1),
    );
    setBillingYear(String(preset?.billingYear ?? new Date().getFullYear()));
    setReadingDate(todayDate());
    setNotes('');
    setOverrideReason('');

    void fetchProperties(token)
      .then(setProperties)
      .catch(() => setProperties([]));

    void fetchElectricityRate(token)
      .then((rate) => setRatePerUnit(rate.ratePerUnit))
      .catch(() => setRatePerUnit('95'));
  }, [
    open,
    token,
    preset?.propertyId,
    preset?.unitId,
    preset?.billingMonth,
    preset?.billingYear,
  ]);

  useEffect(() => {
    if (!open || !token || !propertyId) {
      setUnits([]);
      return;
    }
    void fetchUnits(token, { propertyId, isActive: true })
      .then(setUnits)
      .catch(() => setUnits([]));
  }, [open, token, propertyId]);

  useEffect(() => {
    if (!open || !token || !unitId || !billingMonth || !billingYear) return;
    const month = Number(billingMonth);
    const year = Number(billingYear);
    const previousMonth = month === 1 ? 12 : month - 1;
    const previousYear = month === 1 ? year - 1 : year;
    void fetchElectricityReadings(token, {
      unitId,
      billingMonth: previousMonth,
      billingYear: previousYear,
    })
      .then((rows) => {
        const last = rows[0]?.currentUnits ?? rows[0]?.currentReading;
        if (last != null && last !== '') {
          setPreviousUnits(String(last));
        }
      })
      .catch(() => undefined);
  }, [open, token, unitId, billingMonth, billingYear]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;

    const prev = Number(previousUnits);
    const curr = Number(currentUnits);
    const rate = Number(ratePerUnit);

    if (!propertyId || !unitId) {
      onError('Property and unit are required.');
      return;
    }
    if (Number.isNaN(prev) || Number.isNaN(curr) || curr < prev) {
      onError('Current units cannot be lower than previous units.');
      return;
    }

    setSaving(true);
    try {
      await createElectricityReading(token, {
        propertyId,
        unitId,
        previousUnits: prev,
        currentUnits: curr,
        ratePerUnit: rate,
        billingMonth: Number(billingMonth),
        billingYear: Number(billingYear),
        readingDate,
        notes: notes.trim() || undefined,
        overrideReason: overrideReason.trim() || undefined,
      });
      onSaved();
    } catch (err) {
      onError(
        err instanceof Error
          ? err.message
          : 'Unable to save electricity reading.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormModal open={open} title="Add Electricity Reading" onClose={onClose}>
      <form className="form-grid" onSubmit={handleSubmit}>
        <div className="form-grid form-grid--2">
          <label className="form-field">
            <span>Property</span>
            <select
              value={propertyId}
              onChange={(e) => {
                setPropertyId(e.target.value);
                setUnitId('');
              }}
              required
              disabled={preset?.lockSelection}
            >
              <option value="">Select property</option>
              {properties.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.name}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>Unit</span>
            <select
              value={unitId}
              onChange={(e) => setUnitId(e.target.value)}
              required
              disabled={preset?.lockSelection}
            >
              <option value="">Select unit</option>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.unitNumber}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="form-grid form-grid--2">
          <label className="form-field">
            <span>Previous Units</span>
            <input
              type="number"
              min="0"
              step="0.001"
              value={previousUnits}
              onChange={(e) => setPreviousUnits(e.target.value)}
              required
            />
          </label>
          <label className="form-field">
            <span>Current Units</span>
            <input
              type="number"
              min="0"
              step="0.001"
              value={currentUnits}
              onChange={(e) => setCurrentUnits(e.target.value)}
              required
            />
          </label>
        </div>

        <div className="form-grid form-grid--2">
          <label className="form-field">
            <span>Rate Per Unit (PKR)</span>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={ratePerUnit}
              onChange={(e) => setRatePerUnit(e.target.value)}
              required
            />
          </label>
          <label className="form-field">
            <span>Reading Date</span>
            <input
              type="date"
              value={readingDate}
              onChange={(e) => setReadingDate(e.target.value)}
              required
            />
          </label>
        </div>

        <div className="form-grid form-grid--2">
          <label className="form-field">
            <span>Billing Month</span>
            <input
              type="number"
              min="1"
              max="12"
              value={billingMonth}
              onChange={(e) => setBillingMonth(e.target.value)}
              required
              disabled={preset?.lockSelection}
            />
          </label>
          <label className="form-field">
            <span>Billing Year</span>
            <input
              type="number"
              min="2000"
              max="2100"
              value={billingYear}
              onChange={(e) => setBillingYear(e.target.value)}
              required
              disabled={preset?.lockSelection}
            />
          </label>
        </div>

        <div className="form-hint">
          Consumed Units: <strong>{preview.consumed.toFixed(3)}</strong>
          <br />
          Calculated Amount: <strong>{formatPkr(preview.amount)}</strong>
          {preview.invalid && (
            <>
              <br />
              <span className="form-field__error">
                Current units cannot be lower than previous units.
              </span>
            </>
          )}
        </div>

        <label className="form-field">
          <span>Notes</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>

        {isSuperAdmin && (
          <label className="form-field">
            <span>Override Reason (duplicate month/year)</span>
            <input
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              placeholder="Required only when replacing an existing reading"
            />
          </label>
        )}

        <div className="form-actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn--primary"
            disabled={saving || preview.invalid}
          >
            {saving ? 'Saving…' : 'Save Reading'}
          </button>
        </div>
      </form>
    </FormModal>
  );
}
