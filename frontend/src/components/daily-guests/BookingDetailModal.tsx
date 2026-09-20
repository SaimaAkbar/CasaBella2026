import type { Booking } from '../../types/booking';
import { PaymentHistoryList } from '../payments/PaymentHistoryList';
import { PrintLatestReceiptButton } from '../receipts/PrintLatestReceiptButton';
import { FormModal } from '../ui/FormModal';
import { BookingStatusBadge } from '../ui/BookingStatusBadge';
import { DateTimeDisplay } from '../ui/DateTimeDisplay';
import { MoneyDisplay } from '../ui/MoneyDisplay';
import { PaymentStatusBadge } from '../ui/PaymentStatusBadge';
import '../../styles/forms.css';

type BookingDetailModalProps = {
  open: boolean;
  booking: Booking | null;
  busy: boolean;
  canConfirm: boolean;
  canCheckIn: boolean;
  canCheckOut: boolean;
  canCancel: boolean;
  canNoShow: boolean;
  canClearFlags: boolean;
  token?: string;
  canAddPayment?: boolean;
  paymentRefreshKey?: number;
  onAddPayment?: () => void;
  onReprintError?: (message: string) => void;
  canEdit?: boolean;
  onEdit?: () => void;
  onClose: () => void;
  onConfirm: () => void;
  onCheckIn: () => void;
  onCheckOut: () => void;
  onCancel: () => void;
  onNoShow: () => void;
  onMarkCleaning: () => void;
  onMarkAccounts: () => void;
};

