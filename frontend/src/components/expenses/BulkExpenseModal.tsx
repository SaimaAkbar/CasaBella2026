import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { bulkCreateExpenses } from '../../api/expenses';
import { fetchUnits } from '../../api/units';
import type { ExpenseCategory, PaymentMethod } from '../../types/expense';
import type { Property } from '../../types/property';
import type { Unit } from '../../types/unit';
import { FormModal } from '../ui/FormModal';
import '../../styles/forms.css';

type Props = {
  open: boolean;
  token: string;
  categories: ExpenseCategory[];
  defaultCategoryName: string;
  properties: Property[];
  month: number;
  year: number;
  onClose: () => void;
  onSaved: () => void;
  onError: (message: string) => void;
};

export function BulkExpenseModal({
  open,
  token,
  categories,
  defaultCategoryName,
  properties,
  month,
  year,
  onClose,
  onSaved,
  onError,
}: Props) {
  const defaultCategory = categories.find((c) => c.name === defaultCategoryName);
  const [categoryId, setCategoryId] = useState(defaultCategory?.id ?? '');
  const [propertyId, setPropertyId] = useState('');
  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([]);
  const [amount, setAmount] = useState('');
  const [splitTotal, setSplitTotal] = useState(false);
  const [dueDate, setDueDate] = useState('');
  const [description, setDescription] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCategoryId(defaultCategory?.id ?? '');
    setPropertyId('');
    setUnits([]);
    setSelectedUnitIds([]);
    setAmount('');
    setSplitTotal(false);
    setDueDate('');
    setDescription('');
    setVendorName('');
    setNotes('');
  }, [open, defaultCategory?.id]);

  useEffect(() => {
    if (!open || !token || !propertyId) {
      setUnits([]);
      setSelectedUnitIds([]);
      return;
    }
    void fetchUnits(token, { propertyId, isActive: true })
      .then((rows) => {
        setUnits(rows);
        setSelectedUnitIds(rows.map((u) => u.id));
      })
      .catch(() => {
        setUnits([]);
        setSelectedUnitIds([]);
      });
  }, [open, token, propertyId]);

  const previewPerUnit = useMemo(() => {
    const n = Number(amount);
    if (!selectedUnitIds.length || !n) return 0;
    return splitTotal ? n / selectedUnitIds.length : n;
  }, [amount, selectedUnitIds.length, splitTotal]);

  function toggleUnit(id: string) {
    setSelectedUnitIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    if (!selectedUnitIds.length) {
      onError('Select at least one unit.');
      return;
    }
    setSaving(true);
    try {
      await bulkCreateExpenses(token, {
        categoryId,
        propertyId,
        unitIds: selectedUnitIds,
        amount: Number(amount),
        splitTotal,
        billingMonth: month,
        billingYear: year,
        dueDate: dueDate || undefined,
        description: description.trim() || undefined,
        vendorName: vendorName.trim() || undefined,
        notes: notes.trim() || undefined,
        paymentMethod: 'CASH' as PaymentMethod,
      });
      onSaved();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Unable to create expenses.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormModal open={open} title="Apply to Multiple Units" onClose={onClose}>
      <form className="form-grid" onSubmit={handleSubmit}>
      <label className="form-field">
        <span>Expense Type</span>
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          required
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className="form-field">
        <span>Property</span>
        <select
          value={propertyId}
          onChange={(e) => setPropertyId(e.target.value)}
          required
        >
          <option value="">Select property</option>
          {properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <div className="form-hint">
        <div className="expenses-bulk-units__actions">
          <button
            type="button"
            className="btn btn--ghost"
            disabled={!units.length}
            onClick={() => setSelectedUnitIds(units.map((u) => u.id))}
          >
            All Units
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            disabled={!units.length}
            onClick={() => setSelectedUnitIds([])}
          >
            Clear
          </button>
        </div>
        <div className="expenses-bulk-units">
          {units.map((unit) => (
            <label key={unit.id} className="expenses-bulk-units__item">
              <input
                type="checkbox"
                checked={selectedUnitIds.includes(unit.id)}
                onChange={() => toggleUnit(unit.id)}
              />
              {unit.unitNumber}
            </label>
          ))}
          {!propertyId ? <span>Select a property to load units.</span> : null}
          {propertyId && !units.length ? <span>No active units.</span> : null}
        </div>
      </div>
      <label className="form-field">
        <span>Amount</span>
        <input
          type="number"
          min="0.01"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
      </label>
      <label className="form-field">
        <span>Amount mode</span>
        <select
          value={splitTotal ? 'split' : 'each'}
          onChange={(e) => setSplitTotal(e.target.value === 'split')}
        >
          <option value="each">Same amount per unit</option>
          <option value="split">Total amount split equally</option>
        </select>
      </label>
      <p className="form-hint">
        ~{previewPerUnit.toFixed(2)} per selected unit ({selectedUnitIds.length}{' '}
        units)
      </p>
      <label className="form-field">
        <span>Due Date</span>
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />
      </label>
      <label className="form-field">
        <span>Vendor</span>
        <input
          value={vendorName}
          onChange={(e) => setVendorName(e.target.value)}
        />
      </label>
      <label className="form-field">
        <span>Description</span>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
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
          {saving ? 'Saving…' : 'Create Expenses'}
        </button>
      </div>
      </form>
    </FormModal>
  );
}
