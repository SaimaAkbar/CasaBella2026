import type {
  ExpensePaymentStatus,
  UnitMonthExpenseStatus,
} from '../../types/expense';

const LABELS: Record<string, string> = {
  PAID: 'Paid',
  PARTIAL: 'Partial',
  UNPAID: 'Unpaid',
  OVERDUE: 'Overdue',
  NO_CHARGE: 'No Charge',
};

const ICONS: Record<string, string> = {
  PAID: '✅',
  PARTIAL: '🟡',
  UNPAID: '🔴',
  OVERDUE: '⚠️',
  NO_CHARGE: '○',
};

export function ExpenseStatusTick({
  status,
}: {
  status: ExpensePaymentStatus | UnitMonthExpenseStatus | string;
}) {
  return (
    <span
      className={`expense-status expense-status--${String(status).toLowerCase()}`}
      title={LABELS[status] ?? status}
    >
      <span aria-hidden="true">{ICONS[status] ?? '•'}</span>{' '}
      {LABELS[status] ?? status}
    </span>
  );
}
