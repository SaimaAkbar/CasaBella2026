import { useMemo, useState } from 'react';
import { formatDate, formatLabel, formatPkr } from '../../lib/format';
import type { SalaryRecord } from '../../types/employee';
import { FormModal } from '../ui/FormModal';
import { MoneyDisplay } from '../ui/MoneyDisplay';
import { PaymentStatusBadge } from '../ui/PaymentStatusBadge';
import '../../styles/forms.css';

type SalaryDetailModalProps = {
  open: boolean;
  record: SalaryRecord | null;
  onClose: () => void;
};

type Tab = 'Summary' | 'Transactions' | 'Advances' | 'Payments' | 'History';

export function SalaryDetailModal({
  open,
  record,
  onClose,
}: SalaryDetailModalProps) {
  const [tab, setTab] = useState<Tab>('Summary');

  const txs = record?.transactions ?? [];
  const advances = useMemo(
    () => txs.filter((t) => t.transactionType === 'ADVANCE'),
    [txs],
  );
  const payments = useMemo(
    () => txs.filter((t) => t.transactionType === 'SALARY_PAYMENT'),
    [txs],
  );

  if (!record) return null;

  return (
    <FormModal
      open={open}
      title={`${record.employee?.employeeCode ?? 'Salary'} — ${record.salaryMonth}/${record.salaryYear}`}
      onClose={onClose}
    >
      <div className="form-actions" style={{ justifyContent: 'flex-start' }}>
        {(
          ['Summary', 'Transactions', 'Advances', 'Payments', 'History'] as Tab[]
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

      {tab === 'Summary' ? (
        <dl className="detail-list">
          <div>
            <dt>Employee</dt>
            <dd>
              {record.employee?.fullName} ({record.employee?.employeeCode})
            </dd>
          </div>
          <div>
            <dt>Base Salary</dt>
            <dd>
              <MoneyDisplay value={record.baseSalary} />
            </dd>
          </div>
          <div>
            <dt>Advance / Bonus / Deduction</dt>
            <dd>
              {formatPkr(record.totalAdvance)} / {formatPkr(record.totalBonus)}{' '}
              / {formatPkr(record.totalDeductions)}
            </dd>
          </div>
          <div>
            <dt>Net Payable</dt>
            <dd>
              <MoneyDisplay value={record.netPayable} />
            </dd>
          </div>
          <div>
            <dt>Paid / Remaining</dt>
            <dd>
              {formatPkr(record.totalPaid)} /{' '}
              {formatPkr(record.remainingBalance)}
            </dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>
              <PaymentStatusBadge state={record.paymentStatus} />
            </dd>
          </div>
          <div>
            <dt>Finalized / Approved</dt>
            <dd>
              {record.finalized ? 'Yes' : 'No'} /{' '}
              {record.approvedBy?.fullName ?? '—'}
            </dd>
          </div>
        </dl>
      ) : null}

      {(tab === 'Transactions' || tab === 'History') && (
        <ul className="detail-list">
          {txs.length === 0 ? <li>No transactions.</li> : null}
          {txs.map((tx) => (
            <li key={tx.id}>
              <strong>{formatLabel(tx.transactionType)}</strong> —{' '}
              {formatPkr(tx.amount)} on {formatDate(tx.transactionDate)}
              {tx.isReversed ? ' (reversed)' : ''}
              {tx.reason ? ` · ${tx.reason}` : ''}
              {tx.expense?.expenseNumber
                ? ` · Expense ${tx.expense.expenseNumber}`
                : ''}
            </li>
          ))}
        </ul>
      )}

      {tab === 'Advances' && (
        <ul className="detail-list">
          {advances.length === 0 ? <li>No advances.</li> : null}
          {advances.map((tx) => (
            <li key={tx.id}>
              {formatPkr(tx.amount)} — {formatDate(tx.transactionDate)} —{' '}
              {tx.reason}
              {tx.isReversed ? ' (reversed)' : ''}
            </li>
          ))}
        </ul>
      )}

      {tab === 'Payments' && (
        <ul className="detail-list">
          {payments.length === 0 ? <li>No salary payments.</li> : null}
          {payments.map((tx) => (
            <li key={tx.id}>
              {formatPkr(tx.amount)} — {formatDate(tx.transactionDate)} —{' '}
              {tx.paymentMethod ? formatLabel(tx.paymentMethod) : '—'}
              {tx.isReversed ? ' (reversed)' : ''}
            </li>
          ))}
        </ul>
      )}
    </FormModal>
  );
}
