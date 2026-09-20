import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  archiveWebsiteFacility,
  createWebsiteFacility,
  fetchWebsiteFacilities,
  updateWebsiteFacility,
  uploadFacilityImage,
} from '../api/website-facilities';
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
import type {
  WebsiteFacility,
  WebsiteFacilityFormValues,
} from '../types/website-facility';
import '../styles/forms.css';

type Mode = 'create' | 'edit' | 'view' | null;

const emptyForm = (): WebsiteFacilityFormValues => ({
  name: '',
  description: '',
  imageUrl: '',
  imageAlt: '',
  sortOrder: '0',
  isActive: true,
});

function resolveImagePreview(url: string): string {
  if (!url) return '';
  if (/^https?:\/\//i.test(url) || url.startsWith('data:') || url.startsWith('blob:')) {
    return url;
  }
  const api =
    (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ||
    '';
  if (!api) return url;
  return url.startsWith('/') ? `${api}${url}` : `${api}/${url}`;
}

export function WebsiteFacilitiesPage() {
  const { token, user } = useAuth();
  const handleApiError = useApiErrorHandler();

  const [facilities, setFacilities] = useState<WebsiteFacility[]>([]);
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
  const [selected, setSelected] = useState<WebsiteFacility | null>(null);
  const [form, setForm] = useState<WebsiteFacilityFormValues>(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof WebsiteFacilityFormValues, string>>
  >({});
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<WebsiteFacility | null>(null);
  const [archiving, setArchiving] = useState(false);
  const imageFileRef = useRef<HTMLInputElement>(null);

  const canManage = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';
  const canArchive = user?.role === 'SUPER_ADMIN';

  async function loadFacilities() {
    if (!token) return;
    setIsLoading(true);
    setError('');
    try {
      const data = await fetchWebsiteFacilities(token, true);
      setFacilities(data);
    } catch (err) {
      setError(handleApiError(err, 'Unable to load website facilities.'));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadFacilities();
  }, [token]);

  const filtered = useMemo(() => {
    return facilities.filter((row) => {
      const matchesSearch = [row.name, row.description ?? '', row.imageAlt ?? '']
        .join(' ')
        .toLowerCase()
        .includes(search.trim().toLowerCase());
      const matchesActive =
        activeFilter === 'all'
          ? true
          : activeFilter === 'active'
            ? row.isActive
            : !row.isActive;
      return matchesSearch && matchesActive;
    });
  }, [facilities, search, activeFilter]);

  function openCreate() {
    setSelected(null);
    setForm(emptyForm());
    setFieldErrors({});
    setMode('create');
  }

  function openEdit(row: WebsiteFacility) {
    setSelected(row);
    setForm({
      name: row.name,
      description: row.description ?? '',
      imageUrl: row.imageUrl,
      imageAlt: row.imageAlt ?? '',
      sortOrder: String(row.sortOrder ?? 0),
      isActive: row.isActive,
    });
    setFieldErrors({});
    setMode('edit');
  }

  function openView(row: WebsiteFacility) {
    setSelected(row);
    setMode('view');
  }

  function validate(values: WebsiteFacilityFormValues) {
    const next: Partial<Record<keyof WebsiteFacilityFormValues, string>> = {};
    if (!values.name.trim()) next.name = 'Name is required.';
    if (!values.imageUrl.trim()) next.imageUrl = 'Please upload an image.';
    const order = Number(values.sortOrder);
    if (values.sortOrder.trim() !== '' && (!Number.isInteger(order) || order < 0)) {
      next.sortOrder = 'Sort order must be zero or a positive whole number.';
    }
    setFieldErrors(next);
    return Object.keys(next).length === 0;
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
      const result = await uploadFacilityImage(token, file);
      setForm((prev) => ({
        ...prev,
        imageUrl: result.url,
        imageAlt: prev.imageAlt || prev.name || file.name,
      }));
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || saving || mode === 'view') return;
    if (!validate(form)) return;

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        imageUrl: form.imageUrl.trim(),
        imageAlt: form.imageAlt.trim() || undefined,
        sortOrder: Number(form.sortOrder) || 0,
        isActive: form.isActive,
      };

      if (mode === 'create') {
        await createWebsiteFacility(token, payload);
        setToast({ message: 'Facility added successfully.', tone: 'success' });
      } else if (mode === 'edit' && selected) {
        await updateWebsiteFacility(token, selected.id, payload);
        setToast({ message: 'Facility updated successfully.', tone: 'success' });
      }

      setMode(null);
      await loadFacilities();
    } catch (err) {
      setToast({
        message: handleApiError(err, 'Unable to save facility.'),
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
      await archiveWebsiteFacility(token, archiveTarget.id);
      setToast({ message: 'Facility archived successfully.', tone: 'success' });
      setArchiveTarget(null);
      await loadFacilities();
    } catch (err) {
      setToast({
        message: handleApiError(err, 'Unable to archive facility.'),
        tone: 'error',
      });
    } finally {
      setArchiving(false);
    }
  }

  const columns: Array<DataTableColumn<WebsiteFacility>> = [
    {
      key: 'image',
      header: 'Image',
      render: (row) => (
        <img
          src={resolveImagePreview(row.imageUrl)}
          alt={row.imageAlt || row.name}
          style={{
            width: 56,
            height: 40,
            objectFit: 'cover',
            borderRadius: 6,
          }}
        />
      ),
    },
    {
      key: 'name',
      header: 'Name',
      render: (row) => row.name,
    },
    {
      key: 'description',
      header: 'Description',
      render: (row) => row.description || '—',
    },
    {
      key: 'sortOrder',
      header: 'Order',
      render: (row) => row.sortOrder,
    },
    {
      key: 'status',
      header: 'Status',
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
          {canManage ? (
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
        title="Website Facilities"
        breadcrumb={['Home', 'Website Facilities']}
      />

      {canManage ? (
        <div className="entity-page__toolbar">
          <button type="button" className="btn btn--primary" onClick={openCreate}>
            Add Facility
          </button>
        </div>
      ) : null}

      <FilterBar>
        <label>
          <span>Search</span>
          <input
            type="search"
            value={search}
            placeholder="Name or description"
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

      {isLoading ? <LoadingState message="Loading facilities…" /> : null}
      {!isLoading && error ? (
        <ErrorState message={error} onRetry={() => void loadFacilities()} />
      ) : null}
      {!isLoading && !error && filtered.length === 0 ? (
        <EmptyState
          title="No facilities yet"
          description="Add hotel facilities to show them on the public website."
        />
      ) : null}
      {!isLoading && !error && filtered.length > 0 ? (
        <DataTable columns={columns} rows={filtered} rowKey={(row) => row.id} />
      ) : null}

      <FormModal
        open={mode === 'create' || mode === 'edit'}
        title={mode === 'create' ? 'Add Facility' : 'Edit Facility'}
        onClose={() => !saving && !uploadingImage && setMode(null)}
      >
        <form className="form-grid" onSubmit={handleSubmit} noValidate>
          <label className="form-field">
            <span>Name</span>
            <input
              value={form.name}
              placeholder="e.g. Pool"
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
            {fieldErrors.name ? (
              <em className="form-field__error">{fieldErrors.name}</em>
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

          <div className="form-field">
            <span>Image</span>
            <input
              ref={imageFileRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              hidden
              onChange={(event) =>
                void handleImageUpload(event.target.files?.[0])
              }
            />
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn--primary"
                disabled={uploadingImage || saving}
                onClick={() => imageFileRef.current?.click()}
              >
                {uploadingImage
                  ? 'Uploading…'
                  : form.imageUrl
                    ? 'Change image'
                    : 'Upload image'}
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
            {fieldErrors.imageUrl ? (
              <em className="form-field__error">{fieldErrors.imageUrl}</em>
            ) : null}
            {form.imageUrl ? (
              <img
                src={resolveImagePreview(form.imageUrl)}
                alt={form.imageAlt || form.name || 'Facility preview'}
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

          <label className="form-field">
            <span>Image alt text</span>
            <input
              value={form.imageAlt}
              placeholder="Short description for accessibility"
              onChange={(event) =>
                setForm({ ...form, imageAlt: event.target.value })
              }
            />
          </label>

          <label className="form-field">
            <span>Display order</span>
            <input
              type="number"
              min={0}
              value={form.sortOrder}
              onChange={(event) =>
                setForm({ ...form, sortOrder: event.target.value })
              }
            />
            {fieldErrors.sortOrder ? (
              <em className="form-field__error">{fieldErrors.sortOrder}</em>
            ) : null}
          </label>

          <label className="form-field form-field--checkbox">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) =>
                setForm({ ...form, isActive: event.target.checked })
              }
            />
            <span>Show on website</span>
          </label>

          <div className="form-actions">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setMode(null)}
              disabled={saving || uploadingImage}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn--primary"
              disabled={saving || uploadingImage}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </FormModal>

      <FormModal
        open={mode === 'view'}
        title="Facility Details"
        onClose={() => setMode(null)}
      >
        {selected ? (
          <dl className="detail-list">
            <div>
              <dt>Image</dt>
              <dd>
                <img
                  src={resolveImagePreview(selected.imageUrl)}
                  alt={selected.imageAlt || selected.name}
                  style={{
                    maxWidth: '100%',
                    maxHeight: 200,
                    objectFit: 'cover',
                    borderRadius: 8,
                  }}
                />
              </dd>
            </div>
            <div>
              <dt>Name</dt>
              <dd>{selected.name}</dd>
            </div>
            <div>
              <dt>Description</dt>
              <dd>{selected.description || '—'}</dd>
            </div>
            <div>
              <dt>Order</dt>
              <dd>{selected.sortOrder}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>
                <StatusBadge
                  status={selected.isActive ? 'ACTIVE' : 'INACTIVE'}
                />
              </dd>
            </div>
          </dl>
        ) : null}
      </FormModal>

      <ConfirmDialog
        open={Boolean(archiveTarget)}
        title="Archive facility"
        message={`Archive "${archiveTarget?.name ?? ''}"? It will be hidden from the website.`}
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
