import { type FormEvent, useEffect, useState } from 'react';
import { FormModal } from '../ui/FormModal';
import type {
  MonthlyTenant,
  MonthlyTenantFormValues,
  MonthlyTenantInput,
} from '../../types/monthly-tenant';
import '../../styles/forms.css';

type TenantFormModalProps = {
  open: boolean;
  saving: boolean;
  initial?: MonthlyTenant | null;
  duplicateMatch?: MonthlyTenant | null;
  onClose: () => void;
  onSubmit: (payload: MonthlyTenantInput) => Promise<void>;
  onUseExisting?: (tenant: MonthlyTenant) => void;
};

const emptyForm = (): MonthlyTenantFormValues => ({
  fullName: '',
  phone: '',
  alternatePhone: '',
  email: '',
  cnic: '',
  address: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
  notes: '',
});

const CNIC_PATTERN = /^(\d{5}-\d{7}-\d{1}|\d{13})$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function toFormValues(tenant?: MonthlyTenant | null): MonthlyTenantFormValues {
  if (!tenant) return emptyForm();
  return {
    fullName: tenant.fullName ?? '',
    phone: tenant.phone ?? '',
    alternatePhone: tenant.alternatePhone ?? '',
    email: tenant.email ?? '',
    cnic: tenant.cnic ?? '',
    address: tenant.address ?? '',
    emergencyContactName: tenant.emergencyContactName ?? '',
    emergencyContactPhone: tenant.emergencyContactPhone ?? '',
    notes: tenant.notes ?? '',
  };
}

export function TenantFormModal({
  open,
  saving,
  initial,
  duplicateMatch,
  onClose,
  onSubmit,
  onUseExisting,
}: TenantFormModalProps) {
  const isEdit = Boolean(initial);
  const [form, setForm] = useState<MonthlyTenantFormValues>(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof MonthlyTenantFormValues, string>>
  >({});

  useEffect(() => {
    if (!open) return;
    setForm(toFormValues(initial));
    setFieldErrors({});
  }, [open, initial]);

  function validate(values: MonthlyTenantFormValues) {
    const next: Partial<Record<keyof MonthlyTenantFormValues, string>> = {};

    if (!values.fullName.trim()) next.fullName = 'Full name is required.';
    if (!values.phone.trim()) next.phone = 'Phone is required.';

    if (values.email.trim() && !EMAIL_PATTERN.test(values.email.trim())) {
      next.email = 'Enter a valid email address.';
    }

    if (values.cnic.trim() && !CNIC_PATTERN.test(values.cnic.trim())) {
      next.cnic = 'CNIC must be 12345-1234567-1 or 13 digits.';
    }

    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (saving || !validate(form)) return;

    const payload: MonthlyTenantInput = {
      fullName: form.fullName.trim(),
      phone: form.phone.trim(),
    };

    if (form.alternatePhone.trim()) {
      payload.alternatePhone = form.alternatePhone.trim();
    }
    if (form.email.trim()) payload.email = form.email.trim();
    if (form.cnic.trim()) payload.cnic = form.cnic.trim();
    if (form.address.trim()) payload.address = form.address.trim();
    if (form.emergencyContactName.trim()) {
      payload.emergencyContactName = form.emergencyContactName.trim();
    }
    if (form.emergencyContactPhone.trim()) {
      payload.emergencyContactPhone = form.emergencyContactPhone.trim();
    }
    if (form.notes.trim()) payload.notes = form.notes.trim();

    try {
      await onSubmit(payload);
    } catch {
      // Parent surfaces the error; keep the form open.
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
      title={isEdit ? 'Edit Tenant Profile' : 'Add Monthly Tenant'}
      onClose={handleClose}
    >
      <form className="form-grid form-grid--2" onSubmit={handleSubmit} noValidate>
        {duplicateMatch && onUseExisting ? (
          <div className="monthly-tenants-page__existing-banner">
            <p>
              A tenant with this CNIC already exists:{' '}
              <strong>{duplicateMatch.fullName}</strong> (
              {duplicateMatch.phone}).
            </p>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => onUseExisting(duplicateMatch)}
            >
              Use Existing Tenant
            </button>
          </div>
        ) : null}

        <label className="form-field">
          <span>Full Name *</span>
          <input
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
          />
          {fieldErrors.fullName ? (
            <em className="form-field__error">{fieldErrors.fullName}</em>
          ) : null}
        </label>

        <label className="form-field">
          <span>Phone *</span>
          <input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
          {fieldErrors.phone ? (
            <em className="form-field__error">{fieldErrors.phone}</em>
          ) : null}
        </label>

        <label className="form-field">
          <span>Alternate Phone</span>
          <input
            value={form.alternatePhone}
            onChange={(e) =>
              setForm({ ...form, alternatePhone: e.target.value })
            }
          />
        </label>

        <label className="form-field">
          <span>Email</span>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          {fieldErrors.email ? (
            <em className="form-field__error">{fieldErrors.email}</em>
          ) : null}
        </label>

        <label className="form-field">
          <span>CNIC</span>
          <input
            value={form.cnic}
            placeholder="12345-1234567-1"
            onChange={(e) => setForm({ ...form, cnic: e.target.value })}
          />
          {fieldErrors.cnic ? (
            <em className="form-field__error">{fieldErrors.cnic}</em>
          ) : null}
        </label>

        <label className="form-field">
          <span>Emergency Contact Name</span>
          <input
            value={form.emergencyContactName}
            onChange={(e) =>
              setForm({ ...form, emergencyContactName: e.target.value })
            }
          />
        </label>

        <label className="form-field">
          <span>Emergency Contact Phone</span>
          <input
            value={form.emergencyContactPhone}
            onChange={(e) =>
              setForm({ ...form, emergencyContactPhone: e.target.value })
            }
          />
        </label>

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
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Save Tenant'}
          </button>
        </div>
      </form>
    </FormModal>
  );
}
