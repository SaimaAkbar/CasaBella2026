import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  apiRequest,
  isPendingApprovalError,
  toQueryString,
} from '../api/client';
import { useAuth } from '../context/AuthContext';
import './OnlineBookingsPage.css';

type OnlineBookingRow = {
  id: string;
  bookingNumber: string;
  bookingStatus: string;
  paymentState: string;
  bookingSource: string | null;
  checkInDateTime: string;
  checkOutDateTime: string;
  numberOfGuests: number;
  adults?: number | null;
  children?: number | null;
  totalAmount: number | string;
  receivedAmount: number | string;
  remainingAmount: number | string;
  createdAt: string;
  guest?: { fullName: string; phone: string; email?: string | null };
  unit?: {
    unitNumber: string;
    displayName?: string | null;
    property?: { name: string };
  };
  onlinePayment?: {
    id: string;
    status: string;
    statusLabel?: string;
    gateway: string;
    tracker?: string | null;
    gatewayReference?: string | null;
    transactionReference?: string | null;
    transferDate?: string | null;
    senderName?: string | null;
    senderBank?: string | null;
    receiptPath?: string | null;
    rejectionReason?: string | null;
    staffNotes?: string | null;
    amount: number | string;
    submittedAmount?: number | string | null;
    bookingTotalAmount?: number | string;
    paymentSelection?: 'ADVANCE_50' | 'FULL_100';
    paymentTypeLabel?: string;
    paidAt?: string | null;
    submittedAt?: string | null;
  } | null;
};

type Summary = {
  todayCreated?: number;
  todayOnlineBookings?: number;
  todayConfirmed: number;
  todayPaid?: number;
  pendingHolds?: number;
  pendingPayments?: number;
  pendingVerifications?: number;
  todayRevenue?: number | string;
  todayOnlineRevenue?: number;
  upcomingCheckIns?: number;
};

