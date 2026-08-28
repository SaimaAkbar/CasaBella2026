import { useEffect, useMemo, useState } from 'react';
import {
  fetchEmployee,
  fetchEmployeeYearlyStatus,
} from '../../api/employees';
import { fetchSalaryRecord, fetchSalaryRecords } from '../../api/salary-records';
import {
  fetchSalaryTransactions,
  reverseSalaryTransaction,
} from '../../api/salary-transactions';
import { formatDate, formatLabel, formatPkr } from '../../lib/format';
import type {
  Employee,
  SalaryRecord,
  SalaryTransaction,
  YearlyMonthStatus,
} from '../../types/employee';
import { FormModal } from '../ui/FormModal';
import { MoneyDisplay } from '../ui/MoneyDisplay';
import '../../styles/forms.css';

type EmployeeDetailModalProps = {
  open: boolean;
  token: string;
  employeeId: string | null;
  onClose: () => void;
  onOpenSalary: (record: SalaryRecord) => void;
  onError: (message: string) => void;
  onReversed: () => void;
};

type Tab = 'Profile' | 'Salary History' | 'Advances' | 'Payments' | 'History';

const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function statusTick(
  status: YearlyMonthStatus['status'],
  hasAdvance: boolean,
): string {
  if (status === 'NONE') return '—';
  if (status === 'PAID') return '✅';
  if (status === 'PARTIAL') return '🟡';
  if (hasAdvance) return '🟡';
  return '🔴';
}

