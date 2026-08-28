import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  cancelBooking,
  checkInBooking,
  checkOutBooking,
  confirmBooking,
  createBooking,
  fetchBookingSummary,
  fetchBookings,
  markAccountsCleared,
  markBookingNoShow,
  markCleaningCleared,
  updateBooking,
} from '../api/bookings';
import { isPendingApprovalError } from '../api/client';
import { archiveGuest, createGuest, fetchGuests, updateGuest } from '../api/guests';
import { fetchProperties } from '../api/properties';
import { fetchUnits } from '../api/units';
import { BookingDetailModal } from '../components/daily-guests/BookingDetailModal';
import { BookingFormModal } from '../components/daily-guests/BookingFormModal';
import { GuestFormModal } from '../components/daily-guests/GuestFormModal';
import { PaymentFormModal } from '../components/payments/PaymentFormModal';
import { SummaryCard } from '../components/dashboard/SummaryCard';
import { PageHeader } from '../components/PageHeader';
import { BookingStatusBadge } from '../components/ui/BookingStatusBadge';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { DataTable, type DataTableColumn } from '../components/ui/DataTable';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { FilterBar } from '../components/ui/FilterBar';
import { LoadingState } from '../components/ui/LoadingState';
import { MoneyDisplay } from '../components/ui/MoneyDisplay';
import { PaymentStatusBadge } from '../components/ui/PaymentStatusBadge';
import { RowMoreMenu } from '../components/ui/RowMoreMenu';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Toast } from '../components/ui/Toast';
import { useAuth } from '../context/AuthContext';
import { useApiErrorHandler } from '../hooks/useApiErrorHandler';
import { notifyFinanceChanged } from '../lib/finance-events';
import { formatDate, formatDateShort, formatHotelTime, formatLabel, formatPkr } from '../lib/format';
import { invalidateEligibleUnitsQueries } from '../lib/query-cache';
import type {
  Booking,
  BookingInput,
  BookingStatus,
  BookingSummary,
  BookingType,
  PaymentState,
} from '../types/booking';
import type { DashboardUnitNavState } from '../types/dashboard';
import type { Guest, GuestInput } from '../types/guest';
import type { Property } from '../types/property';
import type { Unit } from '../types/unit';
import '../styles/forms.css';
import './DailyGuestsPage.css';

const now = new Date();

type TabKey = 'directory' | 'bookings';

function isDashboardNavState(value: unknown): value is DashboardUnitNavState {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    v.source === 'dashboard' &&
    typeof v.propertyId === 'string' &&
    typeof v.unitId === 'string'
  );
}

function stayDuration(row: Booking): string {
  if (row.bookingType === 'HOURLY') {
    const hours = row.numberOfHours ?? 0;
    return `${hours} ${hours === 1 ? 'Hour' : 'Hours'}`;
  }
  const nights = row.numberOfDays ?? 0;
  return `${nights} ${nights === 1 ? 'Night' : 'Nights'}`;
}

function StayWhen({
  planned,
  actual,
}: {
  planned: string;
  actual?: string | null;
}) {
  const when = actual || planned;
  const plannedDiffers =
    Boolean(actual) &&
    new Date(actual as string).getTime() !== new Date(planned).getTime();
  return (
    <div className="daily-guests-page__when">
      <span className="daily-guests-page__when-time">
        {formatHotelTime(when)}
      </span>
      <span className="daily-guests-page__when-date">
        {formatDateShort(when)}
      </span>
      {plannedDiffers ? (
        <span className="daily-guests-page__when-actual">
          Planned {formatHotelTime(planned)}
        </span>
      ) : null}
    </div>
  );
}

function moneyDue(value: string | null | undefined): boolean {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0;
}

