import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { purchaseStock } from '../../api/inventory-movements';
import { formatPkr } from '../../lib/format';
import type { InventoryItem, PurchaseMovementInput } from '../../types/inventory';
import type { Property } from '../../types/property';
import { FormModal } from '../ui/FormModal';
import '../../styles/forms.css';

function todayDate() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

type Props = {
  open: boolean;
  token: string;
  items: InventoryItem[];
  properties: Property[];
  presetItemId?: string;
  canViewCosts: boolean;
  onClose: () => void;
  onSaved: () => void;
  onError: (message: string) => void;
};

export function PurchaseStockFormModal({
  open,
  token,
  items,
  properties,
  presetItemId,
  canViewCosts,
  onClose,
  onSaved,
  onError,
}: Props) {
  const [form, setForm] = useState<PurchaseMovementInput>({
    itemId: '',
    quantity: 1,
    unitCost: 0,
    movementDate: todayDate(),
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({
      itemId: presetItemId || items[0]?.id || '',
      quantity: 1,
      unitCost: 0,
      movementDate: todayDate(),
      supplierName: '',
      referenceNumber: '',
      propertyId: '',
      notes: '',
    });
  }, [open, presetItemId, items]);

  const selected = useMemo(
    () => items.find((i) => i.id === form.itemId),
    [items, form.itemId],
  );
  const total = Number(form.quantity || 0) * Number(form.unitCost || 0);
  const expectedQty =
    Number(selected?.currentQuantity ?? 0) + Number(form.quantity || 0);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    if (!form.itemId || Number(form.quantity) <= 0) {
      onError('Select an item and enter a quantity greater than zero.');
      return;
    }
    setSaving(true);
    try {
      await purchaseStock(token, {
        ...form,
        quantity: Number(form.quantity),
        unitCost: Number(form.unitCost),
        supplierName: form.supplierName?.trim() || undefined,
        referenceNumber: form.referenceNumber?.trim() || undefined,
        propertyId: form.propertyId || undefined,
        notes: form.notes?.trim() || undefined,
      });
      onSaved();
      onClose();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Unable to record purchase');
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormModal open={open} title="Purchase Stock" onClose={onClose}>
      <form className="form-grid" onSubmit={handleSubmit}>
        <label className="form-field">
          <span>Item</span>
          <select
            value={form.itemId}
            onChange={(e) => setForm((p) => ({ ...p, itemId: e.target.value }))}
            required
          >
            <option value="">Select item</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.itemCode} — {item.name}
              </option>
            ))}
          </select>
        </label>
        {selected ? (
          <p className="form-hint">
            Current qty: <strong>{selected.currentQuantity}</strong>
            {canViewCosts && selected.averageUnitCost != null ? (
              <>
                {' '}
                · Avg cost:{' '}
                <strong>{formatPkr(Number(selected.averageUnitCost))}</strong>
              </>
            ) : null}
          </p>
        ) : null}
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
          <label className="form-field">
            <span>Unit Cost</span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={form.unitCost}
              onChange={(e) =>
                setForm((p) => ({ ...p, unitCost: Number(e.target.value) }))
              }
              required
            />
          </label>
        </div>
        <label className="form-field">
          <span>Purchase Date</span>
          <input
            type="date"
            value={form.movementDate}
            onChange={(e) =>
              setForm((p) => ({ ...p, movementDate: e.target.value }))
            }
            required
          />
        </label>
        <label className="form-field">
          <span>Supplier</span>
          <input
            value={form.supplierName ?? ''}
            onChange={(e) =>
              setForm((p) => ({ ...p, supplierName: e.target.value }))
            }
          />
        </label>
        <label className="form-field">
          <span>Reference Number</span>
          <input
            value={form.referenceNumber ?? ''}
            onChange={(e) =>
              setForm((p) => ({ ...p, referenceNumber: e.target.value }))
            }
          />
        </label>
        <label className="form-field">
          <span>Property (optional)</span>
          <select
            value={form.propertyId ?? ''}
            onChange={(e) =>
              setForm((p) => ({ ...p, propertyId: e.target.value }))
            }
          >
            <option value="">None</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
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
          Purchase total: <strong>{formatPkr(total)}</strong> · Expected qty:{' '}
          <strong>{expectedQty}</strong>
        </p>
        <div className="form-actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving ? 'Saving…' : 'Record Purchase'}
          </button>
        </div>
      </form>
    </FormModal>
  );
}
