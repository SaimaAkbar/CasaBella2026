import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { createExpense } from '../../api/expenses';
import { fetchProperties } from '../../api/properties';
import { fetchUnits } from '../../api/units';
import { formatPkr } from '../../lib/format';
import type {
  CreateExpenseInput,
  ExpenseCategory,
  ExpenseScope,
  PaymentMethod,
} from '../../types/expense';
import type { Property } from '../../types/property';
import type { Unit } from '../../types/unit';
import { FormModal } from '../ui/FormModal';
import '../../styles/forms.css';

type OtherScope = Extract<ExpenseScope, 'GENERAL' | 'PROPERTY' | 'UNIT'>;

type Props = {
  open: boolean;
  token: string;
  categories: ExpenseCategory[];
  billingMonth?: number;
  billingYear?: number;
  preferredPropertyId?: string;
  preferredUnitId?: string;
  preferredScope?: OtherScope;
  onClose: () => void;
  onSaved: () => void;
  onError: (message: string) => void;
  onCategoriesChanged?: () => void;
};

/** Suggested names for Other Expense free-type datalist */
const EXPENSE_NAME_EXAMPLES = [
  'Water Tank Cleaning',
  'Water Tank Repair',
  'Generator Fuel',
  'Pest Control',
  'Plumbing',
  'AC Repair',
  'Furniture Repair',
  'Security Expense',
  'Paint Work',
  'Kitchen Repair',
  'Miscellaneous',
  'Office Stationery',
];

const METHODS: PaymentMethod[] = [
  'CASH',
  'BANK_TRANSFER',
  'CARD',
  'EASYPAISA',
  'JAZZCASH',
  'OTHER',
];

const SCOPE_OPTIONS: Array<{ value: OtherScope; label: string }> = [
  { value: 'GENERAL', label: 'General' },
  { value: 'PROPERTY', label: 'Whole Property' },
  { value: 'UNIT', label: 'Specific Apartment / Room' },
];

function todayDate() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function deriveStatus(amount: number, paid: number, dueDate: string) {
  if (amount > 0 && paid >= amount) return 'PAID';
  if (dueDate && paid < amount) {
    const due = new Date(`${dueDate}T23:59:59`);
    if (due < new Date() && amount - paid > 0) return 'OVERDUE';
  }
  if (paid <= 0) return 'UNPAID';
  return 'PARTIAL';
}