export function DailyGuestsPage() {
  const { token, user } = useAuth();
  const handleApiError = useApiErrorHandler();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const role = user?.role;
  const isSuperAdmin = role === 'SUPER_ADMIN';
  const isAdmin = role === 'ADMIN';
  const isReceptionist = role === 'RECEPTIONIST';
  const canCreate = Boolean(role);
  const canConfirm = isSuperAdmin || isAdmin || isReceptionist;
  const canCheckIn = canConfirm;
  const canCheckOut = canConfirm;
  const canCancel = canConfirm;
  const canNoShow = isSuperAdmin || isAdmin;
  const canClearFlags = canConfirm;

  const [tab, setTab] = useState<TabKey>('bookings');

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [summary, setSummary] = useState<BookingSummary | null>(null);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [bookingGuests, setBookingGuests] = useState<Guest[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);

  // Separate searches so booking filters never hide Guest Directory rows.
  const [directorySearch, setDirectorySearch] = useState('');
  const [bookingSearch, setBookingSearch] = useState('');
  const [directoryActive, setDirectoryActive] = useState<'all' | 'true' | 'false'>(
    'true',
  );
  const [createdGuestNotice, setCreatedGuestNotice] = useState<string | null>(
    null,
  );
  const [propertyId, setPropertyId] = useState('');
  const [unitId, setUnitId] = useState('');
  const [bookingType, setBookingType] = useState<BookingType | ''>('');
  const [bookingStatus, setBookingStatus] = useState<BookingStatus | ''>('');
  const [paymentState, setPaymentState] = useState<PaymentState | ''>('');
  const [todayOnly, setTodayOnly] = useState(false);
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<{
    message: string;
    tone: 'success' | 'error';
  }>({ message: '', tone: 'success' });

  const [showGuestForm, setShowGuestForm] = useState(false);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [editingGuest, setEditingGuest] = useState<Guest | null>(null);
  const [defaultGuestId, setDefaultGuestId] = useState<string | null>(null);
  const [guestToArchive, setGuestToArchive] = useState<Guest | null>(null);
  const [archivingGuest, setArchivingGuest] = useState(false);
  const [bookingPreset, setBookingPreset] = useState<{
    propertyId: string;
    unitId: string;
    unitLabel?: string;
    lockSelection?: boolean;
  } | null>(null);
  const [returnToDashboard, setReturnToDashboard] = useState(false);
  const [savingGuest, setSavingGuest] = useState(false);
  const [savingBooking, setSavingBooking] = useState(false);
  const consumedDashboardNav = useRef(false);

  const [selected, setSelected] = useState<Booking | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [busyAction, setBusyAction] = useState(false);

  const [confirmAction, setConfirmAction] = useState<{
    type: 'cancel' | 'checkout' | 'noshow' | 'checkin';
    booking: Booking;
  } | null>(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentRefreshKey, setPaymentRefreshKey] = useState(0);

  const directoryLoadSeq = useRef(0);
  const skipNextDirectoryEffect = useRef(false);

  const bookingQuery = useMemo(
    () => ({
      search: bookingSearch.trim() || undefined,
      propertyId: propertyId || undefined,
      unitId: unitId || undefined,
      bookingType,
      bookingStatus,
      paymentState,
      today: todayOnly || undefined,
      month: month ? Number(month) : ('' as const),
      year: year ? Number(year) : ('' as const),
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    }),
    [
      bookingSearch,
      propertyId,
      unitId,
      bookingType,
      bookingStatus,
      paymentState,
      todayOnly,
      month,
      year,
      startDate,
      endDate,
    ],
  );

  async function loadDirectory(options?: {
    search?: string;
    directoryActive?: 'all' | 'true' | 'false';
  }) {
    if (!token) return [];
    const activeFilter = options?.directoryActive ?? directoryActive;
    const searchTerm =
      options?.search !== undefined ? options.search : directorySearch;
    const isActive =
      activeFilter === 'all' ? undefined : activeFilter === 'true';
    const seq = ++directoryLoadSeq.current;
    const rows = await fetchGuests(token, {
      search: searchTerm.trim() || undefined,
      isActive,
    });
    if (seq !== directoryLoadSeq.current) {
      return rows;
    }
    setGuests(rows);
    return rows;
  }

  async function refreshBookingGuests() {
    if (!token) return;
    const rows = await fetchGuests(token, { isActive: true });
    setBookingGuests(rows);
  }

  async function loadBookings() {
    if (!token) return;
    const [rows, stats] = await Promise.all([
      fetchBookings(token, bookingQuery),
      fetchBookingSummary(token, bookingQuery),
    ]);
    setBookings(rows);
    setSummary(stats);
  }

  async function loadSummaryOnly() {
    if (!token) return;
    try {
      const stats = await fetchBookingSummary(token, {});
      setSummary(stats);
    } catch {
      // Summary is non-blocking; never hide the guest table for this.
    }
  }

  async function loadDirectoryTab(options?: { showSpinner?: boolean }) {
    if (!token) return;
    const showSpinner = options?.showSpinner ?? true;
    if (showSpinner) {
      setIsLoading(true);
    }
    setError('');

    try {
      await loadDirectory();
      void loadSummaryOnly();
    } catch (err) {
      setError(handleApiError(err, 'Unable to load guests.'));
    } finally {
      if (showSpinner) {
        setIsLoading(false);
      }
    }
  }

  async function loadBookingsTab() {
    if (!token) return;
    setIsLoading(true);
    setError('');

    try {
      await loadBookings();
    } catch (err) {
      setError(handleApiError(err, 'Unable to load bookings.'));
    } finally {
      setIsLoading(false);
    }
  }

  async function loadData() {
    if (tab === 'directory') {
      await loadDirectoryTab();
    } else {
      await loadBookingsTab();
    }
  }

  useEffect(() => {
    if (!token) return;
    void Promise.all([fetchProperties(token), refreshBookingGuests()])
      .then(([propertyRows]) => {
        setProperties(propertyRows);
      })
      .catch((err) => {
        setToast({
          message: handleApiError(err, 'Unable to load reference data.'),
          tone: 'error',
        });
      });
  }, [token, handleApiError]);

  useEffect(() => {
    if (!token) return;
    void fetchUnits(token, {
      propertyId: propertyId || undefined,
      isActive: true,
    })
      .then(setUnits)
      .catch(() => setUnits([]));
  }, [token, propertyId]);

  useEffect(() => {
    if (!token || tab !== 'directory') return;
    if (skipNextDirectoryEffect.current) {
      skipNextDirectoryEffect.current = false;
      return;
    }
    void loadDirectoryTab();
  }, [token, tab, directorySearch, directoryActive]);

  useEffect(() => {
    if (!token || tab !== 'bookings') return;
    void loadBookingsTab();
  }, [token, tab, bookingQuery]);

  useEffect(() => {
    if (consumedDashboardNav.current) return;

    const fromState = isDashboardNavState(location.state)
      ? location.state
      : null;
    const qProperty = searchParams.get('propertyId');
    const qUnit = searchParams.get('unitId');
    const fromQuery =
      searchParams.get('source') === 'dashboard' && qProperty && qUnit
        ? ({
            source: 'dashboard',
            propertyId: qProperty,
            unitId: qUnit,
            unitNumber: searchParams.get('unitNumber') ?? undefined,
            openBooking: true,
            returnToDashboard: true,
          } satisfies DashboardUnitNavState)
        : null;
    const nav = fromState ?? fromQuery;
    if (!nav || !(nav.openBooking || fromQuery)) return;

    consumedDashboardNav.current = true;
    setPropertyId(nav.propertyId);
    setUnitId(nav.unitId);
    setBookingPreset({
      propertyId: nav.propertyId,
      unitId: nav.unitId,
      unitLabel: nav.unitNumber,
      lockSelection: true,
    });
    setReturnToDashboard(Boolean(nav.returnToDashboard ?? true));
    setTab('bookings');
    setEditingBooking(null);
    setDefaultGuestId(null);
    setShowBookingForm(true);
    navigate(location.pathname, { replace: true, state: null });
    if (searchParams.get('source') === 'dashboard') {
      const next = new URLSearchParams(searchParams);
      next.delete('source');
      next.delete('propertyId');
      next.delete('unitId');
      next.delete('unitNumber');
      setSearchParams(next, { replace: true });
    }
  }, [location.state, location.pathname, navigate, searchParams, setSearchParams]);

  async function handleSaveGuest(payload: GuestInput) {
    if (!token) return;
    setSavingGuest(true);
    try {
      if (editingGuest) {
        await updateGuest(token, editingGuest.id, payload);
        setShowGuestForm(false);
        setEditingGuest(null);
        setToast({ message: 'Guest updated.', tone: 'success' });
        setError('');
        await refreshBookingGuests();
        await loadDirectory();
        return;
      }

      const created = await createGuest(token, payload);
      setShowGuestForm(false);
      // Avoid the directory effect wiping the optimistic row with a spinner.
      skipNextDirectoryEffect.current = true;
      setDirectorySearch('');
      setDirectoryActive('true');
      setTab('directory');
      setGuests((prev) => [
        created,
        ...prev.filter((guest) => guest.id !== created.id),
      ]);
      setCreatedGuestNotice(created.fullName);
      setToast({
        message: 'Guest created — showing Guest Directory.',
        tone: 'success',
      });
      setError('');
      setIsLoading(false);
      await refreshBookingGuests();
      // Soft refetch — keep the new row visible even if this fails.
      try {
        await loadDirectory({ search: '', directoryActive: 'true' });
      } catch {
        // Optimistic row already shown.
      }
      void loadSummaryOnly();
    } catch (err) {
      if (isPendingApprovalError(err)) {
        setShowGuestForm(false);
        setEditingGuest(null);
        setToast({ message: err.message, tone: 'success' });
        return;
      }
      setToast({
        message: handleApiError(
          err,
          editingGuest ? 'Unable to update guest.' : 'Unable to create guest.',
        ),
        tone: 'error',
      });
      throw err;
    } finally {
      setSavingGuest(false);
      // Clear latch if the directory effect never ran (filters already matched).
      skipNextDirectoryEffect.current = false;
    }
  }

  async function handleArchiveGuest() {
    if (!token || !guestToArchive) return;
    setArchivingGuest(true);
    try {
      await archiveGuest(token, guestToArchive.id);
      setToast({
        message: `${guestToArchive.fullName} was archived.`,
        tone: 'success',
      });
      setGuestToArchive(null);
      await refreshBookingGuests();
      await loadDirectory();
    } catch (err) {
      if (isPendingApprovalError(err)) {
        setGuestToArchive(null);
        setToast({ message: err.message, tone: 'success' });
        return;
      }
      setToast({
        message: handleApiError(err, 'Unable to archive guest.'),
        tone: 'error',
      });
    } finally {
      setArchivingGuest(false);
    }
  }

  async function handleSaveBooking(payload: BookingInput) {
    if (!token) return;
    setSavingBooking(true);
    try {
      if (editingBooking) {
        await updateBooking(token, editingBooking.id, payload);
        invalidateEligibleUnitsQueries();
        notifyFinanceChanged();
        setShowBookingForm(false);
        setEditingBooking(null);
        setDefaultGuestId(null);
        setTab('bookings');
        setToast({ message: 'Booking updated.', tone: 'success' });
        await refreshBookingGuests();
        await loadData();
        return;
      }

      await createBooking(token, payload);
      invalidateEligibleUnitsQueries();
      notifyFinanceChanged();
      setShowBookingForm(false);
      setDefaultGuestId(null);
      const shouldReturn = returnToDashboard;
      setBookingPreset(null);
      setReturnToDashboard(false);
      if (shouldReturn) {
        setToast({ message: 'Booking created. Returning to dashboard.', tone: 'success' });
        navigate('/dashboard');
        return;
      }
      setTab('bookings');
      setToast({ message: 'Booking created successfully.', tone: 'success' });
      await refreshBookingGuests();
      await loadData();
    } catch (err) {
      if (isPendingApprovalError(err)) {
        setShowBookingForm(false);
        setEditingBooking(null);
        setToast({ message: err.message, tone: 'success' });
        await loadData();
        return;
      }
      setToast({
        message: handleApiError(
          err,
          editingBooking ? 'Unable to update booking.' : 'Unable to create booking.',
        ),
        tone: 'error',
      });
      throw err;
    } finally {
      setSavingBooking(false);
    }
  }

  async function runAction(
    type:
      | 'confirm'
      | 'checkin'
      | 'checkout'
      | 'cancel'
      | 'noshow'
      | 'cleaning'
      | 'accounts',
    booking: Booking,
  ) {
    if (!token) return;
    setBusyAction(true);
    try {
      let updated: Booking;
      switch (type) {
        case 'confirm':
          updated = await confirmBooking(token, booking.id);
          break;
        case 'checkin':
          updated = await checkInBooking(token, booking.id);
          break;
        case 'checkout':
          updated = await checkOutBooking(token, booking.id, {});
          break;
        case 'cancel':
          updated = await cancelBooking(token, booking.id);
          break;
        case 'noshow':
          updated = await markBookingNoShow(token, booking.id);
          break;
        case 'cleaning':
          updated = await markCleaningCleared(token, booking.id);
          break;
        case 'accounts':
          updated = await markAccountsCleared(token, booking.id);
          break;
      }
      setSelected(updated);
      setConfirmAction(null);
      setToast({
        message:
          type === 'checkout'
            ? 'Guest checked out. Check-out date and time updated to now.'
            : 'Booking updated.',
        tone: 'success',
      });
      invalidateEligibleUnitsQueries();
      notifyFinanceChanged();
      await loadData();
    } catch (err) {
      if (isPendingApprovalError(err)) {
        setConfirmAction(null);
        setToast({ message: err.message, tone: 'success' });
        await loadData();
        return;
      }
      setToast({
        message: handleApiError(err, 'Unable to update booking.'),
        tone: 'error',
      });
    } finally {
      setBusyAction(false);
    }
  }

  const columns: Array<DataTableColumn<Booking>> = [
    {
      key: 'unit',
      header: 'Room No.',
      render: (row) => row.unit?.unitNumber ?? '—',
    },
    {
      key: 'guest',
      header: 'Guest Name',
      render: (row) => row.guest?.fullName ?? '—',
    },
    {
      key: 'type',
      header: 'Booking Type',
      render: (row) => formatLabel(row.bookingType),
    },
    {
      key: 'plannedIn',
      header: 'Check-In',
      className: 'daily-guests-page__col-when',
      render: (row) => (
        <StayWhen planned={row.checkInDateTime} actual={row.actualCheckInAt} />
      ),
    },
    {
      key: 'plannedOut',
      header: 'Check-Out',
      className: 'daily-guests-page__col-when',
      render: (row) => (
        <StayWhen planned={row.checkOutDateTime} actual={row.actualCheckOutAt} />
      ),
    },
    {
      key: 'stay',
      header: 'Nights / Hours',
      render: (row) => stayDuration(row),
    },
    {
      key: 'total',
      header: 'Total Bill',
      render: (row) => <MoneyDisplay value={row.totalAmount} />,
    },
    {
      key: 'paid',
      header: 'Paid',
      render: (row) => <MoneyDisplay value={row.receivedAmount} />,
    },
    {
      key: 'remaining',
      header: 'Remaining',
      render: (row) => {
        const due = moneyDue(row.remainingAmount);
        return (
          <span
            className={`daily-guests-page__remaining${due ? ' is-due' : ''}`}
          >
            <MoneyDisplay value={row.remainingAmount} />
          </span>
        );
      },
    },
    {
      key: 'payment',
      header: 'Payment',
      render: (row) => <PaymentStatusBadge state={row.paymentState} />,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <BookingStatusBadge status={row.bookingStatus} />,
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => {
        const canEditStay =
          canConfirm &&
          (row.bookingStatus === 'PENDING' ||
            row.bookingStatus === 'CONFIRMED' ||
            row.bookingStatus === 'CHECKED_IN');
        const canCancelStay =
          canCancel &&
          (isReceptionist
            ? row.bookingStatus === 'PENDING'
            : row.bookingStatus === 'PENDING' ||
              row.bookingStatus === 'CONFIRMED');
        const canPay =
          canCreate &&
          moneyDue(row.remainingAmount) &&
          row.bookingStatus !== 'CANCELLED' &&
          row.bookingStatus !== 'NO_SHOW';

        return (
          <div className="data-table__actions">
            {canCheckOut && row.bookingStatus === 'CHECKED_IN' ? (
              <button
                type="button"
                className="data-table__action data-table__action--primary"
                onClick={() =>
                  setConfirmAction({ type: 'checkout', booking: row })
                }
              >
                {new Date(row.checkOutDateTime).getTime() > Date.now()
                  ? 'Early Check Out'
                  : 'Check Out'}
              </button>
            ) : null}
            {canCheckIn && row.bookingStatus === 'CONFIRMED' ? (
              <button
                type="button"
                className="data-table__action"
                onClick={() =>
                  setConfirmAction({ type: 'checkin', booking: row })
                }
              >
                Check In
              </button>
            ) : null}
            <RowMoreMenu
              items={[
              {
                id: 'view',
                label: 'View details',
                onClick: () => {
                  setSelected(row);
                  setShowDetail(true);
                },
              },
              {
                id: 'edit',
                label: 'Edit booking',
                hidden: !canEditStay,
                onClick: () => {
                  setDefaultGuestId(null);
                  setBookingPreset(null);
                  setReturnToDashboard(false);
                  setEditingBooking(row);
                  setShowBookingForm(true);
                },
              },
              {
                id: 'pay',
                label: 'Record payment',
                hidden: !canPay,
                onClick: () => {
                  setSelected(row);
                  setShowPaymentForm(true);
                },
              },
              {
                id: 'confirm',
                label: 'Confirm',
                hidden: !(canConfirm && row.bookingStatus === 'PENDING'),
                onClick: () => void runAction('confirm', row),
              },
              {
                id: 'checkin',
                label: 'Check-In',
                hidden: !(canCheckIn && row.bookingStatus === 'CONFIRMED'),
                onClick: () =>
                  setConfirmAction({ type: 'checkin', booking: row }),
              },
              {
                id: 'checkout',
                label: 'Check-Out',
                hidden: !(canCheckOut && row.bookingStatus === 'CHECKED_IN'),
                onClick: () =>
                  setConfirmAction({ type: 'checkout', booking: row }),
              },
              {
                id: 'cancel',
                label: 'Cancel booking',
                danger: true,
                hidden: !canCancelStay,
                onClick: () =>
                  setConfirmAction({ type: 'cancel', booking: row }),
              },
            ]}
          />
          </div>
        );
      },
    },
  ];

  const directoryColumns: Array<DataTableColumn<Guest>> = [
    {
      key: 'name',
      header: 'Guest Name',
      render: (row) => row.fullName,
    },
    {
      key: 'phone',
      header: 'Phone',
      render: (row) => row.phone,
    },
    {
      key: 'email',
      header: 'Email',
      render: (row) => row.email || '—',
    },
    {
      key: 'cnic',
      header: 'CNIC / Passport',
      render: (row) => row.cnicOrPassport || '—',
    },
    {
      key: 'nationality',
      header: 'Nationality',
      render: (row) => row.nationality || '—',
    },
    {
      key: 'created',
      header: 'Created',
      render: (row) => formatDate(row.createdAt),
    },
    {
      key: 'status',
      header: 'Profile',
      render: (row) => (
        <StatusBadge status={row.isActive ? 'ACTIVE' : 'INACTIVE'} />
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <RowMoreMenu
          items={[
            {
              id: 'book',
              label: 'New Booking',
              hidden: !canCreate || !row.isActive,
              onClick: () => {
                setEditingBooking(null);
                setBookingPreset(null);
                setReturnToDashboard(false);
                setDefaultGuestId(row.id);
                setShowBookingForm(true);
              },
            },
            {
              id: 'edit',
              label: 'Edit guest',
              hidden: !canCreate || !row.isActive,
              onClick: () => {
                setEditingGuest(row);
                setShowGuestForm(true);
              },
            },
            {
              id: 'archive',
              label: 'Archive guest',
              danger: true,
              hidden: !isSuperAdmin || !row.isActive,
              onClick: () => setGuestToArchive(row),
            },
          ]}
        />
      ),
    },
  ];

  const years = Array.from({ length: 6 }, (_, index) => now.getFullYear() - index);

  const confirmCopy = confirmAction
    ? {
        cancel: {
          title: 'Cancel booking?',
          message: 'This will mark the booking as CANCELLED. History is kept.',
          label: 'Cancel Booking',
        },
        checkout: {
          title: 'Check out now?',
          message:
            'Check-out date and time will be set to now. If the guest is leaving early, room charges use the nights actually stayed. The room will become CLEANING_REQUIRED until cleaning and accounts are cleared.',
          label: 'Check Out',
        },
        noshow: {
          title: 'Mark as no-show?',
          message: 'Confirmed booking will be marked NO_SHOW. Unit stays unchanged.',
          label: 'Mark No-Show',
        },
        checkin: {
          title: 'Check in guest?',
          message: 'Unit status will become DAILY OCCUPIED (purple).',
          label: 'Check-In',
        },
      }[confirmAction.type]
    : null;

  return (
    <section className="entity-page daily-guests-page">
      <PageHeader title="Daily Guests" breadcrumb={['Home', 'Daily Guests']} />

      {canCreate ? (
        <div className="entity-page__toolbar daily-guests-page__toolbar">
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => {
              setEditingBooking(null);
              setDefaultGuestId(null);
              setShowBookingForm(true);
            }}
          >
            New Booking
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => {
              setEditingGuest(null);
              setShowGuestForm(true);
            }}
          >
            Add Guest
          </button>
        </div>
      ) : null}

      <div className="daily-guests-page__tabs" role="tablist">
        {(
          [
            ['directory', 'Guest Directory (profiles)'],
            ['bookings', 'Bookings (stays)'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={`daily-guests-page__tab${
              tab === id ? ' is-active' : ''
            }`}
            onClick={() => {
              setCreatedGuestNotice(null);
              setTab(id);
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <p className="daily-guests-page__tab-hint">
        <strong>Add Guest</strong> creates a profile under{' '}
        <strong>Guest Directory</strong>. Profiles do not appear under Bookings
        until you create a stay with <strong>New Booking</strong>.
      </p>

      {createdGuestNotice ? (
        <div className="daily-guests-page__notice" role="status">
          <span>
            Guest <strong>{createdGuestNotice}</strong> was created. You are
            viewing Guest Directory (profiles). Switch to Bookings only after
            you create a stay with New Booking.
          </span>
          <button
            type="button"
            className="daily-guests-page__notice-dismiss"
            onClick={() => setCreatedGuestNotice(null)}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {summary ? (
        <div className="daily-guests-page__summary">
          <SummaryCard
            label="Today's Check-Ins"
            value={summary.todayCheckIns}
            tone="info"
          />
          <SummaryCard
            label="Today's Check-Outs"
            value={summary.todayCheckOuts}
            tone="warn"
          />
          <SummaryCard
            label="Currently Checked-In"
            value={summary.currentlyCheckedIn}
            tone="gold"
          />
          <SummaryCard
            label="Upcoming Bookings"
            value={summary.upcomingBookings}
            tone="default"
          />
          <SummaryCard
            label="Unpaid / Outstanding"
            value={formatPkr(summary.unpaidOutstanding)}
            tone="danger"
          />
          <SummaryCard
            label="Rooms Requiring Cleaning"
            value={summary.roomsRequiringCleaning}
            tone="danger"
          />
        </div>
      ) : null}

      <FilterBar>
        <label>
          <span>Search</span>
          {tab === 'directory' ? (
            <input
              type="search"
              value={directorySearch}
              placeholder="Name, phone, CNIC, email"
              onChange={(e) => setDirectorySearch(e.target.value)}
            />
          ) : (
            <input
              type="search"
              value={bookingSearch}
              placeholder="Booking #, guest, phone, unit"
              onChange={(e) => setBookingSearch(e.target.value)}
            />
          )}
        </label>

        {tab === 'directory' ? (
          <label>
            <span>Profile Status</span>
            <select
              value={directoryActive}
              onChange={(e) =>
                setDirectoryActive(
                  e.target.value as 'all' | 'true' | 'false',
                )
              }
            >
              <option value="true">Active profiles</option>
              <option value="false">Archived</option>
              <option value="all">All</option>
            </select>
          </label>
        ) : (
          <>
            <label>
              <span>Property</span>
              <select
                value={propertyId}
                onChange={(e) => {
                  setPropertyId(e.target.value);
                  setUnitId('');
                }}
              >
                <option value="">All</option>
                {properties.map((property) => (
                  <option key={property.id} value={property.id}>
                    {property.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Unit</span>
              <select value={unitId} onChange={(e) => setUnitId(e.target.value)}>
                <option value="">All</option>
                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.unitNumber}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Booking Type</span>
              <select
                value={bookingType}
                onChange={(e) =>
                  setBookingType(e.target.value as BookingType | '')
                }
              >
                <option value="">All</option>
                <option value="DAILY">Daily</option>
                <option value="HOURLY">Hourly</option>
              </select>
            </label>
            <label>
              <span>Booking Status</span>
              <select
                value={bookingStatus}
                onChange={(e) =>
                  setBookingStatus(e.target.value as BookingStatus | '')
                }
              >
                <option value="">All</option>
                <option value="PENDING">Pending</option>
                <option value="CONFIRMED">Confirmed</option>
                <option value="CHECKED_IN">Checked In</option>
                <option value="CHECKED_OUT">Checked Out</option>
                <option value="CANCELLED">Cancelled</option>
                <option value="NO_SHOW">No Show</option>
              </select>
            </label>
            <label>
              <span>Payment Status</span>
              <select
                value={paymentState}
                onChange={(e) =>
                  setPaymentState(e.target.value as PaymentState | '')
                }
              >
                <option value="">All</option>
                <option value="UNPAID">Unpaid</option>
                <option value="ADVANCE">Advance</option>
                <option value="PARTIAL">Partial Paid</option>
                <option value="HALF_PAID">Half Paid</option>
                <option value="PAID">Paid</option>
              </select>
            </label>
            <label>
              <span>Today</span>
              <select
                value={todayOnly ? 'yes' : 'no'}
                onChange={(e) => setTodayOnly(e.target.value === 'yes')}
              >
                <option value="no">All days</option>
                <option value="yes">Today only</option>
              </select>
            </label>
            <label>
              <span>Month</span>
              <select
                value={month}
                onChange={(e) => {
                  const next = e.target.value;
                  setMonth(next);
                  if (next && !year) setYear(String(now.getFullYear()));
                }}
              >
                <option value="">All</option>
                {Array.from({ length: 12 }, (_, index) => (
                  <option key={index + 1} value={String(index + 1)}>
                    {new Date(2000, index, 1).toLocaleString(undefined, {
                      month: 'long',
                    })}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Year</span>
              <select value={year} onChange={(e) => setYear(e.target.value)}>
                <option value="">All</option>
                {years.map((value) => (
                  <option key={value} value={String(value)}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Start Date</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </label>
            <label>
              <span>End Date</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </label>
          </>
        )}
      </FilterBar>

      {isLoading &&
      ((tab === 'directory' && guests.length === 0) ||
        (tab === 'bookings' && bookings.length === 0)) ? (
        <LoadingState
          message={
            tab === 'directory' ? 'Loading guests…' : 'Loading bookings…'
          }
        />
      ) : null}
      {error &&
      ((tab === 'directory' && guests.length === 0) ||
        (tab === 'bookings' && bookings.length === 0)) ? (
        <ErrorState message={error} onRetry={() => void loadData()} />
      ) : null}

      {!isLoading &&
      !error &&
      tab === 'directory' &&
      guests.length === 0 ? (
        <EmptyState
          title="No guest profiles found"
          description="Use Add Guest to create a profile. Profiles show here; stays show under Bookings."
        />
      ) : null}
      {tab === 'directory' && guests.length > 0 ? (
        <DataTable
          columns={directoryColumns}
          rows={guests}
          rowKey={(row) => row.id}
        />
      ) : null}

      {!isLoading &&
      !error &&
      tab === 'bookings' &&
      bookings.length === 0 ? (
        <EmptyState
          title="No bookings found"
          description="Guest profiles are listed under Guest Directory. Use New Booking to create a stay that appears here."
        />
      ) : null}
      {tab === 'bookings' && bookings.length > 0 ? (
        <DataTable columns={columns} rows={bookings} rowKey={(row) => row.id} />
      ) : null}

      <GuestFormModal
        open={showGuestForm}
        saving={savingGuest}
        initial={editingGuest}
        onClose={() => {
          setShowGuestForm(false);
          setEditingGuest(null);
        }}
        onSubmit={handleSaveGuest}
      />

      <BookingFormModal
        open={showBookingForm}
        saving={savingBooking}
        token={token ?? ''}
        guests={bookingGuests}
        properties={properties}
        isSuperAdmin={isSuperAdmin}
        preset={bookingPreset}
        returnToDashboard={returnToDashboard}
        editing={editingBooking}
        defaultGuestId={defaultGuestId}
        onClose={() => {
          setShowBookingForm(false);
          setBookingPreset(null);
          setReturnToDashboard(false);
          setEditingBooking(null);
          setDefaultGuestId(null);
        }}
        onError={(message) => setToast({ message, tone: 'error' })}
        onSubmit={handleSaveBooking}
      />

      <BookingDetailModal
        open={showDetail}
        booking={selected}
        busy={busyAction}
        canConfirm={canConfirm}
        canCheckIn={canCheckIn}
        canCheckOut={canCheckOut}
        canCancel={canCancel}
        canNoShow={canNoShow}
        canClearFlags={canClearFlags}
        token={token ?? undefined}
        canAddPayment={canCreate}
        paymentRefreshKey={paymentRefreshKey}
        onAddPayment={() => setShowPaymentForm(true)}
        canEdit={
          canConfirm &&
          (selected?.bookingStatus === 'PENDING' ||
            selected?.bookingStatus === 'CONFIRMED' ||
            selected?.bookingStatus === 'CHECKED_IN')
        }
        onEdit={() => {
          if (!selected) return;
          setShowDetail(false);
          setDefaultGuestId(null);
          setBookingPreset(null);
          setReturnToDashboard(false);
          setEditingBooking(selected);
          setShowBookingForm(true);
        }}
        onClose={() => setShowDetail(false)}
        onConfirm={() => selected && void runAction('confirm', selected)}
        onCheckIn={() =>
          selected && setConfirmAction({ type: 'checkin', booking: selected })
        }
        onCheckOut={() =>
          selected && setConfirmAction({ type: 'checkout', booking: selected })
        }
        onCancel={() =>
          selected && setConfirmAction({ type: 'cancel', booking: selected })
        }
        onNoShow={() =>
          selected && setConfirmAction({ type: 'noshow', booking: selected })
        }
        onMarkCleaning={() =>
          selected && void runAction('cleaning', selected)
        }
        onMarkAccounts={() =>
          selected && void runAction('accounts', selected)
        }
      />

      <PaymentFormModal
        open={showPaymentForm}
        token={token ?? ''}
        isSuperAdmin={isSuperAdmin}
        preset={
          selected
            ? { paymentForType: 'BOOKING', bookingId: selected.id }
            : undefined
        }
        onClose={() => setShowPaymentForm(false)}
        onSaved={() => {
          setPaymentRefreshKey((value) => value + 1);
          notifyFinanceChanged();
          setToast({ message: 'Payment recorded.', tone: 'success' });
          void loadData();
        }}
        onError={(message) => setToast({ message, tone: 'error' })}
      />

      <ConfirmDialog
        open={Boolean(guestToArchive)}
        title="Archive guest?"
        message={
          guestToArchive
            ? `${guestToArchive.fullName} will be hidden from active profiles. Guests with an active stay cannot be archived.`
            : ''
        }
        confirmLabel="Archive Guest"
        busy={archivingGuest}
        onCancel={() => setGuestToArchive(null)}
        onConfirm={() => void handleArchiveGuest()}
      />

      <ConfirmDialog
        open={Boolean(confirmAction && confirmCopy)}
        title={confirmCopy?.title ?? ''}
        message={confirmCopy?.message ?? ''}
        confirmLabel={confirmCopy?.label}
        busy={busyAction}
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => {
          if (!confirmAction) return;
          const map = {
            cancel: 'cancel',
            checkout: 'checkout',
            noshow: 'noshow',
            checkin: 'checkin',
          } as const;
          void runAction(map[confirmAction.type], confirmAction.booking);
        }}
      />

      <Toast
        message={toast.message}
        tone={toast.tone}
        onClose={() => setToast({ message: '', tone: 'success' })}
      />
    </section>
  );
}
