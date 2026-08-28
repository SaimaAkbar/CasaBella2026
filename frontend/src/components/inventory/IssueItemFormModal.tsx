import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { issueStock } from '../../api/inventory-movements';
import { formatPkr } from '../../lib/format';
import type { Booking } from '../../types/booking';
import type { Employee } from '../../types/employee';
import type { InventoryItem, IssueMovementInput } from '../../types/inventory';
import type { MonthlyTenancy } from '../../types/monthly-tenancy';
import type { Property } from '../../types/property';
import type { Unit } from '../../types/unit';
import { FormModal } from '../ui/FormModal';
import '../../styles/forms.css';

function todayDate() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

type IssueTarget =
  | 'PROPERTY'
  | 'UNIT'
  | 'BOOKING'
  | 'MONTHLY_TENANCY'
  | 'EMPLOYEE';

type Props = {
  open: boolean;
  token: string;
  items: InventoryItem[];
  properties: Property[];
  units: Unit[];
  bookings: Booking[];
  tenancies: MonthlyTenancy[];
  employees: Employee[];
  presetItemId?: string;
  canViewCosts: boolean;
  onClose: () => void;
  onSaved: () => void;
  onError: (message: string) => void;
};

export function IssueItemFormModal({
  open,
  token,
  items,
  properties,
  units,
  bookings,
  tenancies,
  employees,
  presetItemId,
  canViewCosts,
  onClose,
  onSaved,
  onError,
}: Props) {
  const stocked = useMemo(
    () => items.filter((i) => i.isActive && Number(i.currentQuantity) > 0),
    [items],
  );
  const [target, setTarget] = useState<IssueTarget>('UNIT');
  const [form, setForm] = useState<IssueMovementInput>({
    itemId: '',
    quantity: 1,
    movementDate: todayDate(),
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTarget('UNIT');
    setForm({
      itemId: presetItemId || stocked[0]?.id || '',
      quantity: 1,
      movementDate: todayDate(),
      destinationPropertyId: '',
      destinationUnitId: '',
      bookingId: '',
      monthlyTenancyId: '',
      employeeId: '',
      reason: '',
      notes: '',
    });
  }, [open, presetItemId, stocked]);

  const selected = stocked.find((i) => i.id === form.itemId);
  const filteredUnits = units.filter(
    (u) =>
      !form.destinationPropertyId ||
      u.propertyId === form.destinationPropertyId,
  );
  const selectedUnit = units.find((u) => u.id === form.destinationUnitId);
  const issueCost =
    canViewCosts && selected?.averageUnitCost != null
      ? Number(form.quantity || 0) * Number(selected.averageUnitCost)
      : null;
  const showExpensePreview =
    Boolean(selected?.isConsumable) &&
    Boolean(form.destinationUnitId) &&
    issueCost != null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    if (!form.itemId || Number(form.quantity) <= 0) {
      onError('Select an item and enter a valid quantity.');
      return;
    }
    if (
      selected &&
      Number(form.quantity) > Number(selected.currentQuantity)
    ) {
      onError('Quantity cannot exceed available stock.');
      return;
    }

    const payload: IssueMovementInput = {
      itemId: form.itemId,
      quantity: Number(form.quantity),
      movementDate: form.movementDate,
      reason: form.reason?.trim() || undefined,
      notes: form.notes?.trim() || undefined,
    };

    if (target === 'PROPERTY' || target === 'UNIT') {
      payload.destinationPropertyId =
        form.destinationPropertyId || selectedUnit?.propertyId || undefined;
      if (target === 'UNIT') {
        payload.destinationUnitId = form.destinationUnitId || undefined;
      }
    } else if (target === 'BOOKING') {
      payload.bookingId = form.bookingId || undefined;
    } else if (target === 'MONTHLY_TENANCY') {
      payload.monthlyTenancyId = form.monthlyTenancyId || undefined;
    } else if (target === 'EMPLOYEE') {
      payload.employeeId = form.employeeId || undefined;
    }

    setSaving(true);
    try {
      await issueStock(token, payload);
      onSaved();
      onClose();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Unable to issue item');
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormModal open={open} title="Issue Item" onClose={onClose}>
      <form className="form-grid" onSubmit={handleSubmit}>
        <label className="form-field">
          <span>Item (in stock)</span>
          <select
            value={form.itemId}
            onChange={(e) => setForm((p) => ({ ...p, itemId: e.target.value }))}
            required
          >
            <option value="">Select item</option>
            {stocked.map((item) => (
              <option key={item.id} value={item.id}>
                {item.itemCode} — {item.name} ({item.currentQuantity}{' '}
                {item.unitOfMeasure})
              </option>
            ))}
          </select>
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
          <label className="form-field">
            <span>Issue Date</span>
            <input
              type="date"
              value={form.movementDate}
              onChange={(e) =>
                setForm((p) => ({ ...p, movementDate: e.target.value }))
              }
              required
            />
          </label>
        </div>
        <label className="form-field">
          <span>Issue To</span>
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value as IssueTarget)}
          >
            <option value="PROPERTY">Property</option>
            <option value="UNIT">Unit / Room</option>
            <option value="BOOKING">Booking</option>
            <option value="MONTHLY_TENANCY">Monthly Tenancy</option>
            <option value="EMPLOYEE">Employee</option>
          </select>
        </label>
        {(target === 'PROPERTY' || target === 'UNIT') && (
          <label className="form-field">
            <span>Property</span>
            <select
              value={form.destinationPropertyId ?? ''}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  destinationPropertyId: e.target.value,
                  destinationUnitId: '',
                }))
              }
            >
              <option value="">Select property</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {target === 'UNIT' && (
          <label className="form-field">
            <span>Unit</span>
            <select
              value={form.destinationUnitId ?? ''}
              onChange={(e) =>
                setForm((p) => ({ ...p, destinationUnitId: e.target.value }))
              }
            >
              <option value="">Select unit</option>
              {filteredUnits.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.unitNumber}
                </option>
              ))}
            </select>
          </label>
        )}
        {target === 'BOOKING' && (
          <label className="form-field">
            <span>Booking</span>
            <select
              value={form.bookingId ?? ''}
              onChange={(e) =>
                setForm((p) => ({ ...p, bookingId: e.target.value }))
              }
            >
              <option value="">Select booking</option>
              {bookings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.bookingNumber} — {b.guest?.fullName ?? 'Guest'}
                </option>
              ))}
            </select>
          </label>
        )}
        {target === 'MONTHLY_TENANCY' && (
          <label className="form-field">
            <span>Monthly Tenancy</span>
            <select
              value={form.monthlyTenancyId ?? ''}
              onChange={(e) =>
                setForm((p) => ({ ...p, monthlyTenancyId: e.target.value }))
              }
            >
              <option value="">Select tenancy</option>
              {tenancies.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.unit?.unitNumber ?? 'Unit'} —{' '}
                  {t.tenant?.fullName ?? 'Tenant'}
                </option>
              ))}
            </select>
          </label>
        )}
        {target === 'EMPLOYEE' && (
          <label className="form-field">
            <span>Employee</span>
            <select
              value={form.employeeId ?? ''}
              onChange={(e) =>
                setForm((p) => ({ ...p, employeeId: e.target.value }))
              }
            >
              <option value="">Select employee</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.employeeCode} — {e.fullName}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="form-field">
          <span>Reason</span>
          <input
            value={form.reason ?? ''}
            onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))}
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
        {issueCost != null ? (
          <p className="form-hint">
            Issue cost: <strong>{formatPkr(issueCost)}</strong>
          </p>
        ) : null}
        {showExpensePreview ? (
          <p className="form-hint">
            Linked room expense preview:{' '}
            <strong>
              {form.quantity} x {selected?.name} issued to Room{' '}
              {selectedUnit?.unitNumber}
            </strong>{' '}
            ({formatPkr(issueCost ?? 0)})
          </p>
        ) : null}
        <div className="form-actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving ? 'Issuing…' : 'Issue Item'}
          </button>
        </div>
      </form>
    </FormModal>
  );
}
