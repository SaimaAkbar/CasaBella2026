import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  createMonthlyAgreement,
  fetchMonthlyAgreements,
} from '../../api/monthly-agreements';
import { fetchEligibleUnits } from '../../api/monthly-tenancies';
import { useEligibleUnitsQuery } from '../../hooks/useEligibleUnitsQuery';
import { formatPkr } from '../../lib/format';
import { formatUnitOptionLabel, NO_ELIGIBLE_UNITS_MESSAGE } from '../../lib/unit-label';
import type { MonthlyTenant } from '../../types/monthly-tenant';
import type {
  EligibleUnit,
  MonthlyTenancy,
  MonthlyTenancyInput,
  TenancyFormValues,
} from '../../types/monthly-tenancy';
import type { Property } from '../../types/property';
import { FormModal } from '../ui/FormModal';
import '../../styles/forms.css';

type TenancyFormModalProps = {
  open: boolean;
  saving: boolean;
  token: string;
  tenants: MonthlyTenant[];
  properties: Property[];
  isSuperAdmin: boolean;
  canViewRestricted?: boolean;
  canViewFinancials?: boolean;
  preselectedTenantId?: string;
  preselectedAgreementId?: string;
  unitPreset?: {
    propertyId: string;
    unitId: string;
    unitLabel?: string;
    lockSelection?: boolean;
  } | null;
  returnToDashboard?: boolean;
  initial?: MonthlyTenancy | null;
  onClose: () => void;
  onSubmit: (payload: MonthlyTenancyInput) => Promise<void>;
  onError: (message: string) => void;
  onAgreementCreated?: (agreement: {
    id: string;
    agreementNumber: string;
  }) => void;
};

function emptyForm(): TenancyFormValues {
  const today = new Date().toISOString().slice(0, 10);
  return {
    tenantId: '',
    agreementId: '',
    propertyId: '',
    unitId: '',
    agreementStart: today,
    agreementEnd: '',
    securityDeposit: '0',
    monthlyRent: '',
    maintenanceCharges: '0',
    laundryCharges: '0',
    cleaningCharges: '0',
    waterCharges: '0',
    societyCharges: '0',
    electricityCharges: '0',
    otherCharges: '0',
    previousBalance: '0',
    totalReceived: '0',
    allowAdvance: false,
    occupancyState: 'OCCUPIED',
    hotelUseAllowed: false,
    notes: '',
  };
}

function toNumber(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const amount = Number(value);
  return Number.isNaN(amount) ? undefined : amount;
}

