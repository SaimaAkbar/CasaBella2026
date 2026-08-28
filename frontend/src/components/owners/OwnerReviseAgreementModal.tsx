import { useEffect, useState, type FormEvent } from 'react';
import { reviseOwnerAssignment } from '../../api/owners';
import { FormModal } from '../ui/FormModal';
import type { OwnerUnitAssignment } from '../../types/owner';
import '../../styles/forms.css';

type Props = {
  open: boolean;
  token: string;
  assignment: OwnerUnitAssignment | null;
  onClose: () => void;
  onSaved: () => void;
  onError: (message: string) => void;
};

export function OwnerReviseAgreementModal({
  open,
  token,
  assignment,
  onClose,
  onSaved,
  onError,
}: Props) {
  const [newFixedMonthlyAmount, setNewFixedMonthlyAmount] = useState('');
  const [newOwnershipPercentage, setNewOwnershipPercentage] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !assignment) return;
    setNewFixedMonthlyAmount(assignment.fixedMonthlyAmount);
    setNewOwnershipPercentage(assignment.ownershipPercentage);
    setEffectiveFrom(new Date().toISOString().slice(0, 10));
    setReason('');
  }, [open, assignment]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!assignment) return;
    if (!reason.trim()) {
      onError('Revision reason is required');
      return;
    }
    setBusy(true);
    try {
      await reviseOwnerAssignment(token, assignment.id, {
        newFixedMonthlyAmount: Number(newFixedMonthlyAmount),
        newOwnershipPercentage: newOwnershipPercentage
          ? Number(newOwnershipPercentage)
          : undefined,
        effectiveFrom,
        reason: reason.trim(),
      });
      onSaved();
      onClose();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to revise agreement');
    } finally {
      setBusy(false);
    }
  }

  return (
    <FormModal
      open={open}
      title="Revise Agreement Amount"
      onClose={onClose}
    >
      <form className="form-grid" onSubmit={onSubmit}>
        <p className="form-hint">
          Existing monthly statements keep their original expected amount. The
          new amount applies from the effective date for newly generated
          statements. Super Admin only.
        </p>
        <label>
          Current monthly amount
          <input
            value={assignment?.fixedMonthlyAmount ?? ''}
            disabled
            readOnly
          />
        </label>
        <label>
          New monthly amount *
          <input
            type="number"
            min="0"
            step="0.01"
            required
            value={newFixedMonthlyAmount}
            onChange={(e) => setNewFixedMonthlyAmount(e.target.value)}
          />
        </label>
        <label>
          New ownership %
          <input
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={newOwnershipPercentage}
            onChange={(e) => setNewOwnershipPercentage(e.target.value)}
          />
        </label>
        <label>
          Effective from *
          <input
            type="date"
            required
            value={effectiveFrom}
            onChange={(e) => setEffectiveFrom(e.target.value)}
          />
        </label>
        <label className="form-grid__full">
          Reason *
          <textarea
            required
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why is the agreed amount changing?"
          />
        </label>
        <div className="form-actions form-grid__full">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={busy}>
            {busy ? 'Saving…' : 'Create Revision'}
          </button>
        </div>
      </form>
    </FormModal>
  );
}
