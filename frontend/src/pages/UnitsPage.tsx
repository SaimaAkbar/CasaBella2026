import { useEffect, useRef, useState, type FormEvent } from 'react';
import { fetchProperties } from '../api/properties';
import {
  archiveUnit,
  createUnit,
  fetchUnits,
  updateUnit,
  uploadUnitImage,
} from '../api/units';
import { PageHeader } from '../components/PageHeader';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { DataTable, type DataTableColumn } from '../components/ui/DataTable';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { FilterBar } from '../components/ui/FilterBar';
import { FormModal } from '../components/ui/FormModal';
import { LoadingState } from '../components/ui/LoadingState';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Toast } from '../components/ui/Toast';
import { useAuth } from '../context/AuthContext';
import { useApiErrorHandler } from '../hooks/useApiErrorHandler';
import { formatLabel, formatPkr } from '../lib/format';
import { invalidateEligibleUnitsQueries } from '../lib/query-cache';
import type { Property } from '../types/property';
import type {
  Unit,
  UnitFormValues,
  UnitInput,
  UnitStatus,
  UnitType,
} from '../types/unit';
import '../styles/forms.css';

type Mode = 'create' | 'edit' | 'view' | null;

const STATUS_OPTIONS: UnitStatus[] = [
  'AVAILABLE',
  'OCCUPIED',
  'CLEANING_REQUIRED',
  'MONTHLY_TENANT_VACANT',
  'MAINTENANCE',
  'BLOCKED',
];

const emptyForm = (): UnitFormValues => ({
  propertyId: '',
  unitNumber: '',
  unitType: '',
  floor: '',
  bedrooms: '',
  monthlyRent: '',
  dailyRate: '',
  hourlyRate: '',
  status: 'AVAILABLE',
  notes: '',
  displayName: '',
  description: '',
  maxGuests: '',
  bedConfiguration: '',
  amenitiesText: '',
  imageUrl: '',
  isActive: true,
});

function toOptionalNumber(value: string): number | undefined {
  if (value.trim() === '') return undefined;
  return Number(value);
}

function resolveUnitImagePreview(url: string): string {
  if (!url) return '';
  if (/^https?:\/\//i.test(url) || url.startsWith('data:') || url.startsWith('blob:')) {
    return url;
  }
  const api = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || '';
  if (!api) return url;
  return url.startsWith('/') ? `${api}${url}` : `${api}/${url}`;
}

