import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { fetchBookings } from '../../api/bookings';
import { fetchMonthlyTenancies } from '../../api/monthly-tenancies';
import { createExpense, updateExpense } from '../../api/expenses';
import { fetchProperties } from '../../api/properties';
import { fetchUnits } from '../../api/units';
import { formatPkr } from '../../lib/format';
import type { Booking } from '../../types/booking';
import type {
  CreateExpenseInput,
  Expense,
  ExpenseCategory,
  ExpenseScope,
  PaymentMethod,
} from '../../types/expense';
import type { MonthlyTenancy } from '../../types/monthly-tenancy';
import type { Property } from '../../types/property';
import type { Unit } from '../../types/unit';
import { FormModal } from '../ui/FormModal';
import '../../styles/forms.css';

type ExpenseFormModalProps = {
  open: boolean;
  token: string;
  categories: ExpenseCategory[];
  expense?: Expense | null;
  receptionistMode?: boolean;
  preferredCategoryName?: string | null;
  preferredPropertyId?: string;
  preferredUnitId?: string;
  billingMonth?: number | string;
  billingYear?: number | string;
  onClose: () => void;
  onSaved: () => void;
  onError: (message: string) => void;
  onAddCategory?: () => void;
};

const SCOPES: ExpenseScope[] = [
  'GENERAL',
  'PROPERTY',
  'UNIT',
  'BOOKING',
  'MONTHLY_TENANCY',
];

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

function deriveStatus(amount: number, paid: number) {
  if (!amount || paid <= 0) return 'UNPAID';
  if (paid >= amount) return 'PAID';
  return 'PARTIAL';
}

