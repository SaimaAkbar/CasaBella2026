import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { createRoomAsset, updateRoomAsset } from '../../api/room-assets';
import type {
  RoomAsset,
  RoomAssetCondition,
  RoomAssetInput,
} from '../../types/inventory';
import type { Property } from '../../types/property';
import type { Unit } from '../../types/unit';
import { FormModal } from '../ui/FormModal';
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
  asset?: RoomAsset | null;
  properties: Property[];
  units: Unit[];
  canViewCosts: boolean;
  onClose: () => void;
  onSaved: () => void;
  onError: (message: string) => void;
};

export function RoomAssetFormModal({
  open,
  token,
  asset,
  properties,
  units,
  canViewCosts,
  onClose,
  onSaved,
  onError,
}: Props) {
  const [form, setForm] = useState<RoomAssetInput>({
    propertyId: '',
    unitId: '',
    itemName: '',
    quantity: 1,
    assignedDate: todayDate(),
    condition: 'GOOD',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (asset) {
      setForm({
        propertyId: asset.propertyId,
        unitId: asset.unitId,
        itemName: asset.itemName,
        category: asset.category ?? '',
        quantity: Number(asset.quantity),
        purchaseCost: Number(asset.purchaseCost ?? 0),
        assignedDate: asset.assignedDate.slice(0, 10),
        condition: asset.condition,
        serialNumber: asset.serialNumber ?? '',
        brand: asset.brand ?? '',
        model: asset.model ?? '',
        notes: asset.notes ?? '',
      });
    } else {
      setForm({
        propertyId: properties[0]?.id ?? '',
        unitId: '',
        itemName: '',
        category: '',
        quantity: 1,
        purchaseCost: 0,
        assignedDate: todayDate(),
        condition: 'GOOD',
        serialNumber: '',
        brand: '',
        model: '',
        notes: '',
      });
    }
  }, [open, asset, properties]);

  const filteredUnits = useMemo(
    () => units.filter((u) => u.propertyId === form.propertyId),
    [units, form.propertyId],
  );

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    if (!form.propertyId || !form.unitId || !form.itemName.trim()) {
      onError('Property, unit and item name are required.');
      return;
    }
    if (Number(form.quantity) <= 0) {
      onError('Quantity must be greater than zero.');
      return;
    }
    if (Number(form.purchaseCost ?? 0) < 0) {
      onError('Cost cannot be negative.');
      return;
    }

    const payload: RoomAssetInput = {
      propertyId: form.propertyId,
      unitId: form.unitId,
      itemName: form.itemName.trim(),
      category: form.category?.trim() || undefined,
      quantity: Number(form.quantity),
      purchaseCost: canViewCosts ? Number(form.purchaseCost) || 0 : undefined,
      assignedDate: form.assignedDate,
      condition: form.condition,
      serialNumber: form.serialNumber?.trim() || undefined,
      brand: form.brand?.trim() || undefined,
      model: form.model?.trim() || undefined,
      notes: form.notes?.trim() || undefined,
    };

    setSaving(true);
    try {
      if (asset) {
        await updateRoomAsset(token, asset.id, payload);
      } else {
        await createRoomAsset(token, payload);
      }
      onSaved();
      onClose();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Unable to save room asset');
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormModal
      open={open}
      title={asset ? 'Edit Room Asset' : 'Add Room Asset'}
      onClose={onClose}
    >
      <form className="form-grid" onSubmit={handleSubmit}>
      <label className="form-field">
        <span>Property</span>
        <select
          value={form.propertyId}
          onChange={(e) =>
            setForm((p) => ({
              ...p,
              propertyId: e.target.value,
              unitId: '',
            }))
          }
          required
        >
          <option value="">Select property</option>
          {properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <label className="form-field">
        <span>Unit</span>
        <select
          value={form.unitId}
          onChange={(e) => setForm((p) => ({ ...p, unitId: e.target.value }))}
          required
        >
          <option value="">Select unit</option>
          {filteredUnits.map((u) => (
            <option key={u.id} value={u.id}>
              {u.unitNumber}
            </option>
          ))}
        </select>
      </label>
      <label className="form-field">
        <span>Item Name</span>
        <input
          value={form.itemName}
          onChange={(e) =>
            setForm((p) => ({ ...p, itemName: e.target.value }))
          }
          required
        />
      </label>
      <label className="form-field">
        <span>Category</span>
        <input
          value={form.category ?? ''}
          onChange={(e) =>
            setForm((p) => ({ ...p, category: e.target.value }))
          }
          placeholder="Furniture, Appliances…"
        />
      </label>
      <div className="form-grid form-grid--2">
        <label className="form-field">
          <span>Quantity</span>
          <input
            type="number"
            min={0.001}
            step="0.001"
            value={form.quantity}
            onChange={(e) =>
              setForm((p) => ({ ...p, quantity: Number(e.target.value) }))
            }
            required
          />
        </label>
        {canViewCosts ? (
          <label className="form-field">
            <span>Purchase Cost</span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={form.purchaseCost ?? 0}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  purchaseCost: Number(e.target.value),
                }))
              }
            />
          </label>
        ) : null}
      </div>
      <div className="form-grid form-grid--2">
        <label className="form-field">
          <span>Assigned Date</span>
          <input
            type="date"
            value={form.assignedDate}
            onChange={(e) =>
              setForm((p) => ({ ...p, assignedDate: e.target.value }))
            }
            required
          />
        </label>
        <label className="form-field">
          <span>Condition</span>
          <select
            value={form.condition}
            onChange={(e) =>
              setForm((p) => ({
                ...p,
                condition: e.target.value as RoomAssetCondition,
              }))
            }
          >
            {CONDITIONS.map((c) => (
              <option key={c} value={c}>
                {c.replaceAll('_', ' ')}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="form-grid form-grid--2">
        <label className="form-field">
          <span>Serial Number</span>
          <input
            value={form.serialNumber ?? ''}
            onChange={(e) =>
              setForm((p) => ({ ...p, serialNumber: e.target.value }))
            }
          />
        </label>
        <label className="form-field">
          <span>Brand</span>
          <input
            value={form.brand ?? ''}
            onChange={(e) => setForm((p) => ({ ...p, brand: e.target.value }))}
          />
        </label>
      </div>
      <label className="form-field">
        <span>Model</span>
        <input
          value={form.model ?? ''}
          onChange={(e) => setForm((p) => ({ ...p, model: e.target.value }))}
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
        <div className="form-actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save Asset'}
          </button>
        </div>
      </form>
    </FormModal>
  );
}