function money(value: number | string | undefined) {
  const n = Number(value ?? 0);
  return `PKR ${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
}

const REJECT_REASONS = [
  'Payment not received',
  'Transaction reference invalid',
  'Amount does not match',
  'Receipt unclear',
  'Duplicate transaction',
  'Other',
];

export function OnlineBookingsPage() {
  const { token, user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [rows, setRows] = useState<OnlineBookingRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [selected, setSelected] = useState<OnlineBookingRow | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState(false);
  const [confirmVerify, setConfirmVerify] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState(REJECT_REASONS[0]);
  const [staffNotes, setStaffNotes] = useState('');
  const [filter, setFilter] = useState({
    search: '',
    bookingStatus: '',
    paymentState: '',
    onlinePaymentStatus: '',
    paymentSelection: '',
    range: 'all',
  });

  const bookingParam = params.get('booking');
  const verifyParam = params.get('verify');
  const canVerify =
    user?.role === 'SUPER_ADMIN' ||
    user?.role === 'ADMIN' ||
    user?.role === 'RECEPTIONIST';

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const query: Record<string, string | undefined> = {
        search: filter.search || undefined,
        bookingStatus: filter.bookingStatus || undefined,
        paymentState: filter.paymentState || undefined,
        onlinePaymentStatus: filter.onlinePaymentStatus || undefined,
        range: filter.range || undefined,
      };
      const [list, sum] = await Promise.all([
        apiRequest<OnlineBookingRow[]>(
          `/online-bookings${toQueryString(query)}`,
          { token },
        ),
        apiRequest<Summary>('/online-bookings/summary', { token }),
      ]);
      let visible = list;
      if (filter.paymentSelection) {
        visible = list.filter(
          (r) => r.onlinePayment?.paymentSelection === filter.paymentSelection,
        );
      }
      setRows(visible);
      setSummary(sum);
      if (bookingParam) {
        const hit =
          visible.find((r) => r.id === bookingParam) ||
          (await apiRequest<OnlineBookingRow>(
            `/online-bookings/${bookingParam}`,
            { token },
          ).catch(() => null));
        if (hit) {
          setSelected(hit);
          if (
            verifyParam === '1' &&
            hit.onlinePayment?.status === 'AUTHORIZED'
          ) {
            setRejectOpen(false);
            setConfirmVerify(true);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load online bookings.');
    } finally {
      setLoading(false);
    }
  }, [bookingParam, filter, token, verifyParam]);

  useEffect(() => {
    void load();
  }, [load]);

  // Lightweight polling while pending verifications exist
  useEffect(() => {
    if (!token) return;
    const pending = summary?.pendingVerifications ?? 0;
    if (pending <= 0) return;
    const id = window.setInterval(() => void load(), 15_000);
    return () => window.clearInterval(id);
  }, [load, summary?.pendingVerifications, token]);

  const title = useMemo(() => 'Online Bookings / Payment Verification', []);
  const pendingCount =
    summary?.pendingVerifications ?? summary?.pendingPayments ?? 0;

  async function acceptPayment() {
    if (!token) return;
    const paymentId = selected?.onlinePayment?.id;
    if (!paymentId) {
      setError('Payment record is missing. Refresh and try again.');
      return;
    }
    setActionBusy(true);
    setError('');
    try {
      // Always re-fetch detail so we use the latest onlinePayment id/status.
      const fresh = await apiRequest<OnlineBookingRow>(
        `/online-bookings/${selected!.id}`,
        { token },
      );
      const id = fresh.onlinePayment?.id ?? paymentId;
      if (fresh.onlinePayment?.status !== 'AUTHORIZED') {
        setError(
          `This payment is no longer pending verification (status: ${fresh.onlinePayment?.status ?? 'unknown'}).`,
        );
        setSelected(fresh);
        setConfirmVerify(false);
        return;
      }
      await apiRequest(`/online-bookings/payments/${id}/verify`, {
        method: 'POST',
        token,
        body: staffNotes.trim() ? { staffNotes: staffNotes.trim() } : {},
      });
      setConfirmVerify(false);
      setStaffNotes('');
      setError('');
      await load();
    } catch (err) {
      if (isPendingApprovalError(err)) {
        setError(
          'Payment was sent for Super Admin approval and was NOT confirmed yet. Ask Super Admin to approve, or refresh and try again.',
        );
      } else {
        setError(
          err instanceof Error ? err.message : 'Unable to verify payment.',
        );
      }
    } finally {
      setActionBusy(false);
    }
  }

  async function rejectPayment() {
    if (!token) return;
    const paymentId = selected?.onlinePayment?.id;
    if (!paymentId) {
      setError('Payment record is missing. Refresh and try again.');
      return;
    }
    if (!rejectReason.trim()) {
      setError('Rejection reason is required.');
      return;
    }
    setActionBusy(true);
    setError('');
    try {
      const fresh = await apiRequest<OnlineBookingRow>(
        `/online-bookings/${selected!.id}`,
        { token },
      );
      const id = fresh.onlinePayment?.id ?? paymentId;
      await apiRequest(`/online-bookings/payments/${id}/reject`, {
        method: 'POST',
        token,
        body: {
          rejectionReason: rejectReason.trim(),
          ...(staffNotes.trim() ? { staffNotes: staffNotes.trim() } : {}),
        },
      });
      setRejectOpen(false);
      setStaffNotes('');
      setError('');
      await load();
    } catch (err) {
      if (isPendingApprovalError(err)) {
        setError(
          'Rejection was sent for Super Admin approval and was NOT applied yet.',
        );
      } else {
        setError(
          err instanceof Error ? err.message : 'Unable to reject payment.',
        );
      }
    } finally {
      setActionBusy(false);
    }
  }

  const apiBase = (import.meta.env.VITE_API_URL as string | undefined)?.replace(
    /\/$/,
    '',
  );

  return (
    <div className="ob-page">
      <header className="ob-page__header">
        <div>
          <h1>{title}</h1>
          <p>
            Website bookings with source ONLINE — same guests and rooms as POS.
            Bank transfers require staff verification before confirmation.
          </p>
        </div>
        <button type="button" className="ob-btn" onClick={() => void load()}>
          Refresh
        </button>
      </header>

      {pendingCount > 0 ? (
        <div className="ob-banner">
          🔔 {pendingCount} Pending Payment Verification
          {pendingCount === 1 ? '' : 's'}
          <button
            type="button"
            className="ob-link"
            onClick={() =>
              setFilter((f) => ({
                ...f,
                onlinePaymentStatus: 'AUTHORIZED',
                bookingStatus: '',
                paymentState: '',
              }))
            }
          >
            Show pending
          </button>
        </div>
      ) : null}

      {summary ? (
        <section className="ob-summary" aria-label="Today summary">
          <article>
            <span>Online Bookings</span>
            <strong>
              {summary.todayOnlineBookings ?? summary.todayCreated ?? 0}
            </strong>
          </article>
          <article>
            <span>Confirmed</span>
            <strong>{summary.todayConfirmed}</strong>
          </article>
          <article>
            <span>Payment Verification</span>
            <strong className={pendingCount > 0 ? 'ob-alert-count' : undefined}>
              {pendingCount > 0 ? `🔴 ${pendingCount}` : 0}
            </strong>
          </article>
          <article>
            <span>Pending holds</span>
            <strong>{summary.pendingHolds ?? 0}</strong>
          </article>
          <article>
            <span>Revenue</span>
            <strong>
              {money(summary.todayOnlineRevenue ?? summary.todayRevenue ?? 0)}
            </strong>
          </article>
        </section>
      ) : null}

      <section className="ob-filters">
        <input
          placeholder="Customer / booking number"
          value={filter.search}
          onChange={(e) => setFilter((f) => ({ ...f, search: e.target.value }))}
        />
        <select
          value={filter.range}
          onChange={(e) => setFilter((f) => ({ ...f, range: e.target.value }))}
        >
          <option value="today">Today</option>
          <option value="tomorrow">Tomorrow</option>
          <option value="upcoming">Upcoming</option>
          <option value="all">All</option>
        </select>
        <select
          value={filter.bookingStatus}
          onChange={(e) =>
            setFilter((f) => ({ ...f, bookingStatus: e.target.value }))
          }
        >
          <option value="">All booking statuses</option>
          <option value="PENDING">Pending</option>
          <option value="CONFIRMED">Confirmed</option>
          <option value="CANCELLED">Cancelled</option>
          <option value="CHECKED_IN">Checked in</option>
          <option value="CHECKED_OUT">Checked out</option>
        </select>
        <select
          value={filter.onlinePaymentStatus}
          onChange={(e) =>
            setFilter((f) => ({ ...f, onlinePaymentStatus: e.target.value }))
          }
        >
          <option value="">All payment statuses</option>
          <option value="AUTHORIZED">Pending Verification</option>
          <option value="PAID">Accepted / Verified</option>
          <option value="FAILED">Rejected</option>
          <option value="PENDING">Awaiting customer transfer</option>
        </select>
        <select
          value={filter.paymentSelection}
          onChange={(e) =>
            setFilter((f) => ({ ...f, paymentSelection: e.target.value }))
          }
        >
          <option value="">All payment types</option>
          <option value="ADVANCE_50">50% Advance</option>
          <option value="FULL_100">Full Payment</option>
        </select>
      </section>

      {error ? <div className="ob-error">{error}</div> : null}
      {loading ? <p>Loading…</p> : null}

      <div className="ob-table-wrap">
        <table className="ob-table">
          <thead>
            <tr>
              <th>Booking</th>
              <th>Customer</th>
              <th>Room/Apartment</th>
              <th>Check-in</th>
              <th>Check-out</th>
              <th>Payment Type</th>
              <th>Expected</th>
              <th>Submitted</th>
              <th>Txn Ref</th>
              <th>Payment Date</th>
              <th>Status</th>
              <th>Submitted At</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className={
                  row.onlinePayment?.status === 'AUTHORIZED'
                    ? 'ob-row--pending'
                    : undefined
                }
              >
                <td>{row.bookingNumber}</td>
                <td>{row.guest?.fullName ?? '—'}</td>
                <td>
                  {row.unit?.displayName || row.unit?.unitNumber || '—'}
                  {row.unit?.property?.name
                    ? ` · ${row.unit.property.name}`
                    : ''}
                </td>
                <td>{fmtDate(row.checkInDateTime)}</td>
                <td>{fmtDate(row.checkOutDateTime)}</td>
                <td>
                  {row.onlinePayment?.paymentTypeLabel ||
                    row.onlinePayment?.status ||
                    row.paymentState}
                </td>
                <td>{money(row.onlinePayment?.amount ?? row.totalAmount)}</td>
                <td>
                  {row.onlinePayment?.submittedAmount != null
                    ? money(row.onlinePayment.submittedAmount)
                    : '—'}
                </td>
                <td>
                  {row.onlinePayment?.transactionReference ||
                    row.onlinePayment?.gatewayReference ||
                    '—'}
                </td>
                <td>
                  {row.onlinePayment?.transferDate
                    ? fmtDate(row.onlinePayment.transferDate)
                    : '—'}
                </td>
                <td>
                  {row.onlinePayment?.statusLabel ||
                    row.onlinePayment?.status ||
                    row.bookingStatus}
                </td>
                <td>
                  {row.onlinePayment?.submittedAt
                    ? new Date(row.onlinePayment.submittedAt).toLocaleString()
                    : '—'}
                </td>
                <td>
                  <button
                    type="button"
                    className="ob-link"
                    onClick={() => {
                      setSelected(row);
                      setConfirmVerify(false);
                      setRejectOpen(false);
                      setParams({ booking: row.id });
                    }}
                  >
                    View Payment
                  </button>
                </td>
              </tr>
            ))}
            {!loading && rows.length === 0 ? (
              <tr>
                <td colSpan={13}>No online bookings found.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {selected ? (
        <aside className="ob-detail" aria-label="Payment verification">
          <header>
            <h2>Payment Verification</h2>
            <button
              type="button"
              onClick={() => {
                setSelected(null);
                setConfirmVerify(false);
                setRejectOpen(false);
                setParams({});
              }}
            >
              Close
            </button>
          </header>

          <h3>Customer Information</h3>
          <p>{selected.guest?.fullName}</p>
          <p>{selected.guest?.phone}</p>
          <p>{selected.guest?.email || '—'}</p>

          <h3>Booking Information</h3>
          <p>
            <strong>Booking:</strong> {selected.bookingNumber}
          </p>
          <p>
            <strong>Room/Apartment:</strong>{' '}
            {selected.unit?.displayName || selected.unit?.unitNumber}
          </p>
          <p>
            <strong>Check-in:</strong> {fmtDate(selected.checkInDateTime)}
          </p>
          <p>
            <strong>Check-out:</strong> {fmtDate(selected.checkOutDateTime)}
          </p>
          <p>
            <strong>Booking Total:</strong> {money(selected.totalAmount)}
          </p>
          <p>
            <strong>Booking Status:</strong> {selected.bookingStatus}
          </p>

          <h3>Payment</h3>
          <p>
            <strong>Payment Type:</strong>{' '}
            {selected.onlinePayment?.paymentTypeLabel || '—'}
          </p>
          <p>
            <strong>Expected Payment:</strong>{' '}
            {money(selected.onlinePayment?.amount)}
          </p>
          <p>
            <strong>Submitted Payment:</strong>{' '}
            {selected.onlinePayment?.submittedAmount != null
              ? money(selected.onlinePayment.submittedAmount)
              : '—'}
          </p>
          <p>
            <strong>Transaction Reference:</strong>{' '}
            {selected.onlinePayment?.transactionReference || '—'}
          </p>
          <p>
            <strong>Sender Name:</strong>{' '}
            {selected.onlinePayment?.senderName || '—'}
          </p>
          <p>
            <strong>Sender Bank:</strong>{' '}
            {selected.onlinePayment?.senderBank || '—'}
          </p>
          <p>
            <strong>Transfer Date:</strong>{' '}
            {selected.onlinePayment?.transferDate
              ? fmtDate(selected.onlinePayment.transferDate)
              : '—'}
          </p>
          <p>
            <strong>Payment Status:</strong>{' '}
            {selected.onlinePayment?.statusLabel ||
              selected.onlinePayment?.status ||
              selected.paymentState}
          </p>
          {selected.onlinePayment?.receiptPath ? (
            <p>
              <strong>Uploaded Receipt:</strong>{' '}
              <a
                href={`${apiBase || ''}${selected.onlinePayment.receiptPath}`}
                target="_blank"
                rel="noreferrer"
              >
                View receipt
              </a>
            </p>
          ) : (
            <p>
              <strong>Uploaded Receipt:</strong> —
            </p>
          )}
          {selected.onlinePayment?.rejectionReason ? (
            <p>
              <strong>Rejection Reason:</strong>{' '}
              {selected.onlinePayment.rejectionReason}
            </p>
          ) : null}

          <div className="ob-detail__actions">
            <Link className="ob-btn" to={`/daily-guests?booking=${selected.id}`}>
              Open in Daily Guests
            </Link>
            {canVerify && selected.onlinePayment?.status === 'AUTHORIZED' ? (
              <>
                <button
                  type="button"
                  className="ob-btn ob-btn--success"
                  disabled={actionBusy}
                  onClick={() => {
                    setError('');
                    setRejectOpen(false);
                    setConfirmVerify(true);
                  }}
                >
                  Accept Payment
                </button>
                <button
                  type="button"
                  className="ob-btn ob-btn--danger"
                  disabled={actionBusy}
                  onClick={() => {
                    setError('');
                    setConfirmVerify(false);
                    setRejectOpen(true);
                  }}
                >
                  Reject Payment
                </button>
              </>
            ) : null}
            {!canVerify && selected.onlinePayment?.status === 'AUTHORIZED' ? (
              <p className="ob-hint">
                Sign in as Admin, Super Admin, or Receptionist to verify payments.
              </p>
            ) : null}
          </div>
        </aside>
      ) : null}

      {confirmVerify && selected ? (
        <div className="ob-modal-backdrop" role="presentation">
          <div
            className="ob-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ob-verify-title"
          >
            <h2 id="ob-verify-title">Verify bank payment?</h2>
            <p>
              Have you checked the Casa Bella bank account and confirmed this
              transfer was received?
            </p>
            <p>
              <strong>{selected.bookingNumber}</strong>
              {' · '}
              {selected.guest?.fullName}
              {' · '}
              {selected.onlinePayment?.paymentTypeLabel}
              {' · '}
              {money(
                selected.onlinePayment?.submittedAmount ??
                  selected.onlinePayment?.amount,
              )}
            </p>
            <label className="ob-modal__field">
              Staff notes (optional)
              <textarea
                value={staffNotes}
                onChange={(e) => setStaffNotes(e.target.value)}
                rows={3}
              />
            </label>
            {error ? <div className="ob-error">{error}</div> : null}
            <div className="ob-modal__actions">
              <button
                type="button"
                className="ob-btn"
                disabled={actionBusy}
                onClick={() => {
                  setConfirmVerify(false);
                  setError('');
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="ob-btn ob-btn--success"
                disabled={actionBusy}
                onClick={() => void acceptPayment()}
              >
                {actionBusy ? 'Verifying…' : 'Yes, Verify Payment'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {rejectOpen && selected ? (
        <div className="ob-modal-backdrop" role="presentation">
          <div
            className="ob-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ob-reject-title"
          >
            <h2 id="ob-reject-title">Reject payment?</h2>
            <label className="ob-modal__field">
              Rejection Reason
              <select
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              >
                {REJECT_REASONS.map((reason) => (
                  <option key={reason} value={reason}>
                    {reason}
                  </option>
                ))}
              </select>
            </label>
            <label className="ob-modal__field">
              Staff Notes
              <textarea
                value={staffNotes}
                onChange={(e) => setStaffNotes(e.target.value)}
                rows={3}
              />
            </label>
            {error ? <div className="ob-error">{error}</div> : null}
            <div className="ob-modal__actions">
              <button
                type="button"
                className="ob-btn"
                disabled={actionBusy}
                onClick={() => {
                  setRejectOpen(false);
                  setError('');
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="ob-btn ob-btn--danger"
                disabled={actionBusy}
                onClick={() => void rejectPayment()}
              >
                {actionBusy ? 'Rejecting…' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
