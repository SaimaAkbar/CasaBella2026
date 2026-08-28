import { formatLabel } from '../../lib/format';
import './StatusBadge.css';

type PaymentStatusBadgeProps = {
  state: string;
};

const CLASS_MAP: Record<string, string> = {
  UNPAID: 'status-badge--red',
  PARTIAL: 'status-badge--gold',
  HALF_PAID: 'status-badge--gold',
  PAID: 'status-badge--green',
  OVERPAID: 'status-badge--green',
  OVERDUE: 'status-badge--orange',
  RENT_OVERDUE: 'status-badge--red',
  ELECTRICITY_OVERDUE: 'status-badge--red',
  RENT_AND_ELECTRICITY_OVERDUE: 'status-badge--red',
};

const LABEL_MAP: Record<string, string> = {
  UNPAID: 'UNPAID',
  PARTIAL: 'PARTIAL PAID',
  HALF_PAID: 'PARTIAL PAID',
  ADVANCE: 'ADVANCE',
  PAID: '✓ PAID',
  OVERDUE: 'OVERDUE',
  RENT_OVERDUE: 'RENT OVERDUE',
  ELECTRICITY_OVERDUE: 'ELECTRICITY OVERDUE',
  RENT_AND_ELECTRICITY_OVERDUE: 'RENT + ELECTRICITY OVERDUE',
};

export function PaymentStatusBadge({ state }: PaymentStatusBadgeProps) {
  return (
    <span className={`status-badge ${CLASS_MAP[state] ?? 'status-badge--gray'}`}>
      {LABEL_MAP[state] ?? formatLabel(state)}
    </span>
  );
}
