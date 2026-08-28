import type { OwnerStatementPaymentStatus } from '../../types/owner';
import './OwnerPaymentStatusTick.css';

type Tick = { icon: string; label: string };

const TICK_MAP: Record<string, Tick> = {
  PAID: { icon: '✅', label: 'Paid' },
  PARTIAL: { icon: '🟡', label: 'Partial' },
  UNPAID: { icon: '🔴', label: 'Unpaid' },
  OVERDUE: { icon: '⚠️', label: 'Overdue' },
  OVERPAID: { icon: '✅', label: 'Overpaid' },
};

type Props = {
  status: OwnerStatementPaymentStatus | string | null | undefined;
  tick?: Tick | null;
};

/** Auto status tick from statement paymentStatus — green when PAID / OVERPAID. */
export function OwnerPaymentStatusTick({ status, tick }: Props) {
  if (!status && !tick) return <span className="owner-status-tick">—</span>;
  const resolved = tick ?? TICK_MAP[status ?? ''] ?? TICK_MAP.UNPAID;
  return (
    <span
      className={`owner-status-tick owner-status-tick--${(status ?? 'UNPAID').toLowerCase()}`}
      title={resolved.label}
    >
      <span aria-hidden="true">{resolved.icon}</span>
      <span>{resolved.label}</span>
    </span>
  );
}
