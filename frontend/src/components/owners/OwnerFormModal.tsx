import { useEffect, useState, type FormEvent } from 'react';
import { createOwner, updateOwner } from '../../api/owners';
import { FormModal } from '../ui/FormModal';
import type { Owner, OwnerInput } from '../../types/owner';
import '../../styles/forms.css';

type Props = {
  open: boolean;
  token: string;
  initial?: Owner | null;
  onClose: () => void;
  onSaved: () => void;
  onError: (message: string) => void;
};

const empty: OwnerInput = {
  fullName: '',
  phone: '',
};

export function OwnerFormModal({
  open,
  token,
  initial,
  onClose,
  onSaved,
  onError,
}: Props) {
  const [form, setForm] = useState<OwnerInput>(empty);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setForm({
        fullName: initial.fullName,
        phone: initial.phone,
        fatherOrSpouseName: initial.fatherOrSpouseName ?? '',
        alternatePhone: initial.alternatePhone ?? '',
        email: initial.email ?? '',
        cnic: initial.cnic ?? '',
        address: initial.address ?? '',
        city: initial.city ?? '',
        bankName: initial.bankName ?? '',
        accountTitle: initial.accountTitle ?? '',
        accountNumberOrIban: initial.accountNumberOrIban ?? '',
        branchName: initial.branchName ?? '',
        notes: initial.notes ?? '',
      });
    } else {
      setForm(empty);
    }
  }, [open, initial]);

  function set<K extends keyof OwnerInput>(key: K, value: OwnerInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const payload: OwnerInput = {
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
        fatherOrSpouseName: form.fatherOrSpouseName?.trim() || undefined,
        alternatePhone: form.alternatePhone?.trim() || undefined,
        email: form.email?.trim() || undefined,
        cnic: form.cnic?.trim() || undefined,
        address: form.address?.trim() || undefined,
        city: form.city?.trim() || undefined,
        bankName: form.bankName?.trim() || undefined,
        accountTitle: form.accountTitle?.trim() || undefined,
        accountNumberOrIban: form.accountNumberOrIban?.trim() || undefined,
        branchName: form.branchName?.trim() || undefined,
        notes: form.notes?.trim() || undefined,
      };
      if (initial) {
        await updateOwner(token, initial.id, payload);
      } else {
        await createOwner(token, payload);
      }
      onSaved();
      onClose();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Unable to save owner');
    } finally {
      setBusy(false);
    }
  }

  return (
    <FormModal
      open={open}
      title={initial ? 'Edit Owner' : 'Add Owner'}
      onClose={onClose}
    >
      <form className="form-grid" onSubmit={onSubmit}>
        <div className="form-grid form-grid--2">
          <label className="form-field">
            <span>Full Name</span>
            <input
              required
              value={form.fullName}
              onChange={(e) => set('fullName', e.target.value)}
            />
          </label>
          <label className="form-field">
            <span>Phone</span>
            <input
              required
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
            />
          </label>
          <label className="form-field">
            <span>Father / Spouse</span>
            <input
              value={form.fatherOrSpouseName ?? ''}
              onChange={(e) => set('fatherOrSpouseName', e.target.value)}
            />
          </label>
          <label className="form-field">
            <span>Alternate Phone</span>
            <input
              value={form.alternatePhone ?? ''}
              onChange={(e) => set('alternatePhone', e.target.value)}
            />
          </label>
          <label className="form-field">
            <span>Email</span>
            <input
              type="email"
              value={form.email ?? ''}
              onChange={(e) => set('email', e.target.value)}
            />
          </label>
          <label className="form-field">
            <span>CNIC</span>
            <input
              value={form.cnic ?? ''}
              onChange={(e) => set('cnic', e.target.value)}
            />
          </label>
          <label className="form-field form-field--full">
            <span>Address</span>
            <input
              value={form.address ?? ''}
              onChange={(e) => set('address', e.target.value)}
            />
          </label>
          <label className="form-field">
            <span>City</span>
            <input
              value={form.city ?? ''}
              onChange={(e) => set('city', e.target.value)}
            />
          </label>
          <label className="form-field">
            <span>Bank Name</span>
            <input
              value={form.bankName ?? ''}
              onChange={(e) => set('bankName', e.target.value)}
            />
          </label>
          <label className="form-field">
            <span>Account Title</span>
            <input
              value={form.accountTitle ?? ''}
              onChange={(e) => set('accountTitle', e.target.value)}
            />
          </label>
          <label className="form-field">
            <span>Account / IBAN</span>
            <input
              value={form.accountNumberOrIban ?? ''}
              onChange={(e) => set('accountNumberOrIban', e.target.value)}
            />
          </label>
          <label className="form-field">
            <span>Branch</span>
            <input
              value={form.branchName ?? ''}
              onChange={(e) => set('branchName', e.target.value)}
            />
          </label>
          <label className="form-field form-field--full">
            <span>Notes</span>
            <textarea
              rows={2}
              value={form.notes ?? ''}
              onChange={(e) => set('notes', e.target.value)}
            />
          </label>
        </div>
        <div className="form-actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={busy}>
            {busy ? 'Saving…' : initial ? 'Save Changes' : 'Create Owner'}
          </button>
        </div>
      </form>
    </FormModal>
  );
}
