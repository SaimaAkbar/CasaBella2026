import './StatusBadge.css';

type StatusBadgeProps = {
  status: string;
};

const CLASS_MAP: Record<string, string> = {
  ACTIVE: 'status-badge--green',
  INACTIVE: 'status-badge--gray',
  OCCUPIED: 'status-badge--blue',
  EMPTY: 'status-badge--white',
};

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span className={`status-badge ${CLASS_MAP[status] ?? 'status-badge--gray'}`}>
      {status.replaceAll('_', ' ')}
    </span>
  );
}