export function ExpenseFormModal({
  open,
  token,
  categories,
  expense,
  receptionistMode = false,
  preferredCategoryName,
  preferredPropertyId,
  preferredUnitId,
  billingMonth: preferredBillingMonth,
  billingYear: preferredBillingYear,
  onClose,
  onSaved,
  onError,
  onAddCategory,
}: ExpenseFormModalProps) {
  const [categoryId, setCategoryId] = useState('');
  const [expenseScope, setExpenseScope] = useState<ExpenseScope>('GENERAL');
  const [propertyId, setPropertyId] = useState('');
  const [unitId, setUnitId] = useState('');
  const [bookingId, setBookingId] = useState('');
  const [monthlyTenancyId, setMonthlyTenancyId] = useState('');
  const [expenseDate, setExpenseDate] = useState(todayDate());
  const [amount, setAmount] = useState('');
  const [paidAmount, setPaidAmount] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | ''>('');
  const [vendorName, setVendorName] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [description, setDescription] = useState('');
  const [receiptUrl, setReceiptUrl] = useState('');
  const [billingMonth, setBillingMonth] = useState('');
  const [billingYear, setBillingYear] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [paidDate, setPaidDate] = useState('');
  const [payeeName, setPayeeName] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const [properties, setProperties] = useState<Property[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [tenancies, setTenancies] = useState<MonthlyTenancy[]>([]);

  const visibleCategories = useMemo(() => {
    if (!receptionistMode) return categories;
    return categories.filter(
      (c) => c.name === 'Cleaning' || c.name === 'Laundry',
    );
  }, [categories, receptionistMode]);

  const selectedCategory = visibleCategories.find((c) => c.id === categoryId);
  const isRent = selectedCategory?.name === 'Rent';

  const amountNum = Number(amount) || 0;
  const paidNum = Number(paidAmount) || 0;
  const remaining = Math.max(amountNum - paidNum, 0);
  const previewStatus = deriveStatus(amountNum, paidNum);

  useEffect(() => {
    if (!open) return;

    if (expense) {
      setCategoryId(expense.categoryId);
      setExpenseScope(expense.expenseScope);
      setPropertyId(expense.propertyId ?? '');
      setUnitId(expense.unitId ?? '');
      setBookingId(expense.bookingId ?? '');
      setMonthlyTenancyId(expense.monthlyTenancyId ?? '');
      setExpenseDate(expense.expenseDate.slice(0, 10));
      setAmount(expense.amount);
      setPaidAmount(expense.paidAmount);
      setPaymentMethod(expense.paymentMethod ?? '');
      setVendorName(expense.vendorName ?? '');
      setReferenceNumber(expense.referenceNumber ?? '');
      setDescription(expense.description ?? '');
      setReceiptUrl(expense.receiptUrl ?? '');
      setBillingMonth(
        expense.billingMonth != null
          ? String(expense.billingMonth)
          : expense.metadata?.billingMonth
            ? String(expense.metadata.billingMonth)
            : '',
      );
      setBillingYear(
        expense.billingYear != null
          ? String(expense.billingYear)
          : expense.metadata?.billingYear
            ? String(expense.metadata.billingYear)
            : '',
      );
      setDueDate(
        (expense.dueDate ?? expense.metadata?.dueDate ?? '').toString().slice(0, 10),
      );
      setPaidDate(expense.metadata?.paidDate?.slice(0, 10) ?? '');
      setPayeeName(expense.metadata?.payeeName ?? '');
      setNotes(expense.metadata?.notes ?? '');
    } else {
      const preferredCategory = preferredCategoryName
        ? visibleCategories.find((c) => c.name === preferredCategoryName)
        : undefined;
      setCategoryId(preferredCategory?.id ?? visibleCategories[0]?.id ?? '');
      setExpenseScope(
        preferredUnitId ? 'UNIT' : receptionistMode ? 'UNIT' : 'GENERAL',
      );
      setPropertyId(preferredPropertyId ?? '');
      setUnitId(preferredUnitId ?? '');
      setBookingId('');
      setMonthlyTenancyId('');
      setExpenseDate(todayDate());
      setAmount('');
      setPaidAmount('0');
      setPaymentMethod('');
      setVendorName('');
      setReferenceNumber('');
      setDescription('');
      setReceiptUrl('');
      setBillingMonth(
        preferredBillingMonth ? String(preferredBillingMonth) : '',
      );
      setBillingYear(
        preferredBillingYear
          ? String(preferredBillingYear)
          : String(new Date().getFullYear()),
      );
      setDueDate('');
      setPaidDate('');
      setPayeeName('');
      setNotes('');
    }
  }, [
    open,
    expense,
    visibleCategories,
    receptionistMode,
    preferredCategoryName,
    preferredPropertyId,
    preferredUnitId,
    preferredBillingMonth,
    preferredBillingYear,
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
      return;
    }
    void fetchUnits(token, { propertyId, isActive: true })
      .then(setUnits)
      .catch(() => setUnits([]));
  }, [open, token, propertyId]);

  useEffect(() => {
    if (!open || !token || expenseScope !== 'BOOKING') return;
    void fetchBookings(token, {})
      .then(setBookings)
      .catch(() => setBookings([]));
  }, [open, token, expenseScope]);

  useEffect(() => {
    if (!open || !token || expenseScope !== 'MONTHLY_TENANCY') return;
    void fetchMonthlyTenancies(token, {})
      .then(setTenancies)
      .catch(() => setTenancies([]));
  }, [open, token, expenseScope]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;

    if (!categoryId) {
      onError('Select an expense category.');
      return;
    }
    if (amountNum <= 0) {
      onError('Amount must be greater than zero.');
      return;
    }

    const payload: CreateExpenseInput = {
      categoryId,
      expenseScope,
      expenseDate,
      amount: amountNum,
      paidAmount: paidNum,
      paymentMethod: paymentMethod || undefined,
      vendorName: vendorName.trim() || undefined,
      referenceNumber: referenceNumber.trim() || undefined,
      description: description.trim() || undefined,
      receiptUrl: receiptUrl.trim() || undefined,
    };

    if (expenseScope === 'PROPERTY' || expenseScope === 'UNIT') {
      payload.propertyId = propertyId || undefined;
    }
    if (expenseScope === 'UNIT') {
      payload.unitId = unitId || undefined;
    }
    if (expenseScope === 'BOOKING') {
      payload.bookingId = bookingId || undefined;
    }
    if (expenseScope === 'MONTHLY_TENANCY') {
      payload.monthlyTenancyId = monthlyTenancyId || undefined;
    }

    if (isRent || billingMonth || billingYear || dueDate || payeeName || notes) {
      payload.metadata = {
        billingMonth: billingMonth ? Number(billingMonth) : undefined,
        billingYear: billingYear ? Number(billingYear) : undefined,
        dueDate: dueDate || undefined,
        paidDate: paidDate || undefined,
        payeeName: payeeName.trim() || undefined,
        notes: notes.trim() || undefined,
      };
      if (billingMonth) payload.billingMonth = Number(billingMonth);
      if (billingYear) payload.billingYear = Number(billingYear);
    }

    setSaving(true);
    try {
      if (expense) {
        await updateExpense(token, expense.id, payload);
      } else {
        await createExpense(token, payload);
      }
      onSaved();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Unable to save expense.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormModal
      open={open}
      title={expense ? 'Edit Expense' : 'Add Expense'}
      onClose={onClose}
    >
      <form className="form-grid" onSubmit={handleSubmit}>
        <div className="form-grid form-grid--2">
          <label className="form-field">
            <span>Expense Category</span>
            <select
              value={categoryId}
              onChange={(e) => {
                if (e.target.value === '__add__') {
                  onAddCategory?.();
                  return;
                }
                setCategoryId(e.target.value);
              }}
              required
            >
              <option value="">Select category</option>
              {visibleCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
              {!receptionistMode && (
                <option value="__add__">+ Add Other Type</option>
              )}
            </select>
          </label>

          <label className="form-field">
            <span>Expense Scope</span>
            <select
              value={expenseScope}
              onChange={(e) => setExpenseScope(e.target.value as ExpenseScope)}
              required
            >
              {SCOPES.map((scope) => (
                <option key={scope} value={scope}>
                  {scope.replaceAll('_', ' ')}
                </option>
              ))}
            </select>
          </label>
        </div>

        {(expenseScope === 'PROPERTY' || expenseScope === 'UNIT') && (
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
              >
                <option value="">Select property</option>
                {properties.map((property) => (
                  <option key={property.id} value={property.id}>
                    {property.name}
                  </option>
                ))}
              </select>
            </label>
            {expenseScope === 'UNIT' && (
              <label className="form-field">
                <span>Unit</span>
                <select
                  value={unitId}
                  onChange={(e) => setUnitId(e.target.value)}
                  required
                >
                  <option value="">Select unit</option>
                  {units.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.unitNumber}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        )}

        {expenseScope === 'BOOKING' && (
          <label className="form-field">
            <span>Booking</span>
            <select
              value={bookingId}
              onChange={(e) => setBookingId(e.target.value)}
              required
            >
              <option value="">Select booking</option>
              {bookings.map((booking) => (
                <option key={booking.id} value={booking.id}>
                  {booking.bookingNumber} — {booking.guest?.fullName ?? 'Guest'}
                </option>
              ))}
            </select>
          </label>
        )}

        {expenseScope === 'MONTHLY_TENANCY' && (
          <label className="form-field">
            <span>Monthly Tenancy</span>
            <select
              value={monthlyTenancyId}
              onChange={(e) => setMonthlyTenancyId(e.target.value)}
              required
            >
              <option value="">Select tenancy</option>
              {tenancies.map((tenancy) => (
                <option key={tenancy.id} value={tenancy.id}>
                  {tenancy.tenant?.fullName ?? 'Tenant'} —{' '}
                  {tenancy.unit?.unitNumber ?? 'Unit'}
                </option>
              ))}
            </select>
          </label>
        )}

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
            <span>Payment Method</span>
            <select
              value={paymentMethod}
              onChange={(e) =>
                setPaymentMethod(e.target.value as PaymentMethod | '')
              }
            >
              <option value="">Optional</option>
              {METHODS.map((method) => (
                <option key={method} value={method}>
                  {method.replaceAll('_', ' ')}
                </option>
              ))}
            </select>
          </label>
        </div>

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

        {isRent && (
          <div className="form-grid form-grid--2">
            <label className="form-field">
              <span>Month Covered</span>
              <input
                type="number"
                min="1"
                max="12"
                value={billingMonth}
                onChange={(e) => setBillingMonth(e.target.value)}
              />
            </label>
            <label className="form-field">
              <span>Year Covered</span>
              <input
                type="number"
                min="2000"
                max="2100"
                value={billingYear}
                onChange={(e) => setBillingYear(e.target.value)}
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
            <label className="form-field">
              <span>Paid Date</span>
              <input
                type="date"
                value={paidDate}
                onChange={(e) => setPaidDate(e.target.value)}
              />
            </label>
            <label className="form-field">
              <span>Owner / Payee</span>
              <input
                value={payeeName}
                onChange={(e) => setPayeeName(e.target.value)}
              />
            </label>
          </div>
        )}

        <div className="form-grid form-grid--2">
          <label className="form-field">
            <span>Vendor</span>
            <input
              value={vendorName}
              onChange={(e) => setVendorName(e.target.value)}
            />
          </label>
          <label className="form-field">
            <span>Reference Number</span>
            <input
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
            />
          </label>
        </div>

        <label className="form-field">
          <span>Description</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>

        <label className="form-field">
          <span>Receipt URL</span>
          <input
            value={receiptUrl}
            onChange={(e) => setReceiptUrl(e.target.value)}
            placeholder="https://..."
          />
        </label>

        <label className="form-field">
          <span>Notes</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>

        <div className="form-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Saving…' : expense ? 'Update Expense' : 'Create Expense'}
          </button>
        </div>
      </form>
    </FormModal>
  );
}
