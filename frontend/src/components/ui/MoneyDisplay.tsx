import { formatPkr } from '../../lib/format';

type MoneyDisplayProps = {
  value: string | number | null | undefined;
};

export function MoneyDisplay({ value }: MoneyDisplayProps) {
  return <span className="money-display">{formatPkr(value)}</span>;
}
