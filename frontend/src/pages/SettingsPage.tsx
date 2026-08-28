import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  bulkUpdateSettings,
  fetchSettings,
  resetSettingsCategory,
} from '../api/settings';
import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { LoadingState } from '../components/ui/LoadingState';
import { Toast } from '../components/ui/Toast';
import { useAuth } from '../context/AuthContext';
import { useApiErrorHandler } from '../hooks/useApiErrorHandler';
import type {
  DashboardColors,
  NumberingConfig,
  SettingCategory,
  SystemSetting,
} from '../types/settings';
import '../styles/forms.css';
import './SettingsPage.css';
import { UsersManagement } from '../components/settings/UsersManagement';

type TabDef = {
  id: SettingCategory;
  label: string;
};

const TABS: TabDef[] = [
  { id: 'BUSINESS', label: 'Business Profile' },
  { id: 'FINANCE', label: 'Finance' },
  { id: 'ELECTRICITY', label: 'Electricity' },
  { id: 'NUMBERING', label: 'Numbering' },
  { id: 'DASHBOARD', label: 'Dashboard Colors' },
  { id: 'BOOKING', label: 'Booking' },
  { id: 'PAYMENT', label: 'Payments' },
  { id: 'EXPENSE', label: 'Expenses' },
  { id: 'SECURITY', label: 'Security' },
  { id: 'APPEARANCE', label: 'Appearance' },
];

const COLOR_LABELS: Array<{ key: keyof DashboardColors; label: string }> = [
  { key: 'AVAILABLE', label: 'Available' },
  { key: 'OCCUPIED', label: 'Occupied (Monthly)' },
  { key: 'OCCUPIED_DAILY', label: 'Occupied (Daily Client)' },
  { key: 'CLEANING_REQUIRED', label: 'Cleaning Required' },
  { key: 'MONTHLY_TENANT_VACANT', label: 'Monthly Tenant Vacant' },
  { key: 'MAINTENANCE', label: 'Maintenance' },
  { key: 'BLOCKED', label: 'Blocked' },
];

const COLOR_DEFAULTS: DashboardColors = {
  AVAILABLE: '#22c55e',
  OCCUPIED: '#3b82f6',
  OCCUPIED_DAILY: '#9333ea',
  CLEANING_REQUIRED: '#ef4444',
  MONTHLY_TENANT_VACANT: '#f5f5f5',
  MAINTENANCE: '#9ca3af',
  BLOCKED: '#000000',
};

function isNumbering(value: unknown): value is NumberingConfig {
  return Boolean(value && typeof value === 'object' && 'prefix' in value);
}

