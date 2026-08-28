import { useEffect, useState, type FormEvent } from 'react';
import { changeRoomAssetCondition } from '../../api/room-assets';
import type {
  ChangeRoomAssetConditionInput,
  RoomAsset,
  RoomAssetCondition,
} from '../../types/inventory';
import { FormModal } from '../ui/FormModal';
import { AssetConditionBadge } from './AssetConditionBadge';
import '../../styles/forms.css';

function todayDate() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const CONDITIONS: RoomAssetCondition[] = [
  'GOOD',
  'FAIR',
  'DAMAGED',
  'UNDER_REPAIR',
  'REPLACED',
  'MISSING',
];

type Props = {
  open: boolean;
  token: string;
  asset: RoomAsset | null;
  onClose: () => void;
  onSaved: () => void;
  onError: (message: string) => void;
};

export function ChangeConditionFormModal({
  open,
  token,
  asset,
  onClose,
  onSaved,
  onError,
}: Props) {
  const [form, setForm] = useState<ChangeRoomAssetConditionInput>({
    newCondition: 'GOOD',
    quantityAffected: 1,
    actionDate: todayDate(),
    reason: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !asset) return;
    setForm({
      newCondition: asset.condition,
      quantityAffected: Number(asset.quantity) || 1,
      actionDate: todayDate(),
      repairCost: 0,
      replacementCost: 0,
      reason: '',
      notes: '',
    });
  }, [open, asset]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (saving || !asset) return;
    if (!form.reason.trim() || form.reason.trim().length < 3) {
      onError('A reason of at least 3 characters is required.');
      return;
    }
    setSaving(true);
    try {
      await changeRoomAssetCondition(token, asset.id, {
        newCondition: form.newCondition,
        quantityAffected: Number(form.quantityAffected) || 1,
        actionDate: form.actionDate,
        repairCost: Number(form.repairCost) || undefined,
        replacementCost: Number(form.replacementCost) || undefined,
        reason: form.reason.trim(),
        notes: form.notes?.trim() || undefined,
      });
      onSaved();
      onClose();
    } catch (err) {
      onError(
        err instanceof Error ? err.message : 'Unable to change condition',
      );
    } finally {
      setSaving(false);
    }
  }

  if (!asset) return null;

  return (
    <FormModal
      open={open}
      title={`Change Condition — ${asset.assetCode}`}
      onClose={onClose}
    >
      <form className="form-grid" onSubmit={handleSubmit}>
      <p className="form-hint">
        Current condition: <AssetConditionBadge condition={asset.condition} />
      </p>
      <label className="form-field">
        <span>New Condition</span>
        <select
          value={form.newCondition}
          onChange={(e) =>
            setForm((p) => ({
              ...p,
              newCondition: e.target.value as RoomAssetCondition,
            }))
          }
          required
        >
          {CONDITIONS.map((c) => (
            <option key={c} value={c}>
              {c.replaceAll('_', ' ')}
            </option>
          ))}
        </select>
      </label>
      <div className="form-grid form-grid--2">
        <label className="form-field">
          <span>Quantity Affected</span>
          <input
            type="number"
            min={0.001}
            step="0.001"
            value={form.quantityAffected ?? 1}
            onChange={(e) =>
              setForm((p) => ({
                ...p,
                quantityAffected: Number(e.target.value),
              }))
            }
          />
        </label>
        <label className="form-field">
          <span>Action Date</span>
          <input
            type="date"
            value={form.actionDate}
            onChange={(e) =>
              setForm((p) => ({ ...p, actionDate: e.target.value }))
            }
            required
          />
        </label>
      </div>
      <div className="form-grid form-grid--2">
        <label className="form-field">
          <span>Repair Cost</span>
          <input
            type="number"
            min={0}
            step="0.01"
            value={form.repairCost ?? 0}
            onChange={(e) =>
              setForm((p) => ({ ...p, repairCost: Number(e.target.value) }))
            }
          />
        </label>
        <label className="form-field">
          <span>Replacement Cost</span>
          <input
            type="number"
            min={0}
            step="0.01"
            value={form.replacementCost ?? 0}
            onChange={(e) =>
              setForm((p) => ({
                ...p,
                replacementCost: Number(e.target.value),
              }))
            }
          />
        </label>
      </div>
      <label className="form-field">
        <span>Reason</span>
        <input
          value={form.reason}
          onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))}
          required
        />
      </label>
      <label className="form-field">
        <span>Notes</span>
        <textarea
          rows={2}
          value={form.notes ?? ''}
          onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
        />
      </label>
      <p className="form-hint">
        Repair/replacement costs create a linked Repair expense when greater
        than zero.
      </p>
        <div className="form-actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving ? 'Saving…' : 'Update Condition'}
          </button>
        </div>
      </form>
    </FormModal>
  );
}
