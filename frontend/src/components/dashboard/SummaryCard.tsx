import type { ReactNode } from 'react';
import './SummaryCard.css';

type SummaryCardProps = {
  label: string;
  value: ReactNode;
  tone?: 'default' | 'gold' | 'success' | 'info' | 'warn' | 'danger';
};

export function SummaryCard({
  label,
  value,
  tone = 'default',
}: SummaryCardProps) {
  return (
    <article className={`summary-card summary-card--${tone}`}>
      <p className="summary-card__label">{label}</p>
      <p className="summary-card__value">{value}</p>
    </article>
  );
}
