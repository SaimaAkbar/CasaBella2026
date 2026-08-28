import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  checkInBooking,
  checkOutBooking,
  markAccountsCleared,
  markCleaningCleared,
} from '../../api/bookings';
import { fetchDashboardUnitDetail } from '../../api/dashboard';
import {
  markTenancyEmpty,
  markTenancyOccupied,
} from '../../api/monthly-tenancies';
import { updateUnit } from '../../api/units';
import type {
  DashboardUnitGridDetail,
  DashboardUnitNavState,
} from '../../types/dashboard';
import { FormModal } from '../ui/FormModal';
import { PaymentFormModal } from '../payments/PaymentFormModal';
import { formatHotelDateTime } from '../../lib/format';
import './UnitDetailModal.css';

type UnitRole = 'SUPER_ADMIN' | 'ADMIN' | 'RECEPTIONIST';

type UnitDetailModalProps = {
  open: boolean;
  unitId: string | null;
  token: string;
  role: UnitRole;
  isSuperAdmin: boolean;
  canManageUnits: boolean;
  onClose: () => void;
  onChanged: () => void;
};

function formatMoney(value: string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  return `Rs. ${new Intl.NumberFormat('en-PK', {
    maximumFractionDigits: 0,
  }).format(n)}`;
}

export function UnitDetailModal({
  open,
  unitId,
  token,
  role,
  isSuperAdmin,
  canManageUnits,
  onClose,
  onChanged,
}: UnitDetailModalProps) {
  const navigate = useNavigate();
  const [detail, setDetail] = useState<DashboardUnitGridDetail | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);

  useEffect(() => {
    if (!open || !unitId || !token) {
      setDetail(null);
      setError('');
      return;
    }
    let active = true;
    setBusy(true);
    setError('');
    void fetchDashboardUnitDetail(token, unitId)
      .then((data) => {
        if (active) setDetail(data);
      })
      .catch((err: unknown) => {
        if (active) {
          setError(err instanceof Error ? err.message : 'Unable to load unit');
        }
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [open, unitId, token]);

  async function runAction(action: () => Promise<unknown>) {
    setBusy(true);
    setError('');
    try {
      await action();
      onChanged();
      if (unitId) {
        const refreshed = await fetchDashboardUnitDetail(token, unitId);
        setDetail(refreshed);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  }

  function goToDailyBooking() {
    if (!detail) return;
    const state: DashboardUnitNavState = {
      source: 'dashboard',
      propertyId: detail.propertyId,
      unitId: detail.id,
      unitNumber: detail.unitNumber ?? detail.roomNumber,
      propertyName: detail.propertyName,
      openBooking: true,
      returnToDashboard: true,
    };
    onClose();
    navigate('/daily-guests', { state });
  }

  function goToMonthlyAssign() {
    if (!detail) return;
    const state: DashboardUnitNavState = {
      source: 'dashboard',
      propertyId: detail.propertyId,
      unitId: detail.id,
      unitNumber: detail.unitNumber ?? detail.roomNumber,
      propertyName: detail.propertyName,
      openAssign: true,
      returnToDashboard: true,
    };
    onClose();
    navigate('/monthly-tenants', { state });
  }

  function goToPlaceHotelGuest() {
    if (!detail?.tenancyId) return;
    const state: DashboardUnitNavState & { tenancyId: string } = {
      source: 'dashboard',
      propertyId: detail.propertyId,
      unitId: detail.id,
      unitNumber: detail.unitNumber ?? detail.roomNumber,
      propertyName: detail.propertyName,
      tenancyId: detail.tenancyId,
      returnToDashboard: true,
    };
    onClose();
    navigate('/monthly-tenants', { state });
  }

  const actions = detail?.allowedActions;
  const bookingId =
    detail?.bookingId ??
    detail?.confirmedBookingId ??
    detail?.pendingClearanceBookingId;
  const clearanceBookingId =
    detail?.pendingClearanceBookingId ?? detail?.bookingId;

  const isAvailable = detail?.status === 'AVAILABLE';
  const isMonthlyVacant = detail?.status === 'MONTHLY_TENANT_VACANT';
  const isOccupied = detail?.status === 'OCCUPIED';
  const isCleaning = detail?.status === 'CLEANING_REQUIRED';
  const isMaintenance = detail?.status === 'MAINTENANCE';
  const isBlocked = detail?.status === 'BLOCKED';
  const isHotelOccupied =
    isOccupied &&
    (detail?.bookingType === 'DAILY' || detail?.bookingType === 'HOURLY');
  const isMonthlyOccupied = isOccupied && !isHotelOccupied;
  const isDailyOccupied = isHotelOccupied;

  // White monthly empty: never offer ordinary Assign to Monthly Tenant.
  const showAssignDaily = Boolean(actions?.newBooking) && isAvailable;
  const showAssignMonthly =
    Boolean(actions?.newBooking) && isAvailable && canManageUnits;
  const showPlaceHotelGuest =
    isMonthlyVacant &&
    Boolean(detail?.tenancyId) &&
    Boolean(detail?.hotelUseAllowed);

  return (
    <>
      <FormModal
        open={open}
        title={
          detail
            ? `${detail.propertyName} · ${detail.unitNumber ?? detail.roomNumber}`
            : 'Unit details'
        }
        onClose={onClose}
      >
        {busy && !detail ? <p className="unit-detail__hint">Loading…</p> : null}
        {error ? (
          <p className="unit-detail__error" role="alert">
            {error}
          </p>
        ) : null}
        {detail ? (
          <div className="unit-detail">
            <dl className="unit-detail__facts">
              <div>
                <dt>Status</dt>
                <dd>{detail.statusLabel ?? detail.status}</dd>
              </div>
              <div>
                <dt>Type</dt>
                <dd>{detail.unitType}</dd>
              </div>
              <div>
                <dt>Booking type</dt>
                <dd>{detail.bookingType ?? '—'}</dd>
              </div>
              <div>
                <dt>Guest</dt>
                <dd>{detail.guestName ?? '—'}</dd>
              </div>
              <div>
                <dt>Monthly tenant</dt>
                <dd>{detail.monthlyTenant ?? '—'}</dd>
              </div>
              {detail.occupancySource === 'HOTEL_GUEST_ON_TENANT_UNIT' ? (
                <div>
                  <dt>Occupancy source</dt>
                  <dd>Hotel guest on tenant unit</dd>
                </div>
              ) : null}
              {detail.settlementType && role !== 'RECEPTIONIST' ? (
                <div>
                  <dt>Settlement</dt>
                  <dd>{detail.settlementType.replaceAll('_', ' ')}</dd>
                </div>
              ) : null}
              <div>
                <dt>Check-in</dt>
                <dd>{formatHotelDateTime(detail.checkInDate)}</dd>
              </div>
              <div>
                <dt>Check-out</dt>
                <dd>{formatHotelDateTime(detail.checkoutDate)}</dd>
              </div>
              <div>
                <dt>Rent / charges</dt>
                <dd>{formatMoney(detail.rent)}</dd>
              </div>
              <div>
                <dt>Paid</dt>
                <dd>{formatMoney(detail.paid)}</dd>
              </div>
              <div>
                <dt>Remaining</dt>
                <dd>{formatMoney(detail.remaining)}</dd>
              </div>
              {(isCleaning || detail.cleaningCleared !== null) && (
                <div>
                  <dt>Cleaning cleared</dt>
                  <dd>
                    {detail.cleaningCleared === null
                      ? '—'
                      : detail.cleaningCleared
                        ? 'Yes'
                        : 'No'}
                  </dd>
                </div>
              )}
              {(isCleaning || detail.accountsCleared !== null) && (
                <div>
                  <dt>Accounts cleared</dt>
                  <dd>
                    {detail.accountsCleared === null
                      ? '—'
                      : detail.accountsCleared
                        ? 'Yes'
                        : 'No'}
                  </dd>
                </div>
              )}
              {detail.hotelUseAllowed ? (
                <div>
                  <dt>Hotel use</dt>
                  <dd>Allowed</dd>
                </div>
              ) : null}
              {detail.notes ? (
                <div className="unit-detail__notes">
                  <dt>Notes</dt>
                  <dd>{detail.notes}</dd>
                </div>
              ) : null}
            </dl>

            <div className="unit-detail__actions">
              {/* AVAILABLE */}
              {isAvailable && showAssignDaily ? (
                <button type="button" disabled={busy} onClick={goToDailyBooking}>
                  Assign to Daily Guest
                </button>
              ) : null}
              {isAvailable && showAssignMonthly ? (
                <button type="button" disabled={busy} onClick={goToMonthlyAssign}>
                  Assign to Monthly Tenant
                </button>
              ) : null}

              {/* MONTHLY_TENANT_VACANT — no ordinary monthly assign */}
              {isMonthlyVacant && actions?.viewTenant && detail.tenancyId ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    onClose();
                    navigate(
                      `/monthly-tenants?tenancyId=${detail.tenancyId}`,
                    );
                  }}
                >
                  View Tenant
                </button>
              ) : null}
              {isMonthlyVacant && actions?.markOccupied && detail.tenancyId ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void runAction(() =>
                      markTenancyOccupied(token, detail.tenancyId!),
                    )
                  }
                >
                  Mark Occupied
                </button>
              ) : null}
              {isMonthlyVacant && showPlaceHotelGuest ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={goToPlaceHotelGuest}
                >
                  Place Hotel Guest
                </button>
              ) : null}

              {/* OCCUPIED daily */}
              {isDailyOccupied && actions?.checkOut && detail.bookingId ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void runAction(() => checkOutBooking(token, detail.bookingId!))
                  }
                >
                  {detail.checkoutDate &&
                  new Date(detail.checkoutDate).getTime() > Date.now()
                    ? 'Early Check Out'
                    : 'Check Out'}
                </button>
              ) : null}
              {isDailyOccupied && actions?.receivePayment ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setPaymentOpen(true)}
                >
                  Receive Payment
                </button>
              ) : null}
              {isDailyOccupied && actions?.viewBooking && bookingId ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    onClose();
                    navigate(`/daily-guests?bookingId=${bookingId}`);
                  }}
                >
                  View Booking
                </button>
              ) : null}
              {isDailyOccupied &&
              actions?.markEmpty &&
              detail.tenancyId ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void runAction(() =>
                      markTenancyEmpty(token, detail.tenancyId!),
                    )
                  }
                >
                  Mark Empty
                </button>
              ) : null}

              {/* OCCUPIED monthly */}
              {isMonthlyOccupied && actions?.viewTenant && detail.tenancyId ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    onClose();
                    navigate(
                      `/monthly-tenants?tenancyId=${detail.tenancyId}`,
                    );
                  }}
                >
                  View Tenant
                </button>
              ) : null}
              {isMonthlyOccupied && actions?.markEmpty && detail.tenancyId ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void runAction(() =>
                      markTenancyEmpty(token, detail.tenancyId!),
                    )
                  }
                >
                  Mark Empty
                </button>
              ) : null}
              {isMonthlyOccupied && actions?.receivePayment ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setPaymentOpen(true)}
                >
                  Receive Payment
                </button>
              ) : null}
              {isMonthlyOccupied &&
              actions?.checkOut &&
              detail.bookingId ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void runAction(() => checkOutBooking(token, detail.bookingId!))
                  }
                >
                  Check Out Hotel Guest
                </button>
              ) : null}
              {isMonthlyOccupied && actions?.viewBooking && bookingId ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    onClose();
                    navigate(`/daily-guests?bookingId=${bookingId}`);
                  }}
                >
                  View Booking
                </button>
              ) : null}

              {/* Confirmed pending check-in (any status that allows it) */}
              {actions?.checkIn && detail.confirmedBookingId ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void runAction(() =>
                      checkInBooking(token, detail.confirmedBookingId!),
                    )
                  }
                >
                  Check In
                </button>
              ) : null}

              {/* CLEANING */}
              {isCleaning &&
              actions?.markCleaningCleared &&
              clearanceBookingId ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void runAction(() =>
                      markCleaningCleared(token, clearanceBookingId),
                    )
                  }
                >
                  Mark Cleaning Cleared
                </button>
              ) : null}
              {isCleaning &&
              actions?.markAccountsCleared &&
              clearanceBookingId ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void runAction(() =>
                      markAccountsCleared(token, clearanceBookingId),
                    )
                  }
                >
                  Mark Accounts Cleared
                </button>
              ) : null}
              {isCleaning && actions?.receivePayment ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setPaymentOpen(true)}
                >
                  Receive Payment
                </button>
              ) : null}
              {isCleaning && actions?.viewBooking && bookingId ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    onClose();
                    navigate(`/daily-guests?bookingId=${bookingId}`);
                  }}
                >
                  View Booking
                </button>
              ) : null}

              {/* MAINTENANCE / BLOCKED — admin only */}
              {isMaintenance && canManageUnits ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void runAction(() =>
                      updateUnit(token, detail.id, { status: 'AVAILABLE' }),
                    )
                  }
                >
                  Mark Available
                </button>
              ) : null}
              {isBlocked && actions?.unblock ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void runAction(() =>
                      updateUnit(token, detail.id, { status: 'AVAILABLE' }),
                    )
                  }
                >
                  Unblock Unit
                </button>
              ) : null}

              {/* Shared management actions when backend allows */}
              {actions?.maintenance && canManageUnits ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void runAction(() =>
                      updateUnit(token, detail.id, { status: 'MAINTENANCE' }),
                    )
                  }
                >
                  Mark Maintenance
                </button>
              ) : null}
              {actions?.block && canManageUnits ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void runAction(() =>
                      updateUnit(token, detail.id, { status: 'BLOCKED' }),
                    )
                  }
                >
                  Block Unit
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </FormModal>

      {detail && paymentOpen ? (
        <PaymentFormModal
          open={paymentOpen}
          token={token}
          isSuperAdmin={isSuperAdmin}
          preset={
            detail.bookingId
              ? { paymentForType: 'BOOKING', bookingId: detail.bookingId }
              : detail.tenancyId
                ? {
                    paymentForType: 'MONTHLY_TENANCY',
                    monthlyTenancyId: detail.tenancyId,
                  }
                : undefined
          }
          onClose={() => setPaymentOpen(false)}
          onSaved={() => {
            setPaymentOpen(false);
            onChanged();
            if (unitId) {
              void fetchDashboardUnitDetail(token, unitId).then(setDetail);
            }
          }}
          onError={(message) => setError(message)}
        />
      ) : null}
    </>
  );
}