export function UnitsPage() {
  const { token, user } = useAuth();
  const handleApiError = useApiErrorHandler();

  const [units, setUnits] = useState<Unit[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [search, setSearch] = useState('');
  const [propertyId, setPropertyId] = useState('');
  const [unitType, setUnitType] = useState<UnitType | ''>('');
  const [status, setStatus] = useState<UnitStatus | ''>('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>(
    'all',
  );

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' }>({
    message: '',
    tone: 'success',
  });

  const [mode, setMode] = useState<Mode>(null);
  const [selected, setSelected] = useState<Unit | null>(null);
  const [form, setForm] = useState<UnitFormValues>(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof UnitFormValues, string>>
  >({});
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<Unit | null>(null);
  const [archiving, setArchiving] = useState(false);
  const imageFileRef = useRef<HTMLInputElement>(null);

  const canCreate = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';
  const canEdit = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';
  const canArchive = user?.role === 'SUPER_ADMIN';
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  async function loadUnits() {
    if (!token) return;

    setIsLoading(true);
    setError('');

    try {
      const data = await fetchUnits(token, {
        propertyId: propertyId || undefined,
        unitType,
        status,
        search: search.trim() || undefined,
        isActive:
          activeFilter === 'all'
            ? ''
            : activeFilter === 'active'
              ? true
              : false,
      });
      setUnits(data);
    } catch (err) {
      setError(handleApiError(err, 'Unable to load units.'));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (!token) return;

    void fetchProperties(token)
      .then(setProperties)
      .catch((err) => {
        setToast({
          message: handleApiError(err, 'Unable to load properties for filters.'),
          tone: 'error',
        });
      });
  }, [token, handleApiError]);

  useEffect(() => {
    void loadUnits();
  }, [token, propertyId, unitType, status, activeFilter, search]);

  function openCreate() {
    setSelected(null);
    setForm(emptyForm());
    setFieldErrors({});
    setMode('create');
  }

  function openEdit(unit: Unit) {
    setSelected(unit);
    const amenities = Array.isArray(unit.amenities)
      ? unit.amenities.join(', ')
      : '';
    const imageUrl =
      Array.isArray(unit.imageUrls) && unit.imageUrls[0]
        ? String(unit.imageUrls[0])
        : '';
    setForm({
      propertyId: unit.propertyId,
      unitNumber: unit.unitNumber,
      unitType: unit.unitType,
      floor: unit.floor?.toString() ?? '',
      bedrooms: unit.bedrooms?.toString() ?? '',
      monthlyRent: unit.monthlyRent ?? '',
      dailyRate: unit.dailyRate ?? '',
      hourlyRate: unit.hourlyRate ?? '',
      status: unit.status,
      notes: unit.notes ?? '',
      displayName: unit.displayName ?? '',
      description: unit.description ?? '',
      maxGuests: unit.maxGuests?.toString() ?? '',
      bedConfiguration: unit.bedConfiguration ?? '',
      amenitiesText: amenities,
      imageUrl,
      isActive: unit.isActive,
    });
    setFieldErrors({});
    setMode('edit');
  }

  function openView(unit: Unit) {
    setSelected(unit);
    setMode('view');
  }

  function validate(values: UnitFormValues) {
    const next: Partial<Record<keyof UnitFormValues, string>> = {};

    if (!values.propertyId) next.propertyId = 'Property is required.';
    if (!values.unitNumber.trim()) next.unitNumber = 'Unit number is required.';
    if (!values.unitType) next.unitType = 'Unit type is required.';

    const bedrooms = toOptionalNumber(values.bedrooms);
    if (values.bedrooms.trim() !== '' && (bedrooms === undefined || bedrooms < 0 || !Number.isInteger(bedrooms))) {
      next.bedrooms = 'Bedrooms must be zero or a positive whole number.';
    }

    for (const key of ['monthlyRent', 'dailyRate', 'hourlyRate'] as const) {
      const amount = toOptionalNumber(values[key]);
      if (values[key].trim() !== '' && (amount === undefined || Number.isNaN(amount) || amount < 0)) {
        next[key] = 'Rate cannot be negative.';
      }
    }

    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  function buildPayload(values: UnitFormValues): UnitInput {
    return {
      propertyId: values.propertyId,
      unitNumber: values.unitNumber.trim(),
      unitType: values.unitType as UnitType,
      floor: toOptionalNumber(values.floor),
      bedrooms: toOptionalNumber(values.bedrooms),
      monthlyRent: toOptionalNumber(values.monthlyRent),
      dailyRate: toOptionalNumber(values.dailyRate),
      hourlyRate: toOptionalNumber(values.hourlyRate),
      status: values.status,
      notes: values.notes.trim() || undefined,
      displayName: values.displayName.trim() || undefined,
      description: values.description.trim() || undefined,
      maxGuests: toOptionalNumber(values.maxGuests),
      bedConfiguration: values.bedConfiguration.trim() || undefined,
      amenitiesText: values.amenitiesText.trim() || undefined,
      imageUrl: values.imageUrl.trim() || undefined,
      isActive: values.isActive,
    };
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || saving || mode === 'view') return;
    if (!validate(form)) return;

    setSaving(true);

    try {
      const payload = buildPayload(form);

      if (mode === 'create') {
        await createUnit(token, payload);
        setToast({ message: 'Unit created successfully.', tone: 'success' });
      } else if (mode === 'edit' && selected) {
        const editPayload =
          user?.role === 'ADMIN'
            ? {
                unitNumber: payload.unitNumber,
                floor: payload.floor,
                bedrooms: payload.bedrooms,
                monthlyRent: payload.monthlyRent,
                dailyRate: payload.dailyRate,
                hourlyRate: payload.hourlyRate,
                status: payload.status,
                notes: payload.notes,
                displayName: payload.displayName,
                description: payload.description,
                maxGuests: payload.maxGuests,
                bedConfiguration: payload.bedConfiguration,
                amenitiesText: payload.amenitiesText,
                imageUrl: payload.imageUrl,
              }
            : payload;

        await updateUnit(token, selected.id, editPayload);
        setToast({ message: 'Unit updated successfully.', tone: 'success' });
      }

      setMode(null);
      invalidateEligibleUnitsQueries();
      await loadUnits();
    } catch (err) {
      setToast({
        message: handleApiError(err, 'Unable to save unit.'),
        tone: 'error',
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleImageUpload(file: File | null | undefined) {
    if (!token || !file || uploadingImage) return;

    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setToast({
        message: 'Please choose a JPG, PNG, or WEBP image.',
        tone: 'error',
      });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setToast({ message: 'Image must be 5MB or smaller.', tone: 'error' });
      return;
    }

    setUploadingImage(true);
    try {
      const result = await uploadUnitImage(token, file);
      setForm((prev) => ({ ...prev, imageUrl: result.url }));
      setToast({ message: 'Image uploaded.', tone: 'success' });
    } catch (err) {
      setToast({
        message: handleApiError(err, 'Unable to upload image.'),
        tone: 'error',
      });
    } finally {
      setUploadingImage(false);
      if (imageFileRef.current) imageFileRef.current.value = '';
    }
  }

  async function handleArchive() {
    if (!token || !archiveTarget) return;

    setArchiving(true);

    try {
      await archiveUnit(token, archiveTarget.id);
      invalidateEligibleUnitsQueries();
      setToast({ message: 'Unit archived successfully.', tone: 'success' });
      setArchiveTarget(null);
      await loadUnits();
    } catch (err) {
      setToast({
        message: handleApiError(err, 'Unable to archive unit.'),
        tone: 'error',
      });
    } finally {
      setArchiving(false);
    }
  }

  const columns: Array<DataTableColumn<Unit>> = [
    {
      key: 'property',
      header: 'Property',
      render: (row) => row.property?.name ?? '—',
    },
    {
      key: 'unitNumber',
      header: 'Unit Number',
      render: (row) => row.unitNumber,
    },
    {
      key: 'unitType',
      header: 'Unit Type',
      render: (row) => formatLabel(row.unitType),
    },
    {
      key: 'floor',
      header: 'Floor',
      render: (row) => row.floor ?? '—',
    },
    {
      key: 'bedrooms',
      header: 'Bedrooms',
      render: (row) => row.bedrooms ?? '—',
    },
    {
      key: 'monthlyRent',
      header: 'Monthly Rent',
      render: (row) => formatPkr(row.monthlyRent),
    },
    {
      key: 'dailyRate',
      header: 'Daily Rate',
      render: (row) => formatPkr(row.dailyRate),
    },
    {
      key: 'hourlyRate',
      header: 'Hourly Rate',
      render: (row) => formatPkr(row.hourlyRate),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'active',
      header: 'Active',
      render: (row) => (
        <StatusBadge status={row.isActive ? 'ACTIVE' : 'INACTIVE'} />
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="data-table__actions">
          <button
            type="button"
            className="data-table__action"
            onClick={() => openView(row)}
          >
            View
          </button>
          {canEdit ? (
            <button
              type="button"
              className="data-table__action"
              onClick={() => openEdit(row)}
            >
              Edit
            </button>
          ) : null}
          {canArchive ? (
            <button
              type="button"
              className="data-table__action data-table__action--danger"
              onClick={() => setArchiveTarget(row)}
              disabled={!row.isActive}
            >
              Archive
            </button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <section className="entity-page">
      <PageHeader
        title="Rooms & Apartments"
        breadcrumb={['Home', 'Rooms & Apartments']}
      />

      {canCreate ? (
        <div className="entity-page__toolbar">
          <button type="button" className="btn btn--primary" onClick={openCreate}>
            Add Unit
          </button>
        </div>
      ) : null}

      <FilterBar>
        <label>
          <span>Search</span>
          <input
            type="search"
            value={search}
            placeholder="Unit number"
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <label>
          <span>Property</span>
          <select
            value={propertyId}
            onChange={(event) => setPropertyId(event.target.value)}
          >
            <option value="">All Properties</option>
            {properties.map((property) => (
              <option key={property.id} value={property.id}>
                {property.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Unit Type</span>
          <select
            value={unitType}
            onChange={(event) =>
              setUnitType(event.target.value as UnitType | '')
            }
          >
            <option value="">All Types</option>
            <option value="ROOM">Room</option>
            <option value="APARTMENT">Apartment</option>
          </select>
        </label>
        <label>
          <span>Status</span>
          <select
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as UnitStatus | '')
            }
          >
            <option value="">All Statuses</option>
            {STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {formatLabel(option)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Active</span>
          <select
            value={activeFilter}
            onChange={(event) =>
              setActiveFilter(event.target.value as 'all' | 'active' | 'inactive')
            }
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>
      </FilterBar>

      {isLoading ? <LoadingState message="Loading units…" /> : null}
      {!isLoading && error ? (
        <ErrorState message={error} onRetry={() => void loadUnits()} />
      ) : null}
      {!isLoading && !error && units.length === 0 ? (
        <EmptyState
          title="No units found"
          description="Try adjusting filters or add a new room/apartment."
        />
      ) : null}
      {!isLoading && !error && units.length > 0 ? (
        <DataTable columns={columns} rows={units} rowKey={(row) => row.id} />
      ) : null}

      <FormModal
        open={mode === 'create' || mode === 'edit'}
        title={mode === 'create' ? 'Add Unit' : 'Edit Unit'}
        onClose={() => !saving && setMode(null)}
      >
        <form className="form-grid" onSubmit={handleSubmit} noValidate>
          <div className="form-grid form-grid--2">
            <label className="form-field">
              <span>Property</span>
              <select
                value={form.propertyId}
                disabled={mode === 'edit' && !isSuperAdmin}
                onChange={(event) =>
                  setForm({ ...form, propertyId: event.target.value })
                }
              >
                <option value="">Select property</option>
                {properties.map((property) => (
                  <option key={property.id} value={property.id}>
                    {property.name}
                  </option>
                ))}
              </select>
              {fieldErrors.propertyId ? (
                <em className="form-field__error">{fieldErrors.propertyId}</em>
              ) : null}
            </label>

            <label className="form-field">
              <span>Unit Number</span>
              <input
                value={form.unitNumber}
                onChange={(event) =>
                  setForm({ ...form, unitNumber: event.target.value })
                }
              />
              {fieldErrors.unitNumber ? (
                <em className="form-field__error">{fieldErrors.unitNumber}</em>
              ) : null}
            </label>

            <label className="form-field">
              <span>Unit Type</span>
              <select
                value={form.unitType}
                disabled={mode === 'edit' && !isSuperAdmin}
                onChange={(event) =>
                  setForm({
                    ...form,
                    unitType: event.target.value as UnitType | '',
                  })
                }
              >
                <option value="">Select type</option>
                <option value="ROOM">Room</option>
                <option value="APARTMENT">Apartment</option>
              </select>
              {fieldErrors.unitType ? (
                <em className="form-field__error">{fieldErrors.unitType}</em>
              ) : null}
            </label>

            <label className="form-field">
              <span>Status</span>
              <select
                value={form.status}
                onChange={(event) =>
                  setForm({
                    ...form,
                    status: event.target.value as UnitStatus,
                  })
                }
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {formatLabel(option)}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-field">
              <span>Floor</span>
              <input
                type="number"
                value={form.floor}
                onChange={(event) =>
                  setForm({ ...form, floor: event.target.value })
                }
              />
            </label>

            <label className="form-field">
              <span>Bedrooms</span>
              <input
                type="number"
                min={0}
                value={form.bedrooms}
                onChange={(event) =>
                  setForm({ ...form, bedrooms: event.target.value })
                }
              />
              {fieldErrors.bedrooms ? (
                <em className="form-field__error">{fieldErrors.bedrooms}</em>
              ) : null}
            </label>

            <label className="form-field">
              <span>Monthly Rent</span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.monthlyRent}
                onChange={(event) =>
                  setForm({ ...form, monthlyRent: event.target.value })
                }
              />
              {fieldErrors.monthlyRent ? (
                <em className="form-field__error">{fieldErrors.monthlyRent}</em>
              ) : null}
            </label>

            <label className="form-field">
              <span>Daily Rate</span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.dailyRate}
                onChange={(event) =>
                  setForm({ ...form, dailyRate: event.target.value })
                }
              />
              {fieldErrors.dailyRate ? (
                <em className="form-field__error">{fieldErrors.dailyRate}</em>
              ) : null}
            </label>

            <label className="form-field">
              <span>Hourly Rate</span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.hourlyRate}
                onChange={(event) =>
                  setForm({ ...form, hourlyRate: event.target.value })
                }
              />
              {fieldErrors.hourlyRate ? (
                <em className="form-field__error">{fieldErrors.hourlyRate}</em>
              ) : null}
            </label>
          </div>

          <label className="form-field">
            <span>Notes</span>
            <textarea
              value={form.notes}
              onChange={(event) =>
                setForm({ ...form, notes: event.target.value })
              }
            />
          </label>

          <p className="form-section-title">Website listing (public)</p>
          <div className="form-grid form-grid--2">
            <label className="form-field">
              <span>Display name</span>
              <input
                value={form.displayName}
                placeholder="e.g. Executive Suite"
                onChange={(event) =>
                  setForm({ ...form, displayName: event.target.value })
                }
              />
            </label>
            <label className="form-field">
              <span>Max guests</span>
              <input
                type="number"
                min={1}
                value={form.maxGuests}
                onChange={(event) =>
                  setForm({ ...form, maxGuests: event.target.value })
                }
              />
            </label>
            <label className="form-field">
              <span>Bed configuration</span>
              <input
                value={form.bedConfiguration}
                placeholder="e.g. King bed"
                onChange={(event) =>
                  setForm({ ...form, bedConfiguration: event.target.value })
                }
              />
            </label>
            <div className="form-field">
              <span>Website image</span>
              <input
                ref={imageFileRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                hidden
                onChange={(event) =>
                  void handleImageUpload(event.target.files?.[0])
                }
              />
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  type="button"
                  className="btn btn--primary"
                  disabled={uploadingImage || saving}
                  onClick={() => imageFileRef.current?.click()}
                >
                  {uploadingImage ? 'Uploading…' : form.imageUrl ? 'Change image' : 'Upload image'}
                </button>
                {form.imageUrl ? (
                  <button
                    type="button"
                    className="btn btn--ghost"
                    disabled={uploadingImage || saving}
                    onClick={() => setForm({ ...form, imageUrl: '' })}
                  >
                    Remove
                  </button>
                ) : null}
              </div>
              <p className="form-hint">JPG, PNG, or WEBP · max 5MB</p>
              {form.imageUrl ? (
                <img
                  src={resolveUnitImagePreview(form.imageUrl)}
                  alt="Unit website preview"
                  style={{
                    marginTop: '0.5rem',
                    maxWidth: '100%',
                    maxHeight: 160,
                    objectFit: 'cover',
                    borderRadius: 8,
                    border: '1px solid var(--border-color, #ddd)',
                  }}
                />
              ) : null}
            </div>
          </div>
          <label className="form-field">
            <span>Website description</span>
            <textarea
              value={form.description}
              onChange={(event) =>
                setForm({ ...form, description: event.target.value })
              }
            />
          </label>
          <label className="form-field">
            <span>Facilities (comma-separated)</span>
            <input
              value={form.amenitiesText}
              placeholder="WiFi, AC, TV, Kitchen"
              onChange={(event) =>
                setForm({ ...form, amenitiesText: event.target.value })
              }
            />
          </label>

          {(mode === 'create' || isSuperAdmin) ? (
            <label className="form-field form-field--checkbox">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(event) =>
                  setForm({ ...form, isActive: event.target.checked })
                }
              />
              <span>Active status</span>
            </label>
          ) : null}

          <div className="form-actions">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setMode(null)}
              disabled={saving}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </FormModal>

      <FormModal
        open={mode === 'view'}
        title="Unit Details"
        onClose={() => setMode(null)}
      >
        {selected ? (
          <dl className="detail-list">
            <div>
              <dt>Property</dt>
              <dd>{selected.property?.name ?? '—'}</dd>
            </div>
            <div>
              <dt>Unit Number</dt>
              <dd>{selected.unitNumber}</dd>
            </div>
            <div>
              <dt>Unit Type</dt>
              <dd>{formatLabel(selected.unitType)}</dd>
            </div>
            <div>
              <dt>Floor</dt>
              <dd>{selected.floor ?? '—'}</dd>
            </div>
            <div>
              <dt>Bedrooms</dt>
              <dd>{selected.bedrooms ?? '—'}</dd>
            </div>
            <div>
              <dt>Monthly Rent</dt>
              <dd>{formatPkr(selected.monthlyRent)}</dd>
            </div>
            <div>
              <dt>Daily Rate</dt>
              <dd>{formatPkr(selected.dailyRate)}</dd>
            </div>
            <div>
              <dt>Hourly Rate</dt>
              <dd>{formatPkr(selected.hourlyRate)}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>
                <StatusBadge status={selected.status} />
              </dd>
            </div>
            <div>
              <dt>Active</dt>
              <dd>
                <StatusBadge status={selected.isActive ? 'ACTIVE' : 'INACTIVE'} />
              </dd>
            </div>
            <div>
              <dt>Notes</dt>
              <dd>{selected.notes || '—'}</dd>
            </div>
          </dl>
        ) : null}
      </FormModal>

      <ConfirmDialog
        open={Boolean(archiveTarget)}
        title="Archive unit"
        message={`Archive unit "${archiveTarget?.unitNumber ?? ''}"? This sets the unit inactive.`}
        confirmLabel="Archive"
        busy={archiving}
        onCancel={() => setArchiveTarget(null)}
        onConfirm={() => void handleArchive()}
      />

      <Toast
        message={toast.message}
        tone={toast.tone}
        onClose={() => setToast({ message: '', tone: 'success' })}
      />
    </section>
  );
}