export function EmployeeDetailModal({
  open,
  token,
  employeeId,
  onClose,
  onOpenSalary,
  onError,
  onReversed,
}: EmployeeDetailModalProps) {
  const [tab, setTab] = useState<Tab>('Profile');
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [records, setRecords] = useState<SalaryRecord[]>([]);
  const [transactions, setTransactions] = useState<SalaryTransaction[]>([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [yearly, setYearly] = useState<YearlyMonthStatus[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !token || !employeeId) return;
    setTab('Profile');
    void Promise.all([
      fetchEmployee(token, employeeId),
      fetchSalaryRecords(token, { employeeId }),
      fetchSalaryTransactions(token, { employeeId }),
      fetchEmployeeYearlyStatus(token, employeeId, year),
    ])
      .then(([emp, salaryRows, txRows, yearRows]) => {
        setEmployee(emp);
        setRecords(salaryRows);
        setTransactions(txRows);
        setYearly(yearRows);
      })
      .catch((err) =>
        onError(err instanceof Error ? err.message : 'Unable to load employee.'),
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch on open/id/year only
  }, [open, token, employeeId, year]);

  const currentYear = new Date().getFullYear();

  const advances = useMemo(
    () => transactions.filter((tx) => tx.transactionType === 'ADVANCE'),
    [transactions],
  );
  const payments = useMemo(
    () =>
      transactions.filter((tx) => tx.transactionType === 'SALARY_PAYMENT'),
    [transactions],
  );

  async function handleReverse(tx: SalaryTransaction) {
    const reason = window.prompt('Reversal reason (required):');
    if (!reason || reason.trim().length < 3) {
      onError('Reversal reason is required.');
      return;
    }
    setBusyId(tx.id);
    try {
      await reverseSalaryTransaction(token, tx.id, reason.trim());
      onReversed();
      if (employeeId) {
        const [salaryRows, txRows, yearRows] = await Promise.all([
          fetchSalaryRecords(token, { employeeId }),
          fetchSalaryTransactions(token, { employeeId }),
          fetchEmployeeYearlyStatus(token, employeeId, year),
        ]);
        setRecords(salaryRows);
        setTransactions(txRows);
        setYearly(yearRows);
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Unable to reverse.');
    } finally {
      setBusyId(null);
    }
  }

  async function openMonth(row: YearlyMonthStatus) {
    if (!row.salaryRecordId || !token) return;
    try {
      const full = await fetchSalaryRecord(token, row.salaryRecordId);
      onOpenSalary(full);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Unable to open salary.');
    }
  }

  if (!employee) {
    return (
      <FormModal open={open} title="Employee" onClose={onClose}>
        <p className="form-hint">Loading…</p>
      </FormModal>
    );
  }

  return (
    <FormModal
      open={open}
      title={`${employee.employeeCode} — ${employee.fullName}`}
      onClose={onClose}
    >
      <div className="employees-detail__tabs">
        {(
          [
            'Profile',
            'Salary History',
            'Advances',
            'Payments',
            'History',
          ] as Tab[]
        ).map((item) => (
          <button
            key={item}
            type="button"
            className={tab === item ? 'btn btn--primary' : 'btn btn--ghost'}
            onClick={() => setTab(item)}
          >
            {item}
          </button>
        ))}
      </div>

      {tab === 'Profile' ? (
        <>
          <dl className="detail-list">
            <div>
              <dt>Name</dt>
              <dd>{employee.fullName}</dd>
            </div>
            <div>
              <dt>Father Name</dt>
              <dd>
                {employee.fatherOrSpouseName ?? employee.fatherName ?? '—'}
              </dd>
            </div>
            <div>
              <dt>Phone</dt>
              <dd>{employee.phone}</dd>
            </div>
            <div>
              <dt>CNIC</dt>
              <dd>{employee.cnic ?? '—'}</dd>
            </div>
            <div>
              <dt>Position</dt>
              <dd>{employee.position}</dd>
            </div>
            <div>
              <dt>Joining Date</dt>
              <dd>{formatDate(employee.joiningDate)}</dd>
            </div>
            <div>
              <dt>Monthly Salary</dt>
              <dd>
                <MoneyDisplay value={employee.monthlySalary ?? 0} />
              </dd>
            </div>
            <div>
              <dt>Bank</dt>
              <dd>
                {employee.bankName ?? '—'} / {employee.accountTitle ?? '—'} /{' '}
                {employee.accountNumberOrIban ?? '—'}
              </dd>
            </div>
          </dl>

          <div className="employees-year-grid">
            <div className="employees-year-grid__header">
              <strong>Yearly Status</strong>
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
              >
                {Array.from({ length: 6 }, (_, i) => currentYear - i).map(
                  (y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            <div className="employees-year-grid__months">
              {yearly.map((row) => (
                <button
                  key={row.month}
                  type="button"
                  className="employees-year-grid__cell"
                  disabled={!row.salaryRecordId}
                  onClick={() => void openMonth(row)}
                >
                  <span>{MONTH_SHORT[row.month - 1]}</span>
                  <strong>{statusTick(row.status, row.hasAdvance)}</strong>
                </button>
              ))}
            </div>
            <p className="form-hint">
              ✅ Paid · 🟡 Partial / Advance · 🔴 Unpaid · — Not generated
            </p>
          </div>
        </>
      ) : null}

      {tab === 'Salary History' ? (
        <ul className="detail-list">
          {records.length === 0 ? <li>No salary history.</li> : null}
          {records.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                className="data-table__action"
                onClick={() => onOpenSalary(row)}
              >
                {MONTH_SHORT[row.salaryMonth - 1]} {row.salaryYear}
              </button>{' '}
              Base {formatPkr(row.baseSalary)} · Advance{' '}
              {formatPkr(row.totalAdvance)} · Paid {formatPkr(row.totalPaid)} ·
              Remaining {formatPkr(row.remainingBalance)}{' '}
              {row.paymentStatus === 'PAID'
                ? '✅'
                : row.paymentStatus === 'PARTIAL'
                  ? '🟡'
                  : '🔴'}
            </li>
          ))}
        </ul>
      ) : null}

      {tab === 'Advances' ? (
        <ul className="detail-list">
          {advances.length === 0 ? <li>No advances.</li> : null}
          {advances.map((tx) => (
            <li key={tx.id}>
              {formatDate(tx.transactionDate)} — {formatPkr(tx.amount)} applied
              to {tx.salaryRecord?.salaryMonth}/{tx.salaryRecord?.salaryYear} —{' '}
              {tx.reason ?? '—'}
              {tx.paymentMethod ? ` · ${formatLabel(tx.paymentMethod)}` : ''}
              {tx.isReversed ? ' (reversed)' : ''}
              {!tx.isReversed ? (
                <button
                  type="button"
                  className="data-table__action data-table__action--danger"
                  disabled={busyId === tx.id}
                  onClick={() => void handleReverse(tx)}
                >
                  Reverse
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {tab === 'Payments' ? (
        <ul className="detail-list">
          {payments.length === 0 ? <li>No payments.</li> : null}
          {payments.map((tx) => (
            <li key={tx.id}>
              {formatDate(tx.transactionDate)} — {formatPkr(tx.amount)}
              {tx.paymentMethod ? ` · ${formatLabel(tx.paymentMethod)}` : ''}
              {tx.isReversed ? ' (reversed)' : ''}
              {!tx.isReversed ? (
                <button
                  type="button"
                  className="data-table__action data-table__action--danger"
                  disabled={busyId === tx.id}
                  onClick={() => void handleReverse(tx)}
                >
                  Reverse
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {tab === 'History' ? (
        <ul className="detail-list">
          {transactions.length === 0 ? <li>No history.</li> : null}
          {transactions.map((tx) => (
            <li key={tx.id}>
              <strong>{formatLabel(tx.transactionType)}</strong> —{' '}
              {formatPkr(tx.amount)} on {formatDate(tx.transactionDate)}
              {tx.salaryRecord
                ? ` · for ${tx.salaryRecord.salaryMonth}/${tx.salaryRecord.salaryYear}`
                : ''}
              {tx.reason ? ` · ${tx.reason}` : ''}
              {tx.isReversed ? ' (reversed)' : ''}
              {tx.createdBy ? ` · by ${tx.createdBy.fullName}` : ''}
            </li>
          ))}
        </ul>
      ) : null}
    </FormModal>
  );
}
