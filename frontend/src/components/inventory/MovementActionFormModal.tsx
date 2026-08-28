import { useEffect, useState, type FormEvent } from 'react';
import {
  adjustStock,
  damageStock,
  lossStock,
  returnStock,
  transferStock,
} from '../../api/inventory-movements';
import type {
  AdjustMovementInput,
  DamageOrLossMovementInput,
  InventoryItem,
  ReturnMovementInput,
  TransferMovementInput,
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

export type MovementActionMode =
  | 'return'
  | 'transfer'
  | 'adjust'
  | 'damage'
  | 'loss';

type Props = {
  open: boolean;
  token: string;
  mode: MovementActionMode | null;
  items: InventoryItem[];
  properties: Property[];
  units: Unit[];
  presetItemId?: string;
  onClose: () => void;
  onSaved: () => void;
  onError: (message: string) => void;
};

const TITLES: Record<MovementActionMode, string> = {
  return: 'Return Item',
  transfer: 'Transfer Stock',
  adjust: 'Adjust Stock',
  damage: 'Record Damage',
  loss: 'Record Loss',
};

export function MovementActionFormModal({
  open,
  token,
  mode,
  items,
  properties,
  units,
  presetItemId,
  onClose,
  onSaved,
  onError,
}: Props) {
  const [itemId, setItemId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [movementDate, setMovementDate] = useState(todayDate());
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [sourcePropertyId, setSourcePropertyId] = useState('');
  const [sourceUnitId, setSourceUnitId] = useState('');
  const [destinationPropertyId, setDestinationPropertyId] = useState('');
  const [destinationUnitId, setDestinationUnitId] = useState('');
  const [propertyId, setPropertyId] = useState('');
  const [unitId, setUnitId] = useState('');
  const [replacementCost, setReplacementCost] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !mode) return;
    setItemId(presetItemId || items[0]?.id || '');
    setQuantity(mode === 'adjust' ? 0 : 1);
    setMovementDate(todayDate());
    setReason('');
    setNotes('');
    setReferenceNumber('');
    setSourcePropertyId('');
    setSourceUnitId('');
    setDestinationPropertyId('');
    setDestinationUnitId('');
    setPropertyId('');
    setUnitId('');
    setReplacementCost(0);
  }, [open, mode, presetItemId, items]);

  if (!mode) return null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (saving || !mode) return;
    if (!itemId) {
      onError('Select an item.');
      return;
    }
    if (mode !== 'adjust' && Number(quantity) <= 0) {
      onError('Quantity must be greater than zero.');
      return;
    }
    if (!reason.trim() || reason.trim().length < 3) {
      onError('A reason of at least 3 characters is required.');
      return;
    }

    setSaving(true);
    try {
      if (mode === 'return') {
        const payload: ReturnMovementInput = {
          itemId,
          quantity: Number(quantity),
          movementDate,
          reason: reason.trim(),
          notes: notes.trim() || undefined,
          referenceNumber: referenceNumber.trim() || undefined,
          sourcePropertyId: sourcePropertyId || undefined,
          sourceUnitId: sourceUnitId || undefined,
        };
        await returnStock(token, payload);
      } else if (mode === 'transfer') {
        if (!sourcePropertyId || !destinationPropertyId) {
          onError('Source and destination properties are required.');
          setSaving(false);
          return;
        }
        const payload: TransferMovementInput = {
          itemId,
          quantity: Number(quantity),
          movementDate,
          sourcePropertyId,
          sourceUnitId: sourceUnitId || undefined,
          destinationPropertyId,
          destinationUnitId: destinationUnitId || undefined,
          reason: reason.trim(),
          notes: notes.trim() || undefined,
        };
        await transferStock(token, payload);
      } else if (mode === 'adjust') {
        const payload: AdjustMovementInput = {
          itemId,
          quantity: Number(quantity),
          movementDate,
          reason: reason.trim(),
          notes: notes.trim() || undefined,
        };
        await adjustStock(token, payload);
      } else {
        const payload: DamageOrLossMovementInput = {
          itemId,
          quantity: Number(quantity),
          movementDate,
          propertyId: propertyId || undefined,
          unitId: unitId || undefined,
          reason: reason.trim(),
          replacementCost: Number(replacementCost) || undefined,
          notes: notes.trim() || undefined,
        };
        if (mode === 'damage') await damageStock(token, payload);
        else await lossStock(token, payload);
      }
      onSaved();
      onClose();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Unable to record movement');
    } finally {
      setSaving(false);
    }
  }

  const sourceUnits = units.filter(
    (u) => !sourcePropertyId || u.propertyId === sourcePropertyId,
  );
  const destUnits = units.filter(
    (u) => !destinationPropertyId || u.propertyId === destinationPropertyId,
  );
  const scopedUnits = units.filter(
    (u) => !propertyId || u.propertyId === propertyId,
  );

  return (
    <FormModal open={open} title={TITLES[mode]} onClose={onClose}>
      <form className="form-grid" onSubmit={handleSubmit}>
      {mode === 'loss' ? (
        <p className="form-hint">
          Loss requires Super Admin approval and is recorded permanently.
        </p>
      ) : null}
      <label className="form-field">
        <span>Item</span>
        <select
          value={itemId}
          onChange={(e) => setItemId(e.target.value)}
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
      <div className="form-grid form-grid--2">
        <label className="form-field">
          <span>
            {mode === 'adjust' ? 'Quantity (+/-)' : 'Quantity'}
          </span>
          <input
            type="number"
            step="0.001"
            min={mode === 'adjust' ? undefined : 0.001}
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            required
          />
        </label>
        <label className="form-field">
          <span>Date</span>
          <input
            type="date"
            value={movementDate}
            onChange={(e) => setMovementDate(e.target.value)}
            required
          />
        </label>
      </div>

      {mode === 'return' || mode === 'transfer' ? (
        <>
          <label className="form-field">
            <span>{mode === 'transfer' ? 'Source Property' : 'Property'}</span>
            <select
              value={sourcePropertyId}
              onChange={(e) => {
                setSourcePropertyId(e.target.value);
                setSourceUnitId('');
              }}
              required={mode === 'transfer'}
            >
              <option value="">Select</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>{mode === 'transfer' ? 'Source Unit' : 'Unit'}</span>
            <select
              value={sourceUnitId}
              onChange={(e) => setSourceUnitId(e.target.value)}
            >
              <option value="">Optional</option>
              {sourceUnits.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.unitNumber}
                </option>
              ))}
            </select>
          </label>
        </>
      ) : null}

      {mode === 'transfer' ? (
        <>
          <label className="form-field">
            <span>Destination Property</span>
            <select
              value={destinationPropertyId}
              onChange={(e) => {
                setDestinationPropertyId(e.target.value);
                setDestinationUnitId('');
              }}
              required
            >
              <option value="">Select</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>Destination Unit</span>
            <select
              value={destinationUnitId}
              onChange={(e) => setDestinationUnitId(e.target.value)}
            >
              <option value="">Optional</option>
              {destUnits.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.unitNumber}
                </option>
              ))}
            </select>
          </label>
        </>
      ) : null}

      {(mode === 'damage' || mode === 'loss') && (
        <>
          <label className="form-field">
            <span>Property</span>
            <select
              value={propertyId}
              onChange={(e) => {
                setPropertyId(e.target.value);
                setUnitId('');
              }}
            >
              <option value="">Optional</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>Unit</span>
            <select value={unitId} onChange={(e) => setUnitId(e.target.value)}>
              <option value="">Optional</option>
              {scopedUnits.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.unitNumber}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>Replacement Cost</span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={replacementCost}
              onChange={(e) => setReplacementCost(Number(e.target.value))}
            />
          </label>
        </>
      )}

      {mode === 'return' ? (
        <label className="form-field">
          <span>Original Reference</span>
          <input
            value={referenceNumber}
            onChange={(e) => setReferenceNumber(e.target.value)}
          />
        </label>
      ) : null}

      <label className="form-field">
        <span>Reason</span>
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          required
        />
      </label>
      <label className="form-field">
        <span>Notes</span>
        <textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </label>
        <div className="form-actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </FormModal>
  );
}
