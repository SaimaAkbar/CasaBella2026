import { formatLabel } from '../../lib/format';
import type { ProfitLossResultType } from '../../types/profit-loss';
import '../ui/StatusBadge.css';

const CLASS: Record<ProfitLossResultType, string> = {
  PROFIT: 'status-badge--green',
  LOSS: 'status-badge--red',
  BREAK_EVEN: 'status-badge--gray',
};

type Props = { resultType: ProfitLossResultType };

export function ProfitLossBadge({ resultType }: Props) {
  return (
    <span className={`status-badge ${CLASS[resultType]}`}>
      {formatLabel(resultType)}
    </span>
  );
}