export function SettingsPage() {
  const { token, user } = useAuth();
  const handleApiError = useApiErrorHandler();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const canAccess = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';

  const [tab, setTab] = useState<SettingCategory>('BUSINESS');
  const [rows, setRows] = useState<SystemSetting[]>([]);
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    tone: 'success' | 'error';
  }>({ message: '', tone: 'success' });

  const visibleTabs = useMemo(
    () =>
      TABS.filter((item) => {
        if (item.id === 'SECURITY') return isSuperAdmin;
        return true;
      }),
    [isSuperAdmin],
  );

  const load = useCallback(async () => {
    if (!token || !canAccess) return;
    setIsLoading(true);
    setError('');
    try {
      const data = await fetchSettings(token, tab);
      setRows(data);
      const next: Record<string, unknown> = {};
      for (const row of data) next[row.key] = row.value;
      setDraft(next);
    } catch (err) {
      setError(handleApiError(err, 'Unable to load settings'));
    } finally {
      setIsLoading(false);
    }
  }, [token, tab, canAccess, handleApiError]);

  useEffect(() => {
    void load();
  }, [load]);

  function setField(key: string, value: unknown) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    if (!token || !isSuperAdmin) return;
    setBusy(true);
    try {
      const payload = rows.map((row) => ({
        key: row.key,
        value: draft[row.key],
      }));
      await bulkUpdateSettings(token, payload, `Updated ${tab} settings`);
      setToast({ message: 'Settings saved', tone: 'success' });
      await load();
    } catch (err) {
      setToast({
        message: handleApiError(err, 'Unable to save settings'),
        tone: 'error',
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleReset() {
    if (!token || !isSuperAdmin) return;
    if (!window.confirm(`Reset all ${tab} settings to defaults?`)) return;
    setBusy(true);
    try {
      await resetSettingsCategory(token, tab);
      setToast({ message: 'Category reset to defaults', tone: 'success' });
      await load();
    } catch (err) {
      setToast({
        message: handleApiError(err, 'Unable to reset settings'),
        tone: 'error',
      });
    } finally {
      setBusy(false);
    }
  }

  if (!canAccess) {
    return (
      <section className="module-page">
        <PageHeader title="Settings" breadcrumb={['Home', 'Settings']} />
        <EmptyState
          title="Access denied"
          description="Only Admin and Super Admin can view settings. Receptionist may use public branding only."
        />
      </section>
    );
  }

  const colors = (draft['dashboard.colors'] ?? {}) as DashboardColors;
  const electricityRate = Number(draft['electricity.ratePerUnit'] ?? 95);

  return (
    <section className="module-page settings-page">
      <PageHeader
        title="System Settings"
        breadcrumb={['Home', 'Settings']}
        actions={
          isSuperAdmin ? (
            <div className="settings-page__actions">
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              >
                User Management
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                disabled={busy}
                onClick={() => void handleReset()}
              >
                Reset tab
              </button>
              <button
                type="button"
                className="btn btn--primary"
                disabled={busy}
                onClick={() => void handleSave()}
              >
                {busy ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          ) : null
        }
      />

      {!isSuperAdmin ? (
        <p className="settings-page__notice">
          Admin has read-only access. Super Admin approval is required for
          changes.
        </p>
      ) : null}

      <div className="settings-tabs" role="tablist">
        {visibleTabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            className={
              tab === item.id
                ? 'settings-tabs__btn settings-tabs__btn--active'
                : 'settings-tabs__btn'
            }
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {isLoading ? <LoadingState message="Loading settings…" /> : null}
      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}

      {!isLoading && !error ? (
        <div className="settings-panel module-form">
          {tab === 'ELECTRICITY' ? (
            <div className="settings-preview">
              <strong>Formula preview</strong>
              <p>
                (Current Units − Previous Units) × {electricityRate || 0} = Amount
              </p>
            </div>
          ) : null}

          {tab === 'DASHBOARD' ? (
            <div className="settings-color-grid">
              {COLOR_LABELS.map((item) => (
                <label key={item.key} className="settings-color-card">
                  <span>{item.label}</span>
                  <input
                    type="color"
                    disabled={!isSuperAdmin}
                    value={
                      colors[item.key] ?? COLOR_DEFAULTS[item.key] ?? '#000000'
                    }
                    onChange={(e) =>
                      setField('dashboard.colors', {
                        ...colors,
                        [item.key]: e.target.value,
                      })
                    }
                  />
                  <div
                    className="settings-color-card__swatch"
                    style={{ borderLeftColor: colors[item.key] }}
                  >
                    {item.label}
                  </div>
                </label>
              ))}
            </div>
          ) : null}

          {tab === 'SECURITY' ? (
            <p className="settings-page__warning">
              Changing security settings affects login and session behavior for
              all users. Proceed carefully.
            </p>
          ) : null}

          <div className="module-form__grid">
            {rows.map((row) => {
              if (row.key === 'dashboard.colors') return null;

              if (isNumbering(row.value) || row.dataType === 'JSON') {
                if (!isNumbering(draft[row.key])) {
                  return (
                    <label key={row.key}>
                      <span>{row.key}</span>
                      <textarea
                        disabled={!isSuperAdmin}
                        value={JSON.stringify(draft[row.key] ?? {}, null, 2)}
                        onChange={(e) => {
                          try {
                            setField(row.key, JSON.parse(e.target.value));
                          } catch {
                            // keep typing
                          }
                        }}
                      />
                    </label>
                  );
                }

                const cfg = draft[row.key] as NumberingConfig;
                const year = new Date().getFullYear();
                const preview = `${cfg.prefix}${cfg.separator}${year}${cfg.separator}${'0'.repeat(Math.max(cfg.sequenceLength - 1, 0))}1`;
                return (
                  <div key={row.key} className="settings-numbering">
                    <strong>{row.description || row.key}</strong>
                    <div className="module-form__grid">
                      <label>
                        <span>Prefix</span>
                        <input
                          disabled={!isSuperAdmin}
                          value={cfg.prefix}
                          onChange={(e) =>
                            setField(row.key, { ...cfg, prefix: e.target.value })
                          }
                        />
                      </label>
                      <label>
                        <span>Sequence length</span>
                        <input
                          type="number"
                          disabled={!isSuperAdmin}
                          value={cfg.sequenceLength}
                          onChange={(e) =>
                            setField(row.key, {
                              ...cfg,
                              sequenceLength: Number(e.target.value),
                            })
                          }
                        />
                      </label>
                    </div>
                    <p className="settings-preview-inline">Preview: {preview}</p>
                  </div>
                );
              }

              if (row.dataType === 'BOOLEAN') {
                return (
                  <label key={row.key} className="module-form__checkbox">
                    <input
                      type="checkbox"
                      disabled={!isSuperAdmin}
                      checked={Boolean(draft[row.key])}
                      onChange={(e) => setField(row.key, e.target.checked)}
                    />
                    <span>{row.description || row.key}</span>
                  </label>
                );
              }

              if (row.dataType === 'COLOR') {
                return (
                  <label key={row.key}>
                    <span>{row.description || row.key}</span>
                    <input
                      type="color"
                      disabled={!isSuperAdmin}
                      value={String(draft[row.key] ?? '#d4af37')}
                      onChange={(e) => setField(row.key, e.target.value)}
                    />
                  </label>
                );
              }

              return (
                <label key={row.key}>
                  <span>{row.description || row.key}</span>
                  <input
                    type={row.dataType === 'NUMBER' ? 'number' : 'text'}
                    disabled={!isSuperAdmin}
                    value={String(draft[row.key] ?? '')}
                    onChange={(e) =>
                      setField(
                        row.key,
                        row.dataType === 'NUMBER'
                          ? Number(e.target.value)
                          : e.target.value,
                      )
                    }
                  />
                </label>
              );
            })}
          </div>
        </div>
      ) : null}

      {toast.message ? (
        <Toast
          message={toast.message}
          tone={toast.tone}
          onClose={() => setToast({ message: '', tone: 'success' })}
        />
      ) : null}
      {isSuperAdmin ? (
        <div style={{ marginTop: 24 }}>
          <UsersManagement />
        </div>
      ) : null}
    </section>
  );
}
