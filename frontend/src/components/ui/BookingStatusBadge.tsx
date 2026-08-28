import { formatLabel } from '../../lib/format';
import type { BookingStatus } from '../../types/booking';
import './StatusBadge.css';

type BookingStatusBadgeProps = {
  status: BookingStatus;
};

const CLASS_MAP: Record<BookingStatus, string> = {
  PENDING: 'status-badge--gray',
  CONFIRMED: 'status-badge--blue',
  CHECKED_IN: 'status-badge--green',
  CHECKED_OUT: 'status-badge--white',
  CANCELLED: 'status-badge--red',
  NO_SHOW: 'status-badge--blocked',
};

export function BookingStatusBadge({ status }: BookingStatusBadgeProps) {
  return (
    <span className={`status-badge ${CLASS_MAP[status]}`}>
      {formatLabel(status)}
    </span>
  );
}
