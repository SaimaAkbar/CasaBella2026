import { formatDateShort, formatPkr } from '../../lib/format';
import type { SalaryRecord, SalaryTransaction } from '../../types/employee';

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

export function getActiveAdvances(
  record: SalaryRecord | null | undefined,
): SalaryTransaction[] {
  if (!record) return [];
  const txs = record.transactions ?? [];
  return txs.filter(
    (t) => t.transactionType === 'ADVANCE' && !t.isReversed,
  );
}

export function formatAdvanceLine(tx: SalaryTransaction): string {
  const reason = tx.reason?.trim() ? ` (${tx.reason.trim()})` : '';
  return `${formatPkr(tx.amount)} on ${formatDateShort(tx.transactionDate)}${reason}`;
}

type SalaryAdvanceBannerProps = {
  record: SalaryRecord;
  /** Compact single-line for table rows; fuller for modals */
  variant?: 'row' | 'detail' | 'payment';
  className?: string;
};

export function SalaryAdvanceBanner({
  record,
  variant = 'detail',
  className = '',
}: SalaryAdvanceBannerProps) {
  const advances = getActiveAdvances(record);
  if (Number(record.totalAdvance) <= 0 && advances.length === 0) {
    return null;
  }

  const appliedMonth =
    MONTH_NAMES[record.salaryMonth - 1] ?? String(record.salaryMonth);
  const appliedLabel = `${appliedMonth} ${record.salaryYear}`;
  const remaining = formatPkr(record.remainingBalance);
  const total = formatPkr(record.totalAdvance);

  if (variant === 'payment') {
    return (
      <div
        className={`salary-advance-banner salary-advance-banner--payment ${className}`.trim()}
        role="status"
      >
        <strong>Advance already received</strong>
        <span>
          This employee already received {total} advance for {appliedLabel}
          {advances.length > 0
            ? ` — ${advances.map(formatAdvanceLine).join('; ')}`
            : ''}
          . Remaining salary {remaining}.
        </span>
      </div>
    );
  }

  const detailText =
    advances.length > 0
      ? advances.map(formatAdvanceLine).join('; ')
      : total;

  return (
    <div
      className={`salary-advance-banner salary-advance-banner--${variant} ${className}`.trim()}
      role="status"
    >
      <strong>Advance already paid:</strong>{' '}
      <span>
        {detailText} — remaining salary {remaining}
        {variant === 'detail' ? ` (applied to ${appliedLabel})` : ''}
      </span>
    </div>
  );
}

type MonthAdvancesSummaryBarProps = {
  records: SalaryRecord[];
  month: number;
  year: number;
};

export function MonthAdvancesSummaryBar({
  records,
  month,
  year,
}: MonthAdvancesSummaryBarProps) {
  const withAdvances = records.filter((r) => Number(r.totalAdvance) > 0);
  if (withAdvances.length === 0) return null;

  const total = withAdvances.reduce(
    (sum, r) => sum + Number(r.totalAdvance),
    0,
  );
  const monthLabel = MONTH_NAMES[month - 1] ?? String(month);
  const count = withAdvances.length;

  return (
    <div className="salary-advance-banner salary-advance-banner--summary" role="status">
      <strong>
        {count} employee{count === 1 ? '' : 's'} have advance
        {count === 1 ? '' : 's'}
      </strong>{' '}
      totaling {formatPkr(total)} for {monthLabel} {year}
    </div>
  );
}