export function OtherExpenseFormModal({
  open,
  token,
  categories,
  billingMonth: preferredBillingMonth,
  billingYear: preferredBillingYear,
  preferredPropertyId,
  preferredUnitId,
  preferredScope,
  onClose,
  onSaved,
  onError,
  onCategoriesChanged,
}: Props) {
  const [expenseName, setExpenseName] = useState('');
  const [saveExpenseName, setSaveExpenseName] = useState(false);
  const [expenseScope, setExpenseScope] = useState<OtherScope>('GENERAL');
  const [propertyId, setPropertyId] = useState('');
  const [unitId, setUnitId] = useState('');
  const [amount, setAmount] = useState('');
  const [paidAmount, setPaidAmount] = useState('0');
  const [billingMonth, setBillingMonth] = useState('');
  const [billingYear, setBillingYear] = useState('');
  const [expenseDate, setExpenseDate] = useState(todayDate());
  const [dueDate, setDueDate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | ''>('');
  const [bankName, setBankName] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [allocate, setAllocate] = useState(false);
  const [allocMethod, setAllocMethod] = useState<'EQUAL' | 'CUSTOM'>('EQUAL');
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([]);
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>(
    {},
  );
  const [saving, setSaving] = useState(false);

  const [properties, setProperties] = useState<Property[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);

  const nameSuggestions = useMemo(() => {
    const fromCategories = categories
      .filter((c) => !c.isSystem || c.name === 'Other')
      .map((c) => c.name);
    return Array.from(
      new Set([...EXPENSE_NAME_EXAMPLES, ...fromCategories]),
    ).sort((a, b) => a.localeCompare(b));
  }, [categories]);

  const amountNum = Number(amount) || 0;
  const paidNum = Number(paidAmount) || 0;
  const remaining = Math.max(amountNum - paidNum, 0);
  const previewStatus = deriveStatus(amountNum, paidNum, dueDate);

  useEffect(() => {
    if (!open) return;
    setExpenseName('');
    setSaveExpenseName(false);
    const scope: OtherScope =
      preferredScope ??
      (preferredUnitId ? 'UNIT' : preferredPropertyId ? 'PROPERTY' : 'GENERAL');
    setExpenseScope(scope);
    setPropertyId(preferredPropertyId ?? '');
    setUnitId(preferredUnitId ?? '');
    setAmount('');
    setPaidAmount('0');
    setBillingMonth(
      preferredBillingMonth ? String(preferredBillingMonth) : String(new Date().getMonth() + 1),
    );
    setBillingYear(
      preferredBillingYear
        ? String(preferredBillingYear)
        : String(new Date().getFullYear()),
    );
    setExpenseDate(todayDate());
    setDueDate('');
    setPaymentMethod('');
    setBankName('');
    setReferenceNumber('');
    setVendorName('');
    setDescription('');
    setNotes('');
    setAllocate(false);
    setAllocMethod('EQUAL');
    setSelectedUnitIds([]);
    setCustomAmounts({});
  }, [
    open,
    preferredBillingMonth,
    preferredBillingYear,
    preferredPropertyId,
    preferredUnitId,
    preferredScope,
  ]);

  useEffect(() => {
    if (!open || !token) return;
    void fetchProperties(token)
      .then(setProperties)
      .catch(() => setProperties([]));
  }, [open, token]);

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

  function toggleUnit(id: string) {
    setSelectedUnitIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function selectAllUnits() {
    setSelectedUnitIds(units.map((u) => u.id));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;

    const name = expenseName.trim();
    if (!name) {
      onError('Expense Name is required.');
      return;
    }
    if (amountNum <= 0) {
      onError('Amount must be greater than zero.');
      return;
    }
    if (!billingMonth || !billingYear) {
      onError('Billing month and year are required.');
      return;
    }
    if (expenseScope === 'PROPERTY' || expenseScope === 'UNIT') {
      if (!propertyId) {
        onError('Property is required for this scope.');
        return;
      }
    }
    if (expenseScope === 'UNIT' && !unitId) {
      onError('Unit is required for Specific Apartment / Room.');
      return;
    }
    if (allocate && expenseScope === 'PROPERTY') {
      if (!selectedUnitIds.length) {
        onError('Select at least one unit for allocation.');
        return;
      }
      if (allocMethod === 'CUSTOM') {
        const sum = selectedUnitIds.reduce(
          (acc, id) => acc + (Number(customAmounts[id]) || 0),
          0,
        );
        if (Math.abs(sum - amountNum) > 0.009) {
          onError(
            `Custom amounts (${sum.toFixed(2)}) must equal expense amount (${amountNum.toFixed(2)}).`,
          );
          return;
        }
      }
    }

    const matchedCategory = categories.find(
      (c) => c.name.toLowerCase() === name.toLowerCase(),
    );

    const payload: CreateExpenseInput = {
      expenseName: name,
      saveExpenseName: saveExpenseName || Boolean(matchedCategory),
      categoryId: matchedCategory?.id,
      expenseScope,
      expenseDate,
      amount: amountNum,
      paidAmount: paidNum,
      paymentMethod: paymentMethod || undefined,
      bankName: bankName.trim() || undefined,
      referenceNumber: referenceNumber.trim() || undefined,
      vendorName: vendorName.trim() || undefined,
      description: description.trim() || undefined,
      notes: notes.trim() || undefined,
      dueDate: dueDate || undefined,
      billingMonth: Number(billingMonth),
      billingYear: Number(billingYear),
    };

    if (expenseScope === 'PROPERTY' || expenseScope === 'UNIT') {
      payload.propertyId = propertyId;
    }
    if (expenseScope === 'UNIT') {
      payload.unitId = unitId;
    }

    if (allocate && expenseScope === 'PROPERTY') {
      payload.allocateToUnits = {
        enabled: true,
        unitIds: selectedUnitIds,
        method: allocMethod,
        customAmounts:
          allocMethod === 'CUSTOM'
            ? selectedUnitIds.map((id) => ({
                unitId: id,
                amount: Number(customAmounts[id]) || 0,
              }))
            : undefined,
      };
    }

    setSaving(true);
    try {
      await createExpense(token, payload);
      if (saveExpenseName) onCategoriesChanged?.();
      onSaved();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Unable to save expense.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormModal open={open} title="Add Other Expense" onClose={onClose}>
      <form className="form-grid" onSubmit={handleSubmit}>
        <label className="form-field">
          <span>Expense Name</span>
          <input
            list="other-expense-names"
            value={expenseName}
            onChange={(e) => setExpenseName(e.target.value)}
            placeholder="e.g. Water Tank Cleaning"
            required
          />
          <datalist id="other-expense-names">
            {nameSuggestions.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        </label>

        <label className="form-field form-field--checkbox">
          <input
            type="checkbox"
            checked={saveExpenseName}
            onChange={(e) => setSaveExpenseName(e.target.checked)}
          />
          <span>Save this expense name for future use</span>
        </label>

        <label className="form-field">
          <span>Expense Applies To</span>
          <select
            value={expenseScope}
            onChange={(e) => {
              const next = e.target.value as OtherScope;
              setExpenseScope(next);
              if (next === 'GENERAL') {
                setPropertyId('');
                setUnitId('');
                setAllocate(false);
              }
              if (next === 'PROPERTY') {
                setUnitId('');
              }
              if (next !== 'PROPERTY') {
                setAllocate(false);
              }
            }}
            required
          >
            {SCOPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        {(expenseScope === 'PROPERTY' || expenseScope === 'UNIT') && (
          <label className="form-field">
            <span>Property</span>
            <select
              value={propertyId}
              onChange={(e) => {
                setPropertyId(e.target.value);
                setUnitId('');
              }}
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
        )}

        {expenseScope === 'UNIT' && (
          <label className="form-field">
            <span>Unit</span>
            <select
              value={unitId}
              onChange={(e) => setUnitId(e.target.value)}
              required
              disabled={!propertyId}
            >
              <option value="">
                {propertyId ? 'Select unit' : 'Select property first'}
              </option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.unitNumber}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="form-grid form-grid--2">
          <label className="form-field">
            <span>Amount (PKR)</span>
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
            <span>Paid Amount (PKR)</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={paidAmount}
              onChange={(e) => setPaidAmount(e.target.value)}
            />
          </label>
        </div>

        <div className="form-hint">
          Remaining: <strong>{formatPkr(remaining)}</strong> · Status:{' '}
          <strong>{previewStatus}</strong>
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
            />
          </label>
        </div>

        <div className="form-grid form-grid--2">
          <label className="form-field">
            <span>Expense Date</span>
            <input
              type="date"
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
              required
            />
          </label>
          <label className="form-field">
            <span>Due Date</span>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </label>
        </div>

        <div className="form-grid form-grid--2">
          <label className="form-field">
            <span>Payment Method</span>
            <select
              value={paymentMethod}
              onChange={(e) =>
                setPaymentMethod(e.target.value as PaymentMethod | '')
              }
            >
              <option value="">Optional</option>
              {METHODS.map((m) => (
                <option key={m} value={m}>
                  {m.replaceAll('_', ' ')}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>Bank</span>
            <input
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              placeholder="Optional"
            />
          </label>
        </div>

        <div className="form-grid form-grid--2">
          <label className="form-field">
            <span>Reference</span>
            <input
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
            />
          </label>
          <label className="form-field">
            <span>Vendor</span>
            <input
              value={vendorName}
              onChange={(e) => setVendorName(e.target.value)}
            />
          </label>
        </div>

        <label className="form-field">
          <span>Description</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />
        </label>

        <label className="form-field">
          <span>Notes</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
          />
        </label>

        {expenseScope === 'PROPERTY' && propertyId ? (
          <div className="form-grid">
            <label className="form-field form-field--checkbox">
              <input
                type="checkbox"
                checked={allocate}
                onChange={(e) => setAllocate(e.target.checked)}
              />
              <span>Allocate to Apartments (optional, off by default)</span>
            </label>

            {allocate ? (
              <>
                <div className="form-grid form-grid--2">
                  <label className="form-field">
                    <span>Allocation Method</span>
                    <select
                      value={allocMethod}
                      onChange={(e) =>
                        setAllocMethod(e.target.value as 'EQUAL' | 'CUSTOM')
                      }
                    >
                      <option value="EQUAL">Equal Split</option>
                      <option value="CUSTOM">Custom Amount</option>
                    </select>
                  </label>
                  <div className="form-actions" style={{ alignItems: 'end' }}>
                    <button
                      type="button"
                      className="btn btn--ghost"
                      onClick={selectAllUnits}
                    >
                      All Units
                    </button>
                  </div>
                </div>
                <div className="form-hint">
                  {allocMethod === 'EQUAL' && selectedUnitIds.length
                    ? `≈ ${formatPkr(amountNum / selectedUnitIds.length)} per unit`
                    : 'Select units to allocate'}
                </div>
                <div className="form-grid">
                  {units.map((u) => (
                    <div
                      key={u.id}
                      className="form-grid form-grid--2"
                      style={{ alignItems: 'center' }}
                    >
                      <label className="form-field form-field--checkbox">
                        <input
                          type="checkbox"
                          checked={selectedUnitIds.includes(u.id)}
                          onChange={() => toggleUnit(u.id)}
                        />
                        <span>{u.unitNumber}</span>
                      </label>
                      {allocMethod === 'CUSTOM' &&
                      selectedUnitIds.includes(u.id) ? (
                        <label className="form-field">
                          <span>Amount</span>
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={customAmounts[u.id] ?? ''}
                            onChange={(e) =>
                              setCustomAmounts((prev) => ({
                                ...prev,
                                [u.id]: e.target.value,
                              }))
                            }
                          />
                        </label>
                      ) : null}
                    </div>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        ) : null}

        <div className="form-actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save Expense'}
          </button>
        </div>
      </form>
    </FormModal>
  );
}
