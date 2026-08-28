import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  fetchNotificationSummary,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../api/notifications';
import { PageHeader } from '../components/PageHeader';
import { DataTable, type DataTableColumn } from '../components/ui/DataTable';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { FilterBar } from '../components/ui/FilterBar';
import { LoadingState } from '../components/ui/LoadingState';
import { Toast } from '../components/ui/Toast';
import { resolveNotificationTarget } from '../config/navigation';
import { useAuth } from '../context/AuthContext';
import { useApiErrorHandler } from '../hooks/useApiErrorHandler';
import type { AppNotification } from '../types/approval';
import '../styles/forms.css';
import './ApprovalsPage.css';
import './SettingsPage.css';

type TabKey = 'ALL' | 'UNREAD' | 'READ' | 'CRITICAL';

function formatWhen(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function NotificationsPage() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const handleApiError = useApiErrorHandler();

  const [tab, setTab] = useState<TabKey>('ALL');
  const [rows, setRows] = useState<AppNotification[]>([]);
  const [summary, setSummary] = useState({
    unread: 0,
    critical: 0,
    todayReminders: 0,
    upcomingExpiry: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [module, setModule] = useState('');
  const [toast, setToast] = useState<{
    message: string;
    tone: 'success' | 'error';
  }>({ message: '', tone: 'success' });

  const load = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError('');
    try {
      const [data, stats] = await Promise.all([
        fetchNotifications(token, {
          unreadOnly: tab === 'UNREAD',
          priority: tab === 'CRITICAL' ? 'CRITICAL' : undefined,
          module: module || undefined,
          search: search || undefined,
        }),
        fetchNotificationSummary(token),
      ]);
      const filtered =
        tab === 'READ' ? data.filter((row) => row.isRead) : data;
      setRows(filtered);
      setSummary(stats);
    } catch (err) {
      setError(handleApiError(err, 'Unable to load notifications'));
    } finally {
      setIsLoading(false);
    }
  }, [token, tab, module, search, handleApiError]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 30000);
    return () => window.clearInterval(timer);
  }, [load]);

  async function openRow(row: AppNotification) {
    if (!token) return;
    try {
      if (!row.isRead) {
        await markNotificationRead(token, row.id);
      }
      const target = resolveNotificationTarget(row, user?.role);
      if (target) navigate(target);
      await load();
    } catch (err) {
      setToast({
        message: handleApiError(err, 'Unable to open notification'),
        tone: 'error',
      });
    }
  }

  const columns: DataTableColumn<AppNotification>[] = [
    {
      key: 'title',
      header: 'Title',
      render: (row) => (
        <div>
          <strong>{row.title}</strong>
          <div style={{ color: '#b8b8b8', fontSize: '0.8rem' }}>
            {row.message}
          </div>
        </div>
      ),
    },
    {
      key: 'priority',
      header: 'Priority',
      render: (row) => row.priority ?? 'NORMAL',
    },
    {
      key: 'module',
      header: 'Module',
      render: (row) => row.relatedModule ?? '—',
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (row.isRead ? 'Read' : 'Unread'),
    },
    {
      key: 'time',
      header: 'Time',
      render: (row) => formatWhen(row.createdAt),
    },
    {
      key: 'actions',
      header: 'Action',
      render: (row) => (
        <button type="button" onClick={() => void openRow(row)}>
          Open
        </button>
      ),
    },
  ];

  async function handleMarkAll() {
    if (!token) return;
    try {
      await markAllNotificationsRead(token);
      setToast({ message: 'All notifications marked read', tone: 'success' });
      await load();
    } catch (err) {
      setToast({
        message: handleApiError(err, 'Unable to mark all read'),
        tone: 'error',
      });
    }
  }

  return (
    <section className="module-page">
      <PageHeader
        title="Notification Center"
        breadcrumb={['Home', 'Notifications']}
        actions={
          <button type="button" className="btn btn--primary" onClick={() => void handleMarkAll()}>
            Mark all read
          </button>
        }
      />

      <div className="dashboard-summary-grid" style={{ marginBottom: '1rem' }}>
        <div className="summary-card">
          <span>Unread</span>
          <strong>{summary.unread}</strong>
        </div>
        <div className="summary-card">
          <span>Critical</span>
          <strong>{summary.critical}</strong>
        </div>
        <div className="summary-card">
          <span>Today reminders</span>
          <strong>{summary.todayReminders}</strong>
        </div>
        <div className="summary-card">
          <span>Upcoming expiry</span>
          <strong>{summary.upcomingExpiry}</strong>
        </div>
      </div>

      <div className="settings-tabs" role="tablist">
        {(['ALL', 'UNREAD', 'READ', 'CRITICAL'] as TabKey[]).map((item) => (
          <button
            key={item}
            type="button"
            className={
              tab === item
                ? 'settings-tabs__btn settings-tabs__btn--active'
                : 'settings-tabs__btn'
            }
            onClick={() => setTab(item)}
          >
            {item}
          </button>
        ))}
      </div>

      <FilterBar>
        <input
          placeholder="Search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <input
          placeholder="Module"
          value={module}
          onChange={(e) => setModule(e.target.value)}
        />
      </FilterBar>

      {isLoading ? <LoadingState message="Loading notifications…" /> : null}
      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}
      {!isLoading && !error && rows.length === 0 ? (
        <EmptyState title="No notifications" description="You are all caught up." />
      ) : null}
      {!isLoading && !error && rows.length > 0 ? (
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
        />
      ) : null}

      {toast.message ? (
        <Toast
          message={toast.message}
          tone={toast.tone}
          onClose={() => setToast({ message: '', tone: 'success' })}
        />
      ) : null}
    </section>
  );
}
