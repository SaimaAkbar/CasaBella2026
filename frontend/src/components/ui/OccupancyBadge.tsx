import type { MonthlyOccupancyState } from '../../types/monthly-tenancy';
import './StatusBadge.css';

type OccupancyBadgeProps = {
  state: MonthlyOccupancyState;
};

const CLASS_MAP: Record<MonthlyOccupancyState, string> = {
  OCCUPIED: 'status-badge--blue',
  EMPTY: 'status-badge--white',
};

export function OccupancyBadge({ state }: OccupancyBadgeProps) {
  return (
    <span className={`status-badge ${CLASS_MAP[state]}`}>
      {state === 'OCCUPIED' ? 'Occupied' : 'Empty'}
    </span>
  );
}
