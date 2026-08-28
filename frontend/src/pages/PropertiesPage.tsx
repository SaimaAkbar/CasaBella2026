import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  archiveProperty,
  createProperty,
  fetchProperties,
  updateProperty,
} from '../api/properties';
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
import { formatDate } from '../lib/format';
import type { Property, PropertyFormValues } from '../types/property';
import '../styles/forms.css';

type Mode = 'create' | 'edit' | 'view' | null;

const emptyForm = (): PropertyFormValues => ({
  name: '',
  address: '',
  city: '',
  description: '',
  isActive: true,
});

export function PropertiesPage() {
  const { token, user } = useAuth();
  const handleApiError = useApiErrorHandler();

  const [properties, setProperties] = useState<Property[]>([]);
  const [search, setSearch] = useState('');
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
  const [selected, setSelected] = useState<Property | null>(null);
  const [form, setForm] = useState<PropertyFormValues>(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof PropertyFormValues, string>>>(
    {},
  );
  const [saving, setSaving] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<Property | null>(null);
  const [archiving, setArchiving] = useState(false);

  const canCreate = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';
  const canEdit = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';
  const canArchive = user?.role === 'SUPER_ADMIN';
  const canEditActive = user?.role === 'SUPER_ADMIN';

  async function loadProperties() {
    if (!token) return;

    setIsLoading(true);
    setError('');

    try {
      const data = await fetchProperties(token);
      setProperties(data);
    } catch (err) {
      setError(handleApiError(err, 'Unable to load properties.'));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadProperties();
  }, [token]);

  const filtered = useMemo(() => {
    return properties.filter((property) => {
      const matchesSearch = [property.name, property.address, property.city]
        .join(' ')
        .toLowerCase()
        .includes(search.trim().toLowerCase());

      const matchesActive =
        activeFilter === 'all'
          ? true
          : activeFilter === 'active'
            ? property.isActive
            : !property.isActive;

      return matchesSearch && matchesActive;
    });
  }, [properties, search, activeFilter]);

  function openCreate() {
    setSelected(null);
    setForm(emptyForm());
    setFieldErrors({});
    setMode('create');
  }

  function openEdit(property: Property) {
    setSelected(property);
    setForm({
      name: property.name,
      address: property.address,
      city: property.city,
      description: property.description ?? '',
      isActive: property.isActive,
    });
    setFieldErrors({});
    setMode('edit');
  }

  function openView(property: Property) {
    setSelected(property);
    setMode('view');
  }

  function validate(values: PropertyFormValues) {
    const next: Partial<Record<keyof PropertyFormValues, string>> = {};

    if (!values.name.trim()) next.name = 'Name is required.';
    if (!values.address.trim()) next.address = 'Address is required.';
    if (!values.city.trim()) next.city = 'City is required.';

    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || saving || mode === 'view') return;
    if (!validate(form)) return;

    setSaving(true);

    try {
      const payload = {
        name: form.name.trim(),
        address: form.address.trim(),
        city: form.city.trim(),
        description: form.description.trim() || undefined,
        ...(canEditActive || mode === 'create'
          ? { isActive: form.isActive }
          : {}),
      };

      if (mode === 'create') {
        await createProperty(token, payload);
        setToast({ message: 'Property created successfully.', tone: 'success' });
      } else if (mode === 'edit' && selected) {
        const editPayload =
          user?.role === 'ADMIN'
            ? {
                name: payload.name,
                address: payload.address,
                city: payload.city,
                description: payload.description,
              }
            : payload;

        await updateProperty(token, selected.id, editPayload);
        setToast({ message: 'Property updated successfully.', tone: 'success' });
      }

      setMode(null);
      await loadProperties();
    } catch (err) {
      setToast({
        message: handleApiError(err, 'Unable to save property.'),
        tone: 'error',
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive() {
    if (!token || !archiveTarget) return;

    setArchiving(true);

    try {
      await archiveProperty(token, archiveTarget.id);
      setToast({ message: 'Property archived successfully.', tone: 'success' });
      setArchiveTarget(null);
      await loadProperties();
    } catch (err) {
      setToast({
        message: handleApiError(err, 'Unable to archive property.'),
        tone: 'error',
      });
    } finally {
      setArchiving(false);
    }
  }

  const columns: Array<DataTableColumn<Property>> = [
    {
      key: 'name',
      header: 'Property Name',
      render: (row) => row.name,
    },
    {
      key: 'address',
      header: 'Address',
      render: (row) => row.address,
    },
    {
      key: 'city',
      header: 'City',
      render: (row) => row.city,
    },
    {
      key: 'units',
      header: 'Total Units',
      render: (row) => row._count?.units ?? 0,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <StatusBadge status={row.isActive ? 'ACTIVE' : 'INACTIVE'} />
      ),
    },
    {
      key: 'createdAt',
      header: 'Created Date',
      render: (row) => formatDate(row.createdAt),
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
      <PageHeader title="Properties" breadcrumb={['Home', 'Properties']} />

      {canCreate ? (
        <div className="entity-page__toolbar">
          <button type="button" className="btn btn--primary" onClick={openCreate}>
            Add Property
          </button>
        </div>
      ) : null}

      <FilterBar>
        <label>
          <span>Search</span>
          <input
            type="search"
            value={search}
            placeholder="Name, address or city"
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <label>
          <span>Status</span>
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

      {isLoading ? <LoadingState message="Loading properties…" /> : null}
      {!isLoading && error ? (
        <ErrorState message={error} onRetry={() => void loadProperties()} />
      ) : null}
      {!isLoading && !error && filtered.length === 0 ? (
        <EmptyState
          title="No properties found"
          description="Try adjusting filters or add a new property."
        />
      ) : null}
      {!isLoading && !error && filtered.length > 0 ? (
        <DataTable columns={columns} rows={filtered} rowKey={(row) => row.id} />
      ) : null}

      <FormModal
        open={mode === 'create' || mode === 'edit'}
        title={mode === 'create' ? 'Add Property' : 'Edit Property'}
        onClose={() => !saving && setMode(null)}
      >
        <form className="form-grid" onSubmit={handleSubmit} noValidate>
          <label className="form-field">
            <span>Name</span>
            <input
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
            {fieldErrors.name ? (
              <em className="form-field__error">{fieldErrors.name}</em>
            ) : null}
          </label>

          <label className="form-field">
            <span>Address</span>
            <input
              value={form.address}
              onChange={(event) =>
                setForm({ ...form, address: event.target.value })
              }
            />
            {fieldErrors.address ? (
              <em className="form-field__error">{fieldErrors.address}</em>
            ) : null}
          </label>

          <label className="form-field">
            <span>City</span>
            <input
              value={form.city}
              onChange={(event) => setForm({ ...form, city: event.target.value })}
            />
            {fieldErrors.city ? (
              <em className="form-field__error">{fieldErrors.city}</em>
            ) : null}
          </label>

          <label className="form-field">
            <span>Description</span>
            <textarea
              value={form.description}
              onChange={(event) =>
                setForm({ ...form, description: event.target.value })
              }
            />
          </label>

          {(mode === 'create' || canEditActive) ? (
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
        title="Property Details"
        onClose={() => setMode(null)}
      >
        {selected ? (
          <dl className="detail-list">
            <div>
              <dt>Name</dt>
              <dd>{selected.name}</dd>
            </div>
            <div>
              <dt>Address</dt>
              <dd>{selected.address}</dd>
            </div>
            <div>
              <dt>City</dt>
              <dd>{selected.city}</dd>
            </div>
            <div>
              <dt>Description</dt>
              <dd>{selected.description || '—'}</dd>
            </div>
            <div>
              <dt>Total Units</dt>
              <dd>{selected._count?.units ?? 0}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>
                <StatusBadge status={selected.isActive ? 'ACTIVE' : 'INACTIVE'} />
              </dd>
            </div>
            <div>
              <dt>Created</dt>
              <dd>{formatDate(selected.createdAt)}</dd>
            </div>
          </dl>
        ) : null}
      </FormModal>

      <ConfirmDialog
        open={Boolean(archiveTarget)}
        title="Archive property"
        message={`Archive "${archiveTarget?.name ?? ''}"? This soft-deletes the property and its active units.`}
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
