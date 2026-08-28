import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  dashboardFilterQueryKey,
  fetchDashboardFilterOptions,
  fetchDashboardRoomGrid,
  fetchDashboardSummary,
} from '../api/dashboard';
import { fetchNotificationSummary } from '../api/notifications';
import { fetchPublicSettings } from '../api/settings';
import { checkOutBooking } from '../api/bookings';
import { BookingTypeBreakdown } from '../components/dashboard/BookingTypeBreakdown';
import { OccupancyOverview } from '../components/dashboard/OccupancyOverview';
import { TodaySummary } from '../components/dashboard/TodaySummary';
import { UnitDetailModal } from '../components/dashboard/UnitDetailModal';
import { UnitGridFilters } from '../components/dashboard/UnitGridFilters';
import { UnitStatusGrid } from '../components/dashboard/UnitStatusGrid';
import { isEarlyHotelCheckout } from '../components/dashboard/UnitStatusCard';
import { UpcomingExpiry } from '../components/dashboard/UpcomingExpiry';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Toast } from '../components/ui/Toast';
import { useAuth } from '../context/AuthContext';
import type {
  DashboardDisplayStatus,
  DashboardFilterOptions,
  DashboardFiltersState,
  DashboardRoomGridItem,
  DashboardSummary,
  UnitGridViewMode,
} from '../types/dashboard';
import type { DashboardColors } from '../types/settings';
import { formatHotelDateTime } from '../lib/format';
import './DashboardPage.css';

const STATUS_FILTER_LABELS: Record<Exclude<DashboardDisplayStatus, ''>, string> =
  {
    AVAILABLE: 'Available',
    OCCUPIED: 'Occupied',
    CLEANING_REQUIRED: 'Cleaning Required',
    MONTHLY_TENANT_VACANT: 'Monthly Tenant Empty',
    MAINTENANCE: 'Maintenance',
    BLOCKED: 'Blocked',
  };

const initialFilters = (): DashboardFiltersState => {
  const now = new Date();
  return {
    propertyId: '',
    apartmentId: '',
    unitId: '',
    displayStatus: '',
    status: '',
    unitType: '',
    bookingType: '',
    search: '',
    period: 'today',
    date: '',
    month: String(now.getMonth() + 1),
    year: String(now.getFullYear()),
    dateFrom: '',
    dateTo: '',
  };
};

function setDisplayStatus(
  filters: DashboardFiltersState,
  displayStatus: DashboardDisplayStatus,
): DashboardFiltersState {
  return { ...filters, displayStatus, status: displayStatus };
}

function formatPkr(value: number | undefined): string {
  if (value === undefined) return '—';
  return `Rs. ${new Intl.NumberFormat('en-PK', {
    maximumFractionDigits: 0,
  }).format(value)}`;
}

function pct(part: number, total: number): string {
  if (total <= 0) return '0%';
  return `${Math.round((part / total) * 100)}%`;
}

type OpsCardDef = {
  key: string;
  label: string;
  value: number;
  hint: string;
  tone: string;
  filter: DashboardDisplayStatus | 'ALL';
};

