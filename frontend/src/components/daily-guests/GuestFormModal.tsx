import { useEffect, useState, type FormEvent } from 'react';
import type { Guest, GuestFormValues, GuestInput } from '../../types/guest';
import { FormModal } from '../ui/FormModal';
import '../../styles/forms.css';

type GuestFormModalProps = {
  open: boolean;
  saving: boolean;
  initial?: Guest | null;
  onClose: () => void;
  onSubmit: (payload: GuestInput) => Promise<void>;
};

const emptyForm = (): GuestFormValues => ({
  fullName: '',
  phone: '',
  alternatePhone: '',
  email: '',
  cnicOrPassport: '',
  address: '',
  nationality: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
  vehicleNumber: '',
  notes: '',
});

function guestToForm(guest: Guest): GuestFormValues {
  return {
    fullName: guest.fullName ?? '',
    phone: guest.phone ?? '',
    alternatePhone: guest.alternatePhone ?? '',
    email: guest.email ?? '',
    cnicOrPassport: guest.cnicOrPassport ?? guest.cnic ?? '',
    address: guest.address ?? '',
    nationality: guest.nationality ?? '',
    emergencyContactName: guest.emergencyContactName ?? '',
    emergencyContactPhone: guest.emergencyContactPhone ?? '',
    vehicleNumber: guest.vehicleNumber ?? '',
    notes: guest.notes ?? '',
  };
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function GuestFormModal({
  open,
  saving,
  initial = null,
  onClose,
  onSubmit,
}: GuestFormModalProps) {
  const [form, setForm] = useState<GuestFormValues>(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof GuestFormValues, string>>
  >({});
  const isEdit = Boolean(initial);

  useEffect(() => {
    if (!open) return;
    setForm(initial ? guestToForm(initial) : emptyForm());
    setFieldErrors({});
  }, [open, initial]);

  function validate(values: GuestFormValues) {
    const next: Partial<Record<keyof GuestFormValues, string>> = {};
    if (!values.fullName.trim()) next.fullName = 'Full name is required.';
    if (!values.phone.trim()) next.phone = 'Phone is required.';
    if (values.email.trim() && !EMAIL_PATTERN.test(values.email.trim())) {
      next.email = 'Enter a valid email address.';
    }
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (saving || !validate(form)) return;

    const payload: GuestInput = {
      fullName: form.fullName.trim(),
      phone: form.phone.trim(),
    };

    const optionalKeys: Array<keyof GuestFormValues> = [
      'alternatePhone',
      'email',
      'cnicOrPassport',
      'address',
      'nationality',
      'emergencyContactName',
      'emergencyContactPhone',
      'vehicleNumber',
      'notes',
    ];

    for (const key of optionalKeys) {
      const value = form[key].trim();
      if (value) {
        (payload as Record<string, string>)[key] = value;
      }
    }

    try {
      await onSubmit(payload);
      setForm(emptyForm());
      setFieldErrors({});
    } catch {
      // keep form open
    }
  }

  function handleClose() {
    if (saving) return;
    setForm(emptyForm());
    setFieldErrors({});
    onClose();
  }

  return (
    <FormModal
      open={open}
      title={isEdit ? 'Edit Guest' : 'Add Guest'}
      onClose={handleClose}
    >
      <form className="form-grid form-grid--2" onSubmit={handleSubmit} noValidate>
        {(
          [
            ['fullName', 'Full Name *'],
            ['phone', 'Phone *'],
            ['alternatePhone', 'Alternate Phone'],
            ['email', 'Email'],
            ['cnicOrPassport', 'CNIC / Passport'],
            ['nationality', 'Nationality'],
            ['emergencyContactName', 'Emergency Contact Name'],
            ['emergencyContactPhone', 'Emergency Contact Phone'],
            ['vehicleNumber', 'Vehicle Number'],
          ] as const
        ).map(([key, label]) => (
          <label className="form-field" key={key}>
            <span>{label}</span>
            <input
              value={form[key]}
              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
            />
            {fieldErrors[key] ? (
              <em className="form-field__error">{fieldErrors[key]}</em>
            ) : null}
          </label>
        ))}

        <label className="form-field" style={{ gridColumn: '1 / -1' }}>
          <span>Address</span>
          <input
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
        </label>

        <label className="form-field" style={{ gridColumn: '1 / -1' }}>
          <span>Notes</span>
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </label>

        <div className="form-actions" style={{ gridColumn: '1 / -1' }}>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={handleClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Save Guest'}
          </button>
        </div>
      </form>
    </FormModal>
  );
}
