import { useEffect, useState } from 'react';
import { fetchRoomAssetHistory } from '../../api/room-assets';
import { formatDate, formatPkr } from '../../lib/format';
import type { RoomAsset, RoomAssetHistory } from '../../types/inventory';
import { FormModal } from '../ui/FormModal';
import { LoadingState } from '../ui/LoadingState';
import { AssetConditionBadge } from './AssetConditionBadge';

type Props = {
  open: boolean;
  token: string;
  asset: RoomAsset | null;
  canViewCosts: boolean;
  onClose: () => void;
  onError: (message: string) => void;
};

export function RoomAssetHistoryModal({
  open,
  token,
  asset,
  canViewCosts,
  onClose,
  onError,
}: Props) {
  const [rows, setRows] = useState<RoomAssetHistory[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !asset) return;
    let active = true;
    setLoading(true);
    void fetchRoomAssetHistory(token, asset.id)
      .then((data) => {
        if (active) setRows(data);
      })
      .catch((err) => {
        onError(err instanceof Error ? err.message : 'Unable to load history');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, asset, token, onError]);

  if (!asset) return null;

  return (
    <FormModal
      open={open}
      title={`Asset History — ${asset.assetCode}`}
      onClose={onClose}
      hideFooter
    >
      {loading ? (
        <LoadingState label="Loading history…" />
      ) : rows.length === 0 ? (
        <p className="form-hint">No condition history yet.</p>
      ) : (
        <div className="inventory-history">
          {rows.map((row) => (
            <article key={row.id} className="inventory-history__row">
              <header>
                <span>{formatDate(row.actionDate)}</span>
                <div className="inventory-history__conditions">
                  {row.previousCondition ? (
                    <AssetConditionBadge condition={row.previousCondition} />
                  ) : (
                    <span>—</span>
                  )}
                  <span>→</span>
                  <AssetConditionBadge condition={row.newCondition} />
                </div>
              </header>
              <p>
                Qty affected: <strong>{row.quantityAffected}</strong>
                {row.expense ? (
                  <>
                    {' '}
                    · Expense: <strong>{row.expense.expenseNumber}</strong>
                  </>
                ) : null}
              </p>
              {canViewCosts ? (
                <p>
                  Repair: {formatPkr(Number(row.repairCost ?? 0))} · Replace:{' '}
                  {formatPkr(Number(row.replacementCost ?? 0))}
                </p>
              ) : null}
              {row.reason ? <p>Reason: {row.reason}</p> : null}
              {row.notes ? <p>Notes: {row.notes}</p> : null}
              {row.createdBy ? (
                <p className="inventory-history__meta">
                  By {row.createdBy.fullName}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </FormModal>
  );
}