export function BookingDetailModal({
  open,
  booking,
  busy,
  canConfirm,
  canCheckIn,
  canCheckOut,
  canCancel,
  canNoShow,
  canClearFlags,
  token,
  canAddPayment = false,
  paymentRefreshKey = 0,
  onAddPayment,
  onReprintError,
  canEdit = false,
  onEdit,
  onClose,
  onConfirm,
  onCheckIn,
  onCheckOut,
  onCancel,
  onNoShow,
  onMarkCleaning,
  onMarkAccounts,
}: BookingDetailModalProps) {
  if (!booking) return null;

  return (
    <FormModal open={open} title="Booking Details" onClose={onClose}>
      <dl className="detail-list">
        <div>
          <dt>Booking Number</dt>
          <dd>{booking.bookingNumber}</dd>
        </div>
        <div>
          <dt>Guest</dt>
          <dd>{booking.guest?.fullName ?? '—'}</dd>
        </div>
        <div>
          <dt>Phone</dt>
          <dd>{booking.guest?.phone ?? '—'}</dd>
        </div>
        <div>
          <dt>CNIC / Passport</dt>
          <dd>{booking.guest?.cnicOrPassport ?? '—'}</dd>
        </div>
        <div>
          <dt>Property</dt>
          <dd>{booking.unit?.property?.name ?? '—'}</dd>
        </div>
        <div>
          <dt>Unit</dt>
          <dd>{booking.unit?.unitNumber ?? '—'}</dd>
        </div>
        <div>
          <dt>Booking Type</dt>
          <dd>{booking.bookingType}</dd>
        </div>
        <div>
          <dt>Source</dt>
          <dd>
            {booking.bookingSource === 'ONLINE' ? (
              <span className="daily-guests-page__online-badge">ONLINE / WEBSITE</span>
            ) : (
              booking.bookingSource || 'WALK-IN / POS'
            )}
          </dd>
        </div>
        <div>
          <dt>
            {booking.bookingType === 'HOURLY'
              ? 'Number of Hours'
              : 'Number of Nights'}
          </dt>
          <dd>
            {booking.bookingType === 'HOURLY'
              ? `${booking.numberOfHours ?? 0} ${
                  booking.numberOfHours === 1 ? 'Hour' : 'Hours'
                }`
              : `${booking.numberOfDays ?? 0} ${
                  booking.numberOfDays === 1 ? 'Night' : 'Nights'
                }`}
          </dd>
        </div>
        <div>
          <dt>
            {booking.bookingType === 'HOURLY' ? 'Rate Per Hour' : 'Rate Per Night'}
          </dt>
          <dd>
            <MoneyDisplay
              value={
                booking.bookingType === 'HOURLY'
                  ? booking.hourlyRate
                  : booking.dailyRate
              }
            />
          </dd>
        </div>
        <div>
          <dt>Scheduled Check-In</dt>
          <dd>
            <DateTimeDisplay value={booking.checkInDateTime} />
          </dd>
        </div>
        <div>
          <dt>Actual Check-In</dt>
          <dd>
            <DateTimeDisplay value={booking.actualCheckInAt} />
          </dd>
        </div>
        <div>
          <dt>Check-Out</dt>
          <dd>
            <DateTimeDisplay
              value={booking.actualCheckOutAt ?? booking.checkOutDateTime}
            />
          </dd>
        </div>
        {booking.actualCheckOutAt &&
        new Date(booking.actualCheckOutAt).getTime() !==
          new Date(booking.checkOutDateTime).getTime() ? (
          <div>
            <dt>Scheduled Check-Out</dt>
            <dd>
              <DateTimeDisplay value={booking.checkOutDateTime} />
            </dd>
          </div>
        ) : null}
        <div>
          <dt>Room Charges</dt>
          <dd>
            <MoneyDisplay value={booking.roomCharges} />
          </dd>
        </div>
        <div>
          <dt>Other Amenities</dt>
          <dd>{booking.otherChargesDescription || '—'}</dd>
        </div>
        <div>
          <dt>Additional Charges</dt>
          <dd>
            <MoneyDisplay value={booking.otherCharges} />
          </dd>
        </div>
        {Number(booking.electricityCharges) +
          Number(booking.cleaningCharges) +
          Number(booking.laundryCharges) +
          Number(booking.maintenanceCharges) >
        0 ? (
          <div>
            <dt>Historical extra charges</dt>
            <dd>
              <MoneyDisplay
                value={
                  Number(booking.electricityCharges) +
                  Number(booking.cleaningCharges) +
                  Number(booking.laundryCharges) +
                  Number(booking.maintenanceCharges)
                }
              />
            </dd>
          </div>
        ) : null}
        {Number(booking.discountAmount) > 0 ? (
          <div>
            <dt>Discount</dt>
            <dd>
              <MoneyDisplay value={booking.discountAmount} />
            </dd>
          </div>
        ) : null}
        <div>
          <dt>Total Bill</dt>
          <dd>
            <MoneyDisplay value={booking.totalAmount} />
          </dd>
        </div>
        <div>
          <dt>Paid</dt>
          <dd>
            <MoneyDisplay value={booking.receivedAmount} />
          </dd>
        </div>
        <div>
          <dt>Remaining</dt>
          <dd
            className={
              Number(booking.remainingAmount) > 0
                ? 'daily-guests-page__remaining is-due'
                : undefined
            }
          >
            <MoneyDisplay value={booking.remainingAmount} />
          </dd>
        </div>
        <div>
          <dt>Payment Status</dt>
          <dd>
            <PaymentStatusBadge state={booking.paymentState} />
          </dd>
        </div>
        <div>
          <dt>Booking Status</dt>
          <dd>
            <BookingStatusBadge status={booking.bookingStatus} />
          </dd>
        </div>
        <div>
          <dt>Cleaning Cleared</dt>
          <dd>{booking.cleaningCleared ? 'Yes' : 'No'}</dd>
        </div>
        <div>
          <dt>Accounts Cleared</dt>
          <dd>{booking.accountsCleared ? 'Yes' : 'No'}</dd>
        </div>
        <div>
          <dt>Notes</dt>
          <dd>{booking.notes || '—'}</dd>
        </div>
        <div>
          <dt>Created</dt>
          <dd>
            <DateTimeDisplay value={booking.createdAt} />
          </dd>
        </div>
        <div>
          <dt>Updated</dt>
          <dd>
            <DateTimeDisplay value={booking.updatedAt} />
          </dd>
        </div>
      </dl>

      {token ? (
        <PaymentHistoryList
          token={token}
          bookingId={booking.id}
          canAddPayment={canAddPayment}
          onAddPayment={onAddPayment}
          refreshKey={paymentRefreshKey}
          onReprintError={onReprintError}
        />
      ) : null}

      <div className="form-actions" style={{ flexWrap: 'wrap' }}>
        {token ? (
          <PrintLatestReceiptButton
            token={token}
            bookingId={booking.id}
            className="btn btn--primary"
            onError={onReprintError}
          />
        ) : null}
        {canEdit && onEdit ? (
          <button
            type="button"
            className="btn btn--ghost"
            disabled={busy}
            onClick={onEdit}
          >
            Edit Booking
          </button>
        ) : null}
        {canConfirm && booking.bookingStatus === 'PENDING' ? (
          <button
            type="button"
            className="btn btn--primary"
            disabled={busy}
            onClick={onConfirm}
          >
            Confirm
          </button>
        ) : null}
        {canCheckIn && booking.bookingStatus === 'CONFIRMED' ? (
          <button
            type="button"
            className="btn btn--primary"
            disabled={busy}
            onClick={onCheckIn}
          >
            Check-In
          </button>
        ) : null}
        {canCheckOut && booking.bookingStatus === 'CHECKED_IN' ? (
          <button
            type="button"
            className="btn btn--primary"
            disabled={busy}
            onClick={onCheckOut}
          >
            Check-Out
          </button>
        ) : null}
        {canCancel &&
        (booking.bookingStatus === 'PENDING' ||
          booking.bookingStatus === 'CONFIRMED') ? (
          <button
            type="button"
            className="btn btn--ghost"
            disabled={busy}
            onClick={onCancel}
          >
            Cancel
          </button>
        ) : null}
        {canNoShow &&
        (booking.bookingStatus === 'CONFIRMED' ||
          booking.bookingStatus === 'PENDING') ? (
          <button
            type="button"
            className="btn btn--ghost"
            disabled={busy}
            onClick={onNoShow}
          >
            Mark No-Show
          </button>
        ) : null}
        {canClearFlags &&
        booking.bookingStatus === 'CHECKED_OUT' &&
        !booking.cleaningCleared ? (
          <button
            type="button"
            className="btn btn--ghost"
            disabled={busy}
            onClick={onMarkCleaning}
          >
            Mark Cleaning Cleared
          </button>
        ) : null}
        {canClearFlags &&
        booking.bookingStatus === 'CHECKED_OUT' &&
        !booking.accountsCleared ? (
          <button
            type="button"
            className="btn btn--ghost"
            disabled={busy}
            onClick={onMarkAccounts}
          >
            Mark Accounts Cleared
          </button>
        ) : null}
        <button type="button" className="btn btn--ghost" onClick={onClose}>
          Close
        </button>
      </div>
    </FormModal>
  );
}
