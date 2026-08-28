import type { DashboardRoomGridItem } from '../../types/dashboard';
import { formatHotelTime } from '../../lib/format';
import './UnitStatusCard.css';

type UnitStatusCardProps = {
  unit: DashboardRoomGridItem;
  compact?: boolean;
  onClick: (unitId: string) => void;
  onCheckOut?: (unit: DashboardRoomGridItem) => void;
};

function formatMoney(value: string | null): string | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  return `Rs. ${new Intl.NumberFormat('en-PK', {
    maximumFractionDigits: 0,
  }).format(n)}`;
}

function formatDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function isHotelStay(unit: DashboardRoomGridItem): boolean {
  return unit.bookingType === 'DAILY' || unit.bookingType === 'HOURLY';
}

export function isEarlyHotelCheckout(unit: DashboardRoomGridItem): boolean {
  if (!unit.checkoutDate) return false;
  const planned = new Date(unit.checkoutDate).getTime();
  return Number.isFinite(planned) && planned > Date.now();
}

export function unitAllowsHotelCheckout(unit: DashboardRoomGridItem): boolean {
  if (!unit.bookingId) return false;
  if (!isHotelStay(unit)) return false;
  if (unit.bookingStatus === 'CHECKED_IN' || unit.canCheckOut === true) {
    return true;
  }
  if (unit.bookingStatus && unit.bookingStatus !== 'CHECKED_IN') {
    return false;
  }
  const label = (unit.statusLabel ?? unit.status).toUpperCase();
  if (label.includes('ASSIGNED')) return false;
  return (
    unit.status === 'OCCUPIED' &&
    (label.includes('OCCUPIED') || label === 'OCCUPIED')
  );
}

function checkoutButtonLabel(unit: DashboardRoomGridItem): string {
  return isEarlyHotelCheckout(unit) ? 'Early Check Out' : 'Check Out';
}

function primaryLine(unit: DashboardRoomGridItem): string {
  const label = (unit.statusLabel ?? unit.status).toUpperCase();
  if (unit.statusTone === 'green' || unit.status === 'AVAILABLE') {
    return 'Ready to book';
  }
  if (unit.status === 'MONTHLY_TENANT_VACANT' || label.includes('MONTHLY')) {
    return unit.hotelUseAllowed
      ? 'Monthly Unit Empty / Hotel use allowed'
      : 'Monthly Unit Empty';
  }
  if (label.includes('CLEANING')) {
    return unit.guestName ? `Guest: ${unit.guestName}` : 'Guest checked out';
  }
  if (label.includes('ACCOUNT')) {
    return 'Check-out done · accounts pending';
  }
  if (label.includes('CHECKOUT TODAY')) {
    return unit.guestName ?? unit.monthlyTenant ?? 'Checkout due today';
  }
  if (unit.status === 'MAINTENANCE') {
    return 'Under maintenance';
  }
  if (unit.status === 'BLOCKED') {
    return 'Blocked / Inactive';
  }
  return unit.guestName ?? unit.monthlyTenant ?? '—';
}

export function UnitStatusCard({
  unit,
  compact = false,
  onClick,
  onCheckOut,
}: UnitStatusCardProps) {
  const unitNumber = unit.unitNumber ?? unit.roomNumber;
  const statusLabel = (unit.statusLabel ?? unit.status.replaceAll('_', ' '))
    .replaceAll('_', ' ')
    .toUpperCase();
  const hotelStay = isHotelStay(unit);
  const checkInTime = hotelStay ? formatHotelTime(unit.checkInDate) : null;
  const checkOutTime = hotelStay ? formatHotelTime(unit.checkoutDate) : null;
  const checkoutDate = formatDate(unit.checkoutDate);
  const balance = formatMoney(unit.remaining);
  const tone = unit.statusTone;
  const showCheckOut = Boolean(onCheckOut) && unitAllowsHotelCheckout(unit);

  return (
    <article
      className={`unit-status-card unit-status-card--${tone}${
        compact ? ' unit-status-card--compact' : ''
      }${showCheckOut ? ' unit-status-card--checkout-ready' : ''}`}
    >
      <button
        type="button"
        className="unit-status-card__open"
        onClick={() => onClick(unit.id)}
      >
        <header className="unit-status-card__header">
          <div>
            <strong className="unit-status-card__number">{unitNumber}</strong>
            <span className="unit-status-card__type">
              {unit.unitType === 'APARTMENT' ? 'Apartment' : 'Room'}
            </span>
          </div>
          <span
            className={`unit-status-card__badge unit-status-card__badge--${tone}`}
          >
            {statusLabel}
          </span>
        </header>

        <p className="unit-status-card__primary">{primaryLine(unit)}</p>

        <div className="unit-status-card__footer">
          <div className="unit-status-card__meta">
            {checkInTime ? <span>In {checkInTime}</span> : null}
            {checkOutTime ? (
              <span>
                Out {checkOutTime}
                {checkoutDate ? ` · ${checkoutDate}` : ''}
              </span>
            ) : checkoutDate ? (
              <span>Check-out: {checkoutDate}</span>
            ) : null}
            {balance &&
            (unit.hasOutstanding ||
              unit.statusTone === 'blue' ||
              unit.statusTone === 'purple' ||
              unit.statusTone === 'red') ? (
              <span
                className={
                  unit.hasOutstanding ? 'unit-status-card__balance' : undefined
                }
              >
                {balance}
              </span>
            ) : null}
            {unit.bookingType ? (
              <span className="unit-status-card__booking-type">
                {unit.bookingType}
              </span>
            ) : null}
          </div>
          <span className="unit-status-card__manage">Manage</span>
        </div>
      </button>
      {showCheckOut ? (
        <button
          type="button"
          className="unit-status-card__checkout"
          onClick={() => onCheckOut?.(unit)}
        >
          {checkoutButtonLabel(unit)}
        </button>
      ) : null}
    </article>
  );
}
