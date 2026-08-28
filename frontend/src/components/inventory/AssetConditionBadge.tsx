import { formatLabel } from '../../lib/format';
import type { RoomAssetCondition } from '../../types/inventory';
import '../ui/StatusBadge.css';

const CLASS: Record<RoomAssetCondition, string> = {
  GOOD: 'status-badge--green',
  FAIR: 'status-badge--blue',
  DAMAGED: 'status-badge--red',
  UNDER_REPAIR: 'status-badge--orange',
  REPLACED: 'status-badge--gray',
  MISSING: 'status-badge--missing',
};

type Props = { condition: RoomAssetCondition };

export function AssetConditionBadge({ condition }: Props) {
  return (
    <span className={`status-badge ${CLASS[condition]}`}>
      {formatLabel(condition)}
    </span>
  );
}