export function TenancyFormModal({
  open,
  saving,
  token,
  tenants,
  properties,
  isSuperAdmin,
  preselectedTenantId,
  preselectedAgreementId,
  unitPreset,
  returnToDashboard,
  initial,
  onClose,
  onSubmit,
  onError,
  onAgreementCreated,
}: TenancyFormModalProps) {
  const [form, setForm] = useState<TenancyFormValues>(emptyForm);
  const [creatingAgreement, setCreatingAgreement] = useState(false);
  const isEdit = Boolean(initial);
  const lockSelection = Boolean(unitPreset?.lockSelection);

  const fetcher = useMemo(
    () => () =>
      fetchEligibleUnits(token, {
        propertyId: form.propertyId,
        tenantId: form.tenantId || undefined,
        includeMonthlyVacant: true,
      }),
    [token, form.propertyId, form.tenantId],
  );

  const { units, loading: loadingUnits } = useEligibleUnitsQuery<EligibleUnit>({
    token,
    propertyId: form.propertyId,
    scope: 'monthly',
    enabled: open && Boolean(form.propertyId),
    fetcher,
    onError,
  });

  useEffect(() => {
    if (!open) return;
    const next = emptyForm();
    if (initial) {
      next.tenantId = initial.tenantId;
      next.agreementId = initial.agreementId ?? '';
      next.propertyId = initial.unit?.property?.id ?? '';
      next.unitId = initial.unitId;
      next.agreementStart = initial.agreementStart.slice(0, 10);
      next.agreementEnd = initial.agreementEnd?.slice(0, 10) ?? '';
      next.securityDeposit = String(initial.securityDeposit ?? '0');
      next.monthlyRent = String(initial.monthlyRent ?? '');
      next.hotelUseAllowed = Boolean(initial.hotelUseAllowed);
      next.occupancyState = initial.occupancyState;
      next.notes = initial.notes ?? '';
    }
    if (preselectedTenantId) next.tenantId = preselectedTenantId;
    if (preselectedAgreementId) next.agreementId = preselectedAgreementId;
    if (unitPreset) {
      next.propertyId = unitPreset.propertyId;
      next.unitId = unitPreset.unitId;
    }
    setForm(next);
  }, [
    open,
    initial,
    preselectedTenantId,
    preselectedAgreementId,
    unitPreset,
  ]);

  useEffect(() => {
    if (!open || !token || !form.tenantId || form.agreementId) return;
    void fetchMonthlyAgreements(token, {
      tenantId: form.tenantId,
      status: 'ACTIVE',
    }).then((rows) => {
      if (rows[0]) {
        setForm((current) =>
          current.agreementId
            ? current
            : { ...current, agreementId: rows[0].id },
        );
      }
    });
  }, [open, token, form.tenantId, form.agreementId]);

  async function handleCreateAgreement() {
    if (!form.tenantId || !form.agreementStart) {
      onError('Select a tenant and agreement start date first.');
      return;
    }
    setCreatingAgreement(true);
    try {
      const created = await createMonthlyAgreement(token, {
        tenantId: form.tenantId,
        agreementStart: form.agreementStart,
        activate: true,
      });
      setForm((current) => ({ ...current, agreementId: created.id }));
      onAgreementCreated?.(created);
    } catch (err) {
      onError(
        err instanceof Error ? err.message : 'Unable to create agreement.',
      );
    } finally {
      setCreatingAgreement(false);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    const rent = Number(form.monthlyRent);
    if (!form.tenantId || !form.agreementId || !form.propertyId || !form.unitId) {
      onError('Tenant, agreement, property and room are required.');
      return;
    }
    if (!rent || rent <= 0) {
      onError('Monthly rent is required.');
      return;
    }
    const payload: MonthlyTenancyInput = {
      tenantId: form.tenantId,
      agreementId: form.agreementId,
      propertyId: form.propertyId,
      unitId: form.unitId,
      agreementStart: form.agreementStart,
      agreementEnd: form.agreementEnd || undefined,
      monthlyRent: rent,
      securityDeposit: toNumber(form.securityDeposit),
      occupancyState: form.occupancyState === 'EMPTY' ? 'EMPTY' : 'OCCUPIED',
      hotelUseAllowed: form.hotelUseAllowed,
      notes: form.notes.trim() || undefined,
      allowAdvance: isSuperAdmin ? form.allowAdvance : undefined,
    };
    await onSubmit(payload);
  }

  return (
    <FormModal
      open={open}
      title={isEdit ? 'Edit Agreement' : 'Assign Tenant to Unit'}
      onClose={onClose}
    >
      <form className="form-grid" onSubmit={handleSubmit}>
        {returnToDashboard ? (
          <p className="form-hint">After saving you will return to the dashboard.</p>
        ) : null}
        <label className="form-field">
          <span>Tenant</span>
          <select
            value={form.tenantId}
            disabled={isEdit || Boolean(preselectedTenantId)}
            onChange={(event) =>
              setForm({
                ...form,
                tenantId: event.target.value,
                agreementId: '',
              })
            }
            required
          >
            <option value="">Select tenant</option>
            {tenants.map((tenant) => (
              <option key={tenant.id} value={tenant.id}>
                {tenant.fullName}
              </option>
            ))}
          </select>
        </label>
        <label className="form-field">
          <span>Agreement</span>
          <input value={form.agreementId} readOnly />
        </label>
        {!form.agreementId && !isEdit ? (
          <button
            type="button"
            className="btn btn--ghost"
            disabled={creatingAgreement}
            onClick={() => void handleCreateAgreement()}
          >
            {creatingAgreement ? 'Creating…' : 'Create Agreement'}
          </button>
        ) : null}
        <div className="form-grid form-grid--2">
          <label className="form-field">
            <span>Agreement Start</span>
            <input
              type="date"
              value={form.agreementStart}
              onChange={(event) =>
                setForm({ ...form, agreementStart: event.target.value })
              }
              required
            />
          </label>
          <label className="form-field">
            <span>Agreement End</span>
            <input
              type="date"
              value={form.agreementEnd}
              onChange={(event) =>
                setForm({ ...form, agreementEnd: event.target.value })
              }
            />
          </label>
        </div>
        <label className="form-field">
          <span>Property</span>
          <select
            value={form.propertyId}
            disabled={lockSelection}
            onChange={(event) =>
              setForm({ ...form, propertyId: event.target.value, unitId: '' })
            }
            required
          >
            <option value="">Select property</option>
            {properties.map((property) => (
              <option key={property.id} value={property.id}>
                {property.name}
              </option>
            ))}
          </select>
        </label>
        <label className="form-field">
          <span>Room / Apartment</span>
          <select
            value={form.unitId}
            disabled={lockSelection || loadingUnits}
            onChange={(event) => {
              const nextId = event.target.value;
              const selected = units.find((unit) => unit.id === nextId);
              setForm({
                ...form,
                unitId: nextId,
                monthlyRent:
                  form.monthlyRent || selected?.monthlyRent || form.monthlyRent,
              });
            }}
            required
          >
            <option value="">
              {loadingUnits ? 'Loading units…' : 'Select unit'}
            </option>
            {units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {formatUnitOptionLabel(unit)}
              </option>
            ))}
          </select>
          {!loadingUnits && form.propertyId && units.length === 0 ? (
            <em className="form-field__error">{NO_ELIGIBLE_UNITS_MESSAGE}</em>
          ) : null}
        </label>
        <div className="form-grid form-grid--2">
          <label className="form-field">
            <span>Monthly Rent</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.monthlyRent}
              onChange={(event) =>
                setForm({ ...form, monthlyRent: event.target.value })
              }
              required
            />
          </label>
          <label className="form-field">
            <span>Security Deposit</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.securityDeposit}
              onChange={(event) =>
                setForm({ ...form, securityDeposit: event.target.value })
              }
            />
          </label>
        </div>
        <label className="form-field">
          <span>
            <input
              type="checkbox"
              checked={form.hotelUseAllowed}
              onChange={(event) =>
                setForm({ ...form, hotelUseAllowed: event.target.checked })
              }
            />{' '}
            Hotel use when empty
          </span>
        </label>
        <p className="form-hint">Suggested rent: {formatPkr(form.monthlyRent)}</p>
        <label className="form-field">
          <span>Notes</span>
          <textarea
            value={form.notes}
            onChange={(event) => setForm({ ...form, notes: event.target.value })}
          />
        </label>
        <div className="form-actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save Agreement' : 'Assign Unit'}
          </button>
        </div>
      </form>
    </FormModal>
  );
}
