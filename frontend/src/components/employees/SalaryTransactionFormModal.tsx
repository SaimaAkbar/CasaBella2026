import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { fetchSalaryRecords } from '../../api/salary-records';
import { createSalaryTransaction } from '../../api/salary-transactions';
import { formatPkr } from '../../lib/format';
import type {
  Employee,
  PaymentMethod,
  SalaryRecord,
  SalaryTransactionType,
} from '../../types/employee';
import { FormModal } from '../ui/FormModal';
import '../../styles/forms.css';

type SalaryTransactionFormModalProps = {
  open: boolean;
  token: string;
  type: SalaryTransactionType;
  employees: Employee[];
  presetRecord?: SalaryRecord | null;
  presetEmployeeId?: string;
  defaultMonth?: number;
  defaultYear?: number;
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

const ADVANCE_REASONS = [
  'Medical emergency',
  'Family need',
  'School fee',
  'Travel',
  'Personal loan',
  'Emergency',
  'Other',
];

function todayDate() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const TITLES: Record<SalaryTransactionType, string> = {
  ADVANCE: 'Add Advance',
  BONUS: 'Add Bonus',
  DEDUCTION: 'Add Deduction',
  SALARY_PAYMENT: 'Record Salary Payment',
  ADJUSTMENT: 'Salary Adjustment',
  REVERSAL: 'Reversal',
};

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function SalaryTransactionFormModal({
  open,
  token,
  type,
  employees,
  presetRecord,
  presetEmployeeId,
  defaultMonth,
  defaultYear,
  onClose,
  onSaved,
  onError,
}: SalaryTransactionFormModalProps) {
  const now = new Date();
  const [employeeId, setEmployeeId] = useState('');
  const [salaryMonth, setSalaryMonth] = useState(
    String(defaultMonth ?? now.getMonth() + 1),
  );
  const [salaryYear, setSalaryYear] = useState(
    String(defaultYear ?? now.getFullYear()),
  );
  const [record, setRecord] = useState<SalaryRecord | null>(null);
  const [amount, setAmount] = useState('');
  const [transactionDate, setTransactionDate] = useState(todayDate());
  const [reasonPreset, setReasonPreset] = useState(ADVANCE_REASONS[0]);
  const [reasonOther, setReasonOther] = useState('');
  const [reason, setReason] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [transactionReference, setTransactionReference] = useState('');
  const [notes, setNotes] = useState('');
  const [adjustmentDirection, setAdjustmentDirection] = useState<
    'INCREASE' | 'DECREASE'
  >('INCREASE');
  const [saving, setSaving] = useState(false);
  const [loadingRecord, setLoadingRecord] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (presetRecord) {
      setEmployeeId(presetRecord.employeeId);
      setSalaryMonth(String(presetRecord.salaryMonth));
      setSalaryYear(String(presetRecord.salaryYear));
      setRecord(presetRecord);
    } else {
      setEmployeeId(presetEmployeeId ?? '');
      setRecord(null);
      setSalaryMonth(String(defaultMonth ?? new Date().getMonth() + 1));
      setSalaryYear(String(defaultYear ?? new Date().getFullYear()));
    }
    setAmount('');
    setReason('');
    setReasonPreset(ADVANCE_REASONS[0]);
    setReasonOther('');
    setNotes('');
    setTransactionReference('');
    setTransactionDate(todayDate());
  }, [open, presetRecord, presetEmployeeId, type, defaultMonth, defaultYear]);

  useEffect(() => {
    if (!open || !token || !employeeId) return;
    if (presetRecord && presetRecord.employeeId === employeeId) {
      setRecord(presetRecord);
      return;
    }
    setLoadingRecord(true);
    void fetchSalaryRecords(token, {
      employeeId,
      salaryMonth: Number(salaryMonth),
      salaryYear: Number(salaryYear),
    })
      .then((rows) => setRecord(rows[0] ?? null))
      .catch(() => setRecord(null))
      .finally(() => setLoadingRecord(false));
  }, [open, token, employeeId, salaryMonth, salaryYear, presetRecord]);

  const selectedEmployee = useMemo(
    () => employees.find((row) => row.id === employeeId) ?? null,
    [employees, employeeId],
  );

  const resolvedReason =
    type === 'ADVANCE'
      ? reasonPreset === 'Other'
        ? reasonOther.trim()
        : reasonPreset
      : reason.trim();

  const preview = useMemo(() => {
    const amt = Number(amount) || 0;
    const base = Number(
      record?.baseSalary ?? selectedEmployee?.monthlySalary ?? 0,
    );
    const advance = Number(record?.totalAdvance ?? 0);
    const bonus = Number(record?.totalBonus ?? 0);
    const deduction = Number(record?.totalDeductions ?? 0);
    const paid = Number(record?.totalPaid ?? 0);

    if (type === 'ADVANCE') {
      const nextAdvance = advance + amt;
      const nextNet = Math.max(base + bonus - nextAdvance - deduction, 0);
      return {
        employeeName: selectedEmployee?.fullName ?? '—',
        monthlySalary: base,
        existingAdvance: advance,
        newAdvance: amt,
        totalAdvance: nextAdvance,
        expectedRemaining: Math.max(nextNet - paid, 0),
      };
    }
    if (type === 'SALARY_PAYMENT' && record) {
      return {
        employeeName: selectedEmployee?.fullName ?? '—',
        monthlySalary: base,
        existingAdvance: advance,
        newAdvance: 0,
        totalAdvance: advance,
        expectedRemaining: Math.max(Number(record.remainingBalance) - amt, 0),
      };
    }
    return null;
  }, [record, amount, type, selectedEmployee]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;

    if (!employeeId) {
      onError('Select an employee.');
      return;
    }

    const value = Number(amount);
    if (!value || value <= 0) {
      onError('Amount must be greater than zero.');
      return;
    }

    if (
      (type === 'ADVANCE' ||
        type === 'BONUS' ||
        type === 'DEDUCTION' ||
        type === 'ADJUSTMENT') &&
      resolvedReason.length < 3
    ) {
      onError('Reason is mandatory.');
      return;
    }

    if (
      type === 'SALARY_PAYMENT' &&
      record &&
      value > Number(record.remainingBalance) + 0.001
    ) {
      onError('Payment cannot exceed remaining balance.');
      return;
    }

    setSaving(true);
    try {
      await createSalaryTransaction(token, {
        salaryRecordId: record?.id,
        employeeId,
        salaryMonth: Number(salaryMonth),
        salaryYear: Number(salaryYear),
        transactionType: type,
        amount: value,
        transactionDate,
        reason: resolvedReason || undefined,
        paymentMethod:
          type === 'SALARY_PAYMENT' || type === 'ADVANCE'
            ? paymentMethod
            : undefined,
        transactionReference: transactionReference.trim() || undefined,
        notes: notes.trim() || undefined,
        adjustmentDirection:
          type === 'ADJUSTMENT' ? adjustmentDirection : undefined,
      });
      onSaved();
    } catch (err) {
      onError(
        err instanceof Error ? err.message : 'Unable to save transaction.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormModal open={open} title={TITLES[type]} onClose={onClose}>
      <form className="form-grid" onSubmit={handleSubmit}>
        <label className="form-field">
          <span>Employee</span>
          <select
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            required
            disabled={Boolean(presetRecord)}
          >
            <option value="">Select employee</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.employeeCode} — {employee.fullName}
              </option>
            ))}
          </select>
        </label>

        <div className="form-grid form-grid--2">
          <label className="form-field">
            <span>
              {type === 'ADVANCE' ? 'Advance For Month' : 'Salary Month'}
            </span>
            <select
              value={salaryMonth}
              onChange={(e) => setSalaryMonth(e.target.value)}
              required
              disabled={Boolean(presetRecord)}
            >
              {MONTH_NAMES.map((name, index) => (
                <option key={name} value={index + 1}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>
              {type === 'ADVANCE' ? 'Advance For Year' : 'Salary Year'}
            </span>
            <input
              type="number"
              min="2000"
              max="2100"
              value={salaryYear}
              onChange={(e) => setSalaryYear(e.target.value)}
              required
              disabled={Boolean(presetRecord)}
            />
          </label>
        </div>

        {loadingRecord ? (
          <p className="form-hint">Loading salary record…</p>
        ) : record ? (
          <p className="form-hint">
            Base: <strong>{formatPkr(record.baseSalary)}</strong> · Advance:{' '}
            <strong>{formatPkr(record.totalAdvance)}</strong> · Net:{' '}
            <strong>{formatPkr(record.netPayable)}</strong> · Remaining:{' '}
            <strong>{formatPkr(record.remainingBalance)}</strong>
          </p>
        ) : (
          <p className="form-hint">
            No salary record yet for this month — it will be created
            automatically using the effective salary.
          </p>
        )}

        <div className="form-grid form-grid--2">
          <label className="form-field">
            <span>
              {type === 'ADVANCE' ? 'Advance Amount (PKR)' : 'Amount (PKR)'}
            </span>
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
            <span>{type === 'ADVANCE' ? 'Advance Date' : 'Date'}</span>
            <input
              type="date"
              value={transactionDate}
              onChange={(e) => setTransactionDate(e.target.value)}
              required
            />
          </label>
        </div>

        {type === 'ADJUSTMENT' ? (
          <label className="form-field">
            <span>Direction</span>
            <select
              value={adjustmentDirection}
              onChange={(e) =>
                setAdjustmentDirection(
                  e.target.value as 'INCREASE' | 'DECREASE',
                )
              }
            >
              <option value="INCREASE">Increase</option>
              <option value="DECREASE">Decrease</option>
            </select>
          </label>
        ) : null}

        {type === 'SALARY_PAYMENT' || type === 'ADVANCE' ? (
          <label className="form-field">
            <span>Payment Method</span>
            <select
              value={paymentMethod}
              onChange={(e) =>
                setPaymentMethod(e.target.value as PaymentMethod)
              }
              required
            >
              {METHODS.map((method) => (
                <option key={method} value={method}>
                  {method.replaceAll('_', ' ')}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {type === 'ADVANCE' ? (
          <>
            <label className="form-field">
              <span>Reason</span>
              <select
                value={reasonPreset}
                onChange={(e) => setReasonPreset(e.target.value)}
                required
              >
                {ADVANCE_REASONS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            {reasonPreset === 'Other' ? (
              <label className="form-field">
                <span>Custom Reason</span>
                <input
                  value={reasonOther}
                  onChange={(e) => setReasonOther(e.target.value)}
                  required
                />
              </label>
            ) : null}
          </>
        ) : type !== 'SALARY_PAYMENT' ? (
          <label className="form-field">
            <span>Reason</span>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
            />
          </label>
        ) : null}

        <label className="form-field">
          <span>Transaction Reference</span>
          <input
            value={transactionReference}
            onChange={(e) => setTransactionReference(e.target.value)}
          />
        </label>
        <label className="form-field">
          <span>Notes</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>

        {preview ? (
          <div className="employees-advance-preview">
            <p>
              Employee: <strong>{preview.employeeName}</strong>
            </p>
            <p>
              Monthly Salary: <strong>{formatPkr(preview.monthlySalary)}</strong>
            </p>
            {type === 'ADVANCE' ? (
              <>
                <p>
                  Existing Advance:{' '}
                  <strong>{formatPkr(preview.existingAdvance)}</strong>
                </p>
                <p>
                  New Advance: <strong>{formatPkr(preview.newAdvance)}</strong>
                </p>
                <p>
                  Total Advance:{' '}
                  <strong>{formatPkr(preview.totalAdvance)}</strong>
                </p>
              </>
            ) : null}
            <p>
              Expected Remaining:{' '}
              <strong>{formatPkr(preview.expectedRemaining)}</strong>
            </p>
          </div>
        ) : null}

        <div className="form-actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn--primary"
            disabled={saving || !employeeId}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </FormModal>
  );
}