export function DashboardPage() {
  const { token, user } = useAuth();
  const [filters, setFilters] = useState<DashboardFiltersState>(initialFilters);
  const [filterOptions, setFilterOptions] =
    useState<DashboardFilterOptions | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [rooms, setRooms] = useState<DashboardRoomGridItem[]>([]);
  const [notificationStats, setNotificationStats] = useState({
    unread: 0,
    critical: 0,
    todayReminders: 0,
    upcomingExpiry: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [gridError, setGridError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [viewMode, setViewMode] = useState<UnitGridViewMode>('grid');
  const [groupByProperty, setGroupByProperty] = useState(true);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [checkoutUnit, setCheckoutUnit] = useState<DashboardRoomGridItem | null>(
    null,
  );
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    tone: 'success' | 'error';
  } | null>(null);
  const roomGridRef = useRef<HTMLDivElement>(null);

  const revealRoomGrid = useCallback(() => {
    window.requestAnimationFrame(() => {
      roomGridRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    });
  }, []);

  const role = user?.role;
  const canViewFinancials =
    role === 'SUPER_ADMIN' ||
    (role === 'ADMIN' && Boolean(user?.canAccessProfitLoss));
  const canViewOutstanding =
    role === 'SUPER_ADMIN' ||
    role === 'ADMIN' ||
    role === 'RECEPTIONIST';
  const isSuperAdmin = role === 'SUPER_ADMIN';
  const canManageUnits = role === 'SUPER_ADMIN' || role === 'ADMIN';

  const filterKey = useMemo(
    () => dashboardFilterQueryKey(filters),
    [filters],
  );

  useEffect(() => {
    if (!token) return;

    void fetchPublicSettings()
      .then((settings) => {
        const colorsRow = settings.find((s) => s.key === 'dashboard.colors');
        const colors = colorsRow?.value as DashboardColors | undefined;
        if (!colors) return;
        const root = document.documentElement;
        root.style.setProperty('--status-available', colors.AVAILABLE);
        root.style.setProperty('--status-occupied', colors.OCCUPIED);
        root.style.setProperty(
          '--status-occupied-daily',
          colors.OCCUPIED_DAILY ?? '#9333ea',
        );
        root.style.setProperty('--status-cleaning', colors.CLEANING_REQUIRED);
        root.style.setProperty(
          '--status-monthly-vacant',
          colors.MONTHLY_TENANT_VACANT,
        );
        root.style.setProperty('--status-maintenance', colors.MAINTENANCE);
        root.style.setProperty('--status-blocked', colors.BLOCKED);
      })
      .catch(() => undefined);

    void fetchDashboardFilterOptions(token)
      .then(setFilterOptions)
      .catch(() => setFilterOptions(null));

    void fetchNotificationSummary(token)
      .then(setNotificationStats)
      .catch(() => {
        setNotificationStats({
          unread: 0,
          critical: 0,
          todayReminders: 0,
          upcomingExpiry: 0,
        });
      });
  }, [token]);

  useEffect(() => {
    if (!token) return;
    let active = true;

    async function loadDashboard() {
      setIsLoading(true);
      setError('');
      setGridError('');
      try {
        const [summaryResult, roomResult] = await Promise.allSettled([
          fetchDashboardSummary(token!, filters),
          fetchDashboardRoomGrid(token!, filters),
        ]);
        if (!active) return;
        if (summaryResult.status === 'fulfilled') {
          setSummary(summaryResult.value);
        } else {
          setSummary(null);
          setError(
            summaryResult.reason instanceof Error
              ? summaryResult.reason.message
              : 'Unable to load dashboard summary',
          );
        }
        if (roomResult.status === 'fulfilled') {
          setRooms(roomResult.value);
        } else {
          setRooms([]);
          setGridError(
            roomResult.reason instanceof Error
              ? roomResult.reason.message
              : 'Unable to load room grid',
          );
        }
      } catch (err) {
        if (!active) return;
        const message =
          err instanceof Error ? err.message : 'Unable to load dashboard';
        setError(message);
        setGridError(message);
      } finally {
        if (active) setIsLoading(false);
      }
    }

    void loadDashboard();
    return () => {
      active = false;
    };
    // filterKey encodes filters; refreshKey forces reload after mutations.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, filterKey, refreshKey]);

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const handleDashboardCheckOut = useCallback(async () => {
    if (!token || !checkoutUnit?.bookingId) return;
    setCheckoutBusy(true);
    try {
      await checkOutBooking(token, checkoutUnit.bookingId);
      setToast({
        message: 'Guest checked out. Check-out date and time updated to now.',
        tone: 'success',
      });
      setCheckoutUnit(null);
      refresh();
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : 'Unable to check out.',
        tone: 'error',
      });
    } finally {
      setCheckoutBusy(false);
    }
  }, [token, checkoutUnit, refresh]);

  const totalUnits = useMemo(() => {
    if (!summary) return 0;
    return summary.totalRooms + summary.totalApartments;
  }, [summary]);

  const activeDisplayStatus = (filters.displayStatus ||
    filters.status) as DashboardDisplayStatus;

  const handleOpsCardClick = useCallback(
    (filter: OpsCardDef['filter']) => {
      if (filter === 'ALL') {
        setFilters((current) => setDisplayStatus(current, ''));
        revealRoomGrid();
        return;
      }
      setFilters((current) => {
        const currentStatus = current.displayStatus || current.status;
        if (currentStatus === filter) {
          return setDisplayStatus(current, '');
        }
        return setDisplayStatus(current, filter);
      });
      revealRoomGrid();
    },
    [revealRoomGrid],
  );

  const handleFiltersChange = useCallback(
    (next: DashboardFiltersState) => {
      const statusChanged =
        (next.displayStatus || next.status) !==
        (filters.displayStatus || filters.status);
      const selectionChanged =
        next.propertyId !== filters.propertyId ||
        next.apartmentId !== filters.apartmentId;
      setFilters(next);
      if (statusChanged || selectionChanged) {
        revealRoomGrid();
      }
    },
    [filters, revealRoomGrid],
  );

  const resetAllFilters = useCallback(() => {
    setFilters(initialFilters());
    revealRoomGrid();
  }, [revealRoomGrid]);

  const clearStatusFilter = useCallback(() => {
    setFilters((current) => setDisplayStatus(current, ''));
    revealRoomGrid();
  }, [revealRoomGrid]);

  const operationalCards: OpsCardDef[] = [
    {
      key: 'all',
      label: 'All Units',
      value: totalUnits,
      hint: 'View all',
      tone: 'blue',
      filter: 'ALL',
    },
    {
      key: 'available',
      label: 'Available',
      value: summary?.available ?? 0,
      hint: pct(summary?.available ?? 0, totalUnits),
      tone: 'green',
      filter: 'AVAILABLE',
    },
    {
      key: 'occupied',
      label: 'Occupied',
      value: summary?.occupied ?? 0,
      hint: pct(summary?.occupied ?? 0, totalUnits),
      tone: 'mint',
      filter: 'OCCUPIED',
    },
    {
      key: 'cleaning',
      label: 'Cleaning Required',
      value: summary?.cleaning ?? 0,
      hint: pct(summary?.cleaning ?? 0, totalUnits),
      tone: 'pink',
      filter: 'CLEANING_REQUIRED',
    },
    {
      key: 'monthlyEmpty',
      label: 'Monthly Tenant Empty',
      value: summary?.monthlyEmpty ?? 0,
      hint: pct(summary?.monthlyEmpty ?? 0, totalUnits),
      tone: 'amber',
      filter: 'MONTHLY_TENANT_VACANT',
    },
    {
      key: 'maintenance',
      label: 'Maintenance',
      value: summary?.maintenance ?? 0,
      hint: pct(summary?.maintenance ?? 0, totalUnits),
      tone: 'lavender',
      filter: 'MAINTENANCE',
    },
    {
      key: 'blocked',
      label: 'Blocked',
      value: summary?.blocked ?? 0,
      hint: pct(summary?.blocked ?? 0, totalUnits),
      tone: 'slate',
      filter: 'BLOCKED',
    },
  ];

  const showingLabel = activeDisplayStatus
    ? STATUS_FILTER_LABELS[activeDisplayStatus]
    : null;

  return (
    <section className="dashboard-page">
      <header className="dashboard-page__hero">
        <div>
          <h1>Dashboard</h1>
          <p>Welcome back, {user?.fullName ?? 'User'}</p>
        </div>
      </header>

      <UnitGridFilters
        value={filters}
        options={filterOptions}
        onChange={handleFiltersChange}
        onRefresh={refresh}
        onResetAll={resetAllFilters}
        isLoading={isLoading}
      />

      {error ? (
        <p className="dashboard-page__error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="dashboard-page__ops">
        {isLoading && !summary
          ? Array.from({ length: 7 }, (_, i) => (
              <div
                key={i}
                className="dashboard-page__skeleton dashboard-page__skeleton--ops"
              />
            ))
          : operationalCards.map((card) => {
              const isActive =
                card.filter === 'ALL'
                  ? !activeDisplayStatus
                  : activeDisplayStatus === card.filter;
              return (
                <button
                  key={card.key}
                  type="button"
                  className={`dash-ops-card dash-ops-card--${card.tone}${
                    isActive ? ' dash-ops-card--active' : ''
                  }`}
                  aria-pressed={isActive}
                  onClick={() => handleOpsCardClick(card.filter)}
                >
                  <p className="dash-ops-card__label">{card.label}</p>
                  <p className="dash-ops-card__value">{card.value}</p>
                  <p className="dash-ops-card__hint">{card.hint}</p>
                </button>
              );
            })}
      </div>

      <div className="dashboard-page__finance">
        <article className="dash-finance-card">
          <p className="dash-finance-card__label">Total Income</p>
          <p className="dash-finance-card__value">
            {canViewFinancials ? formatPkr(summary?.income) : '—'}
          </p>
          <p className="dash-finance-card__hint">
            {canViewFinancials ? 'Selected period' : 'Restricted for your role'}
          </p>
        </article>
        <article className="dash-finance-card">
          <p className="dash-finance-card__label">Total Expenses</p>
          <p className="dash-finance-card__value">
            {canViewFinancials ? formatPkr(summary?.expenses) : '—'}
          </p>
          <p className="dash-finance-card__hint">
            {canViewFinancials ? 'Selected period' : 'Restricted for your role'}
          </p>
        </article>
        <article className="dash-finance-card">
          <p className="dash-finance-card__label">Net Profit</p>
          <p className="dash-finance-card__value">
            {canViewFinancials ? formatPkr(summary?.profit) : '—'}
          </p>
          <p className="dash-finance-card__hint">
            {canViewFinancials ? 'Income − expenses' : 'Restricted for your role'}
          </p>
        </article>
        <article className="dash-finance-card">
          <p className="dash-finance-card__label">Outstanding Receivable</p>
          <p className="dash-finance-card__value">
            {canViewOutstanding ? formatPkr(summary?.outstanding) : '—'}
          </p>
          <p className="dash-finance-card__hint">
            {role === 'RECEPTIONIST'
              ? 'Checked-in guest balances'
              : canViewFinancials
                ? 'Open receivables'
                : 'Operational outstanding'}
          </p>
        </article>
        <article className="dash-activity-card">
          <p className="dash-activity-card__label">Today&apos;s Check-ins</p>
          <p className="dash-activity-card__value">
            {summary?.todayCheckin ?? 0}
          </p>
        </article>
        <article className="dash-activity-card">
          <p className="dash-activity-card__label">Today&apos;s Check-outs</p>
          <p className="dash-activity-card__value">
            {summary?.todayCheckout ?? 0}
          </p>
        </article>
      </div>

      <div className="dashboard-page__mid">
        <OccupancyOverview summary={summary} />
        <BookingTypeBreakdown units={rooms} />
        <TodaySummary
          rows={[
            {
              key: 'checkins',
              label: 'Check Ins',
              count: summary?.todayCheckin ?? 0,
              tone: 'blue',
            },
            {
              key: 'checkouts',
              label: 'Check Outs',
              count: summary?.todayCheckout ?? 0,
              tone: 'amber',
            },
            {
              key: 'bookings',
              label: 'New Bookings',
              count: summary?.todaysActivity ?? 0,
              tone: 'green',
            },
            ...(isSuperAdmin
              ? [
                  {
                    key: 'approvals',
                    label: 'Pending Approvals',
                    count: summary?.pendingApprovals ?? 0,
                    tone: 'gold' as const,
                  },
                ]
              : []),
          ]}
        />
        <UpcomingExpiry
          items={[]}
          upcomingCount={notificationStats.upcomingExpiry}
        />
      </div>

      {showingLabel ? (
        <div className="dashboard-page__filter-chip" role="status">
          <span>
            Showing: {showingLabel} · {rooms.length} result
            {rooms.length === 1 ? '' : 's'}
          </span>
          <button type="button" onClick={clearStatusFilter}>
            Clear Filter
          </button>
        </div>
      ) : null}

      <div ref={roomGridRef} id="dashboard-room-grid">
        <UnitStatusGrid
          units={rooms}
          viewMode={viewMode}
          groupByProperty={groupByProperty}
          isLoading={isLoading}
          error={gridError}
          onRetry={refresh}
          onUnitClick={setSelectedUnitId}
          onCheckOut={setCheckoutUnit}
          onViewModeChange={setViewMode}
          onGroupByChange={setGroupByProperty}
        />
      </div>

      {token ? (
        <UnitDetailModal
          open={Boolean(selectedUnitId)}
          unitId={selectedUnitId}
          token={token}
          role={role ?? 'RECEPTIONIST'}
          isSuperAdmin={isSuperAdmin}
          canManageUnits={canManageUnits}
          onClose={() => setSelectedUnitId(null)}
          onChanged={refresh}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(checkoutUnit)}
        title={
          checkoutUnit && isEarlyHotelCheckout(checkoutUnit)
            ? 'Check out now (early)?'
            : 'Check out guest?'
        }
        message={
          checkoutUnit
            ? `${checkoutUnit.guestName ?? 'This guest'} will be checked out now. The check-out date and time will change to this moment${
                checkoutUnit.checkoutDate
                  ? ` (planned was ${formatHotelDateTime(checkoutUnit.checkoutDate)})`
                  : ''
              }. Stay charges use the nights actually stayed. The room will become CLEANING_REQUIRED.`
            : ''
        }
        confirmLabel={
          checkoutUnit && isEarlyHotelCheckout(checkoutUnit)
            ? 'Early Check Out'
            : 'Check Out'
        }
        busy={checkoutBusy}
        onCancel={() => setCheckoutUnit(null)}
        onConfirm={() => void handleDashboardCheckOut()}
      />

      {toast ? (
        <Toast
          message={toast.message}
          tone={toast.tone}
          onClose={() => setToast(null)}
        />
      ) : null}
    </section>
  );
}
