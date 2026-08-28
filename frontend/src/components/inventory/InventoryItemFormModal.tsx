import { useEffect, useState, type FormEvent } from 'react';
import {
  createInventoryItem,
  updateInventoryItem,
} from '../../api/inventory-items';
import type {
  InventoryCategory,
  InventoryItem,
  InventoryItemInput,
} from '../../types/inventory';
import { FormModal } from '../ui/FormModal';
import '../../styles/forms.css';

type Props = {
  open: boolean;
  token: string;
  item?: InventoryItem | null;
  categories: InventoryCategory[];
  onClose: () => void;
  onSaved: () => void;
  onError: (message: string) => void;
};

const empty: InventoryItemInput = {
  name: '',
  categoryId: '',
  unitOfMeasure: 'pcs',
  openingQuantity: 0,
  openingUnitCost: 0,
  reorderLevel: 0,
  isConsumable: true,
};

export function InventoryItemFormModal({
  open,
  token,
  item,
  categories,
  onClose,
  onSaved,
  onError,
}: Props) {
  const [form, setForm] = useState<InventoryItemInput>(empty);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (item) {
      setForm({
        name: item.name,
        categoryId: item.categoryId,
        description: item.description ?? '',
        unitOfMeasure: item.unitOfMeasure,
        reorderLevel: Number(item.reorderLevel),
        supplierName: item.supplierName ?? '',
        isConsumable: item.isConsumable,
      });
    } else {
      setForm({ ...empty, categoryId: categories[0]?.id ?? '' });
    }
  }, [open, item, categories]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    if (!form.name.trim() || !form.categoryId || !form.unitOfMeasure.trim()) {
      onError('Item name, category and unit of measure are required.');
      return;
    }
    setSaving(true);
    try {
      if (item) {
        await updateInventoryItem(token, item.id, {
          name: form.name.trim(),
          categoryId: form.categoryId,
          description: form.description?.trim() || undefined,
          unitOfMeasure: form.unitOfMeasure.trim(),
          reorderLevel: Number(form.reorderLevel) || 0,
          supplierName: form.supplierName?.trim() || undefined,
          isConsumable: form.isConsumable,
        });
      } else {
        await createInventoryItem(token, {
          name: form.name.trim(),
          categoryId: form.categoryId,
          description: form.description?.trim() || undefined,
          unitOfMeasure: form.unitOfMeasure.trim(),
          openingQuantity: Number(form.openingQuantity) || 0,
          openingUnitCost: Number(form.openingUnitCost) || 0,
          reorderLevel: Number(form.reorderLevel) || 0,
          supplierName: form.supplierName?.trim() || undefined,
          isConsumable: form.isConsumable ?? true,
        });
      }
      onSaved();
      onClose();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Unable to save item');
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormModal
      open={open}
      title={item ? 'Edit Inventory Item' : 'Add Inventory Item'}
      onClose={onClose}
    >
      <form className="form-grid" onSubmit={handleSubmit}>
        <label className="form-field">
          <span>Item Name</span>
          <input
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            required
          />
        </label>
        <label className="form-field">
          <span>Category</span>
          <select
            value={form.categoryId}
            onChange={(e) =>
              setForm((p) => ({ ...p, categoryId: e.target.value }))
            }
            required
          >
            <option value="">Select category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="form-field">
          <span>Description</span>
          <textarea
            value={form.description ?? ''}
            onChange={(e) =>
              setForm((p) => ({ ...p, description: e.target.value }))
            }
            rows={2}
          />
        </label>
        <div className="form-grid form-grid--2">
          <label className="form-field">
            <span>Unit of Measure</span>
            <input
              value={form.unitOfMeasure}
              onChange={(e) =>
                setForm((p) => ({ ...p, unitOfMeasure: e.target.value }))
              }
              required
            />
          </label>
          <label className="form-field">
            <span>Reorder Level</span>
            <input
              type="number"
              min={0}
              step="0.001"
              value={form.reorderLevel ?? 0}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  reorderLevel: Number(e.target.value),
                }))
              }
            />
          </label>
        </div>
        {!item ? (
          <div className="form-grid form-grid--2">
            <label className="form-field">
              <span>Opening Quantity</span>
              <input
                type="number"
                min={0}
                step="0.001"
                value={form.openingQuantity ?? 0}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    openingQuantity: Number(e.target.value),
                  }))
                }
              />
            </label>
            <label className="form-field">
              <span>Opening Unit Cost</span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.openingUnitCost ?? 0}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    openingUnitCost: Number(e.target.value),
                  }))
                }
              />
            </label>
          </div>
        ) : null}
        <label className="form-field">
          <span>Supplier Name</span>
          <input
            value={form.supplierName ?? ''}
            onChange={(e) =>
              setForm((p) => ({ ...p, supplierName: e.target.value }))
            }
          />
        </label>
        <label className="form-field form-field--inline">
          <input
            type="checkbox"
            checked={form.isConsumable ?? true}
            onChange={(e) =>
              setForm((p) => ({ ...p, isConsumable: e.target.checked }))
            }
          />
          <span>Consumable item</span>
        </label>
        {!item ? (
          <p className="form-hint">
            Opening stock creates a PURCHASE movement so inventory history stays
            auditable.
          </p>
        ) : null}
        <div className="form-actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save Item'}
          </button>
        </div>
      </form>
    </FormModal>
  );
}
