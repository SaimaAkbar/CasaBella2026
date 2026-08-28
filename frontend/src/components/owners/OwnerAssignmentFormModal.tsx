import { useEffect, useState, type FormEvent } from 'react';
import { createOwnerAssignment, updateOwnerAssignment } from '../../api/owners';
import { fetchUnits } from '../../api/units';
import { FormModal } from '../ui/FormModal';
import type { Property } from '../../types/property';
import type { Unit } from '../../types/unit';
import type {
  Owner,
  OwnerAccountDirection,
  OwnerUnitAssignment,
  OwnerUnitAssignmentInput,
} from '../../types/owner';
import '../../styles/forms.css';

type Props = {
  open: boolean;
  token: string;
  owners: Owner[];
  properties: Property[];
  initial?: OwnerUnitAssignment | null;
  presetOwnerId?: string;
  presetPropertyId?: string;
  presetUnitId?: string;
  onClose: () => void;
  onSaved: () => void;
  onError: (message: string) => void;
};

export function OwnerAssignmentFormModal({
  open,
  token,
  owners,
  properties,
  initial,
  presetOwnerId,
  presetPropertyId,
  presetUnitId,
  onClose,
  onSaved,
  onError,
}: Props) {
  const [ownerId, setOwnerId] = useState('');
  const [propertyId, setPropertyId] = useState('');
  const [unitId, setUnitId] = useState('');
  const [units, setUnits] = useState<Unit[]>([]);
  const [accountDirection, setAccountDirection] =
    useState<OwnerAccountDirection>('RECEIVABLE_FROM_OWNER');
  const [ownershipPercentage, setOwnershipPercentage] = useState('50');
  const [fixedMonthlyAmount, setFixedMonthlyAmount] = useState('0');
  const [agreementStart, setAgreementStart] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [agreementEnd, setAgreementEnd] = useState('');
  const [dueDay, setDueDay] = useState('15');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setOwnerId(initial.ownerId);
      setPropertyId(initial.propertyId);
      setUnitId(initial.unitId);
      setAccountDirection(initial.accountDirection);
      setOwnershipPercentage(initial.ownershipPercentage);
      setFixedMonthlyAmount(initial.fixedMonthlyAmount);
      setAgreementStart(initial.agreementStart.slice(0, 10));
      setAgreementEnd(initial.agreementEnd?.slice(0, 10) ?? '');
      setDueDay(String(initial.dueDay));
      setNotes(initial.notes ?? '');
    } else {
      setOwnerId(presetOwnerId ?? '');
      setPropertyId(presetPropertyId ?? '');
      setUnitId(presetUnitId ?? '');
      setAccountDirection('RECEIVABLE_FROM_OWNER');
      setOwnershipPercentage('50');
      setFixedMonthlyAmount('0');
      setAgreementStart(new Date().toISOString().slice(0, 10));
      setAgreementEnd('');
      setDueDay('15');
      setNotes('');
    }
  }, [open, initial, presetOwnerId, presetPropertyId, presetUnitId]);

  useEffect(() => {
    if (!open || !propertyId) {
      setUnits([]);
      return;
    }
    void fetchUnits(token, { propertyId, isActive: true })
      .then((rows) => {
        setUnits(rows);
        setUnitId((current) =>
          current && rows.some((u) => u.id === current) ? current : '',
        );
      })
      .catch((err) =>
        onError(err instanceof Error ? err.message : 'Unable to load units'),
      );
  }, [open, token, propertyId, onError]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      if (initial) {
        const unitChanged =
          unitId !== initial.unitId || propertyId !== initial.propertyId;
        await updateOwnerAssignment(token, initial.id, {
          accountDirection,
          agreementStart,
          agreementEnd: agreementEnd || null,
          dueDay: Number(dueDay),
          notes: notes.trim() || undefined,
          ...(unitChanged
            ? { newUnitId: unitId, newPropertyId: propertyId }
            : {}),
        });
      } else {
        const payload: OwnerUnitAssignmentInput = {
          ownerId,
          propertyId,
          unitId,
          accountDirection,
          ownershipPercentage: Number(ownershipPercentage),
          fixedMonthlyAmount: Number(fixedMonthlyAmount),
          agreementStart,
          agreementEnd: agreementEnd || undefined,
          dueDay: Number(dueDay),
          notes: notes.trim() || undefined,
        };
        await createOwnerAssignment(token, payload);
      }
      onSaved();
      onClose();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Unable to save assignment');
    } finally {
      setBusy(false);
    }
  }

  return (
    <FormModal
      open={open}
      title={initial ? 'Edit Assignment' : 'Assign Owner to Unit'}
      onClose={onClose}
    >
      <form className="form-grid" onSubmit={onSubmit}>
        <div className="form-grid form-grid--2">
          <label className="form-field">
            <span>Owner</span>
            <select
              required
              disabled={Boolean(initial)}
              value={ownerId}
              onChange={(e) => setOwnerId(e.target.value)}
            >
              <option value="">Select owner</option>
              {owners.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.fullName}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>Account Direction</span>
            <select
              value={accountDirection}
              onChange={(e) =>
                setAccountDirection(e.target.value as OwnerAccountDirection)
              }
            >
              <option value="RECEIVABLE_FROM_OWNER">
                Receivable from owner
              </option>
              <option value="PAYABLE_TO_OWNER">Payable to owner</option>
            </select>
          </label>
          <label className="form-field">
            <span>Property</span>
            <select
              required
              value={propertyId}
              onChange={(e) => {
                setPropertyId(e.target.value);
                setUnitId('');
              }}
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
              required
              disabled={!propertyId}
              value={unitId}
              onChange={(e) => setUnitId(e.target.value)}
            >
              <option value="">
                {propertyId ? 'Select unit' : 'Select property first'}
              </option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.unitNumber}
                  {u.floor != null ? ` (Floor ${u.floor})` : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>Ownership %</span>
            <input
              type="number"
              min={0}
              max={100}
              step="0.01"
              disabled={Boolean(initial)}
              value={ownershipPercentage}
              onChange={(e) => setOwnershipPercentage(e.target.value)}
            />
          </label>
          <label className="form-field">
            <span>Fixed Monthly Amount (PKR)</span>
            <input
              required
              type="number"
              min={0}
              step="0.01"
              disabled={Boolean(initial)}
              value={fixedMonthlyAmount}
              onChange={(e) => setFixedMonthlyAmount(e.target.value)}
            />
          </label>
          {initial ? (
            <p className="form-field form-field--full form-hint">
              Amount and ownership % changes require Super Admin revise (with
              effective date and reason). Unit change ends this agreement and
              starts a new one without transferring statement history.
            </p>
          ) : null}
          <label className="form-field">
            <span>Agreement Start</span>
            <input
              required
              type="date"
              value={agreementStart}
              onChange={(e) => setAgreementStart(e.target.value)}
            />
          </label>
          <label className="form-field">
            <span>Agreement End</span>
            <input
              type="date"
              value={agreementEnd}
              onChange={(e) => setAgreementEnd(e.target.value)}
            />
          </label>
          <label className="form-field">
            <span>Due Day (1–28)</span>
            <input
              type="number"
              min={1}
              max={28}
              value={dueDay}
              onChange={(e) => setDueDay(e.target.value)}
            />
          </label>
          <label className="form-field form-field--full">
            <span>Notes</span>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
        </div>
        <div className="form-actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={busy}>
            {busy ? 'Saving…' : initial ? 'Save Assignment' : 'Create Assignment'}
          </button>
        </div>
      </form>
    </FormModal>
  );
}
