import { useEffect, useMemo, useState } from 'react';
import {
  fetchPayment,
  fetchPaymentSummary,
  fetchPayments,
  refundPayment,
  reversePayment,
} from '../api/payments';
import { PaymentDetailModal } from '../components/payments/PaymentDetailModal';
import { PaymentFormModal } from '../components/payments/PaymentFormModal';
import { SummaryCard } from '../components/dashboard/SummaryCard';
import { PageHeader } from '../components/PageHeader';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { DataTable, type DataTableColumn } from '../components/ui/DataTable';
import { DateTimeDisplay } from '../components/ui/DateTimeDisplay';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { FilterBar } from '../components/ui/FilterBar';
import { LoadingState } from '../components/ui/LoadingState';
import { MoneyDisplay } from '../components/ui/MoneyDisplay';
import { Toast } from '../components/ui/Toast';
import { useAuth } from '../context/AuthContext';
import { useApiErrorHandler } from '../hooks/useApiErrorHandler';
import { formatLabel, formatPkr } from '../lib/format';
import type {
  Payment,
  PaymentForType,
  PaymentMethod,
  PaymentRecordStatus,
  PaymentSummary,
  PaymentTransactionType,
} from '../types/payment';
import '../styles/forms.css';
import './PaymentsPage.css';

const now = new Date();

export function PaymentsPage() {
  const { token, user } = useAuth();
  const handleApiError = useApiErrorHandler();

  const role = user?.role;
  const isSuperAdmin = role === 'SUPER_ADMIN';
  const canRecord = Boolean(role);
  const canRefund = isSuperAdmin;
  const canReverse = isSuperAdmin;
  const canViewFullSummary = role !== 'RECEPTIONIST';

  const [payments, setPayments] = useState<Payment[]>([]);
  const [summary, setSummary] = useState<PaymentSummary | null>(null);
  const [search, setSearch] = useState('');
  const [paymentForType, setPaymentForType] = useState<PaymentForType | ''>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | ''>('');
  const [transactionType, setTransactionType] = useState<
    PaymentTransactionType | ''
  >('');
  const [status, setStatus] = useState<PaymentRecordStatus | ''>('');
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

  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<Payment | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refundTarget, setRefundTarget] = useState<Payment | null>(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [reverseTarget, setReverseTarget] = useState<Payment | null>(null);
  const [reverseReason, setReverseReason] = useState('');

  const query = useMemo(
    () => ({
      search: search.trim() || undefined,
      paymentForType,
      paymentMethod,
      transactionType,
      status,
      today: todayOnly || undefined,
      month: month ? Number(month) : ('' as const),
      year: year ? Number(year) : ('' as const),
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    }),
    [
      search,
      paymentForType,
      paymentMethod,
      transactionType,
      status,
      todayOnly,
      month,
      year,
      startDate,
      endDate,
    ],
  );

  async function loadData() {
    if (!token) return;
    setIsLoading(true);
    setError('');
    try {
      const [rows, stats] = await Promise.all([
        fetchPayments(token, query),
        fetchPaymentSummary(token, query),
      ]);
      setPayments(rows);
      setSummary(stats);
    } catch (err) {
      setError(handleApiError(err, 'Unable to load payments.'));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [token, query]);

  async function openDetail(payment: Payment) {
    if (!token) return;
    try {
      const full = await fetchPayment(token, payment.id);
      setSelected(full);
      setShowDetail(true);
    } catch (err) {
      setToast({
        message: handleApiError(err, 'Unable to load payment detail.'),
        tone: 'error',
      });
    }
  }

  function printReceipt(payment: Payment) {
    const receipt = payment.receipt;
    if (!receipt) {
      setToast({ message: 'Receipt data is unavailable.', tone: 'error' });
      return;
    }

    const html = `
      <html><head><title>${receipt.paymentNumber}</title>
      <style>
        body { font-family: Georgia, serif; padding: 24px; color: #111; }
        h1 { margin: 0 0 8px; }
        .meta { color: #555; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; }
        td { padding: 6px 0; border-bottom: 1px solid #eee; }
        td:last-child { text-align: right; font-weight: 600; }
      </style></head><body>
      <h1>${receipt.hotelOrPropertyName}</h1>
      <div class="meta">Payment Receipt · ${receipt.paymentNumber}</div>
      <table>
        <tr><td>Date</td><td>${new Date(receipt.paymentDateTime).toLocaleString()}</td></tr>
        <tr><td>Payer</td><td>${receipt.payerName}</td></tr>
        <tr><td>Property / Unit</td><td>${receipt.property} / ${receipt.unit}</td></tr>
        <tr><td>Type</td><td>${receipt.paymentType} / ${receipt.transactionType}</td></tr>
        <tr><td>Method</td><td>${receipt.paymentMethod}</td></tr>
        <tr><td>Reference</td><td>${receipt.transactionReference || '—'}</td></tr>
        <tr><td>Total Payable</td><td>${formatPkr(receipt.totalPayable)}</td></tr>
        <tr><td>Previous Received</td><td>${formatPkr(receipt.previousReceived)}</td></tr>
        <tr><td>Current Payment</td><td>${formatPkr(receipt.currentPayment)}</td></tr>
        <tr><td>Total Received</td><td>${formatPkr(receipt.totalReceived)}</td></tr>
        <tr><td>Remaining</td><td>${formatPkr(receipt.remainingBalance)}</td></tr>
        <tr><td>Received By</td><td>${receipt.receivedBy}</td></tr>
        <tr><td>Notes</td><td>${receipt.notes || '—'}</td></tr>
      </table>
      </body></html>`;

    const win = window.open('', '_blank', 'noopener,noreferrer,width=720,height=900');
    if (!win) {
      setToast({ message: 'Popup blocked. Allow popups to print.', tone: 'error' });
      return;
    }
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  }

  async function confirmRefund() {
    if (!token || !refundTarget) return;
    const amount = Number(refundAmount);
    if (!amount || amount <= 0 || !refundReason.trim()) {
      setToast({
        message: 'Refund amount and reason are required.',
        tone: 'error',
      });
      return;
    }
    setBusy(true);
    try {
      await refundPayment(token, refundTarget.id, {
        amount,
        reason: refundReason.trim(),
      });
      setRefundTarget(null);
      setShowDetail(false);
      setToast({ message: 'Refund recorded.', tone: 'success' });
      await loadData();
    } catch (err) {
      setToast({
        message: handleApiError(err, 'Unable to refund payment.'),
        tone: 'error',
      });
    } finally {
      setBusy(false);
    }
  }

  async function confirmReverse() {
    if (!token || !reverseTarget || !reverseReason.trim()) {
      setToast({ message: 'Reversal reason is required.', tone: 'error' });
      return;
    }
    setBusy(true);
    try {
      await reversePayment(token, reverseTarget.id, {
        reason: reverseReason.trim(),
      });
      setReverseTarget(null);
      setShowDetail(false);
      setToast({ message: 'Payment reversed.', tone: 'success' });
      await loadData();
    } catch (err) {
      setToast({
        message: handleApiError(err, 'Unable to reverse payment.'),
        tone: 'error',
      });
    } finally {
      setBusy(false);
    }
  }

  const columns: Array<DataTableColumn<Payment>> = [
    {
      key: 'number',
      header: 'Payment Number',
      render: (row) => row.paymentNumber,
    },
    {
      key: 'date',
      header: 'Date',
      render: (row) => <DateTimeDisplay value={row.paymentDate} />,
    },
    {
      key: 'source',
      header: 'Source',
      render: (row) => formatLabel(row.paymentForType),
    },
    {
      key: 'payer',
      header: 'Guest / Tenant',
      render: (row) =>
        row.booking?.guest?.fullName ??
        row.monthlyTenancy?.tenant?.fullName ??
        '—',
    },
    {
      key: 'property',
      header: 'Property',
      render: (row) =>
        row.booking?.unit?.property?.name ??
        row.monthlyTenancy?.unit?.property?.name ??
        '—',
    },
    {
      key: 'unit',
      header: 'Unit',
      render: (row) =>
        row.booking?.unit?.unitNumber ??
        row.monthlyTenancy?.unit?.unitNumber ??
        '—',
    },
    {
      key: 'type',
      header: 'Transaction Type',
      render: (row) => formatLabel(row.transactionType),
    },
    {
      key: 'method',
      header: 'Method',
      render: (row) => formatLabel(row.paymentMethod),
    },
    {
      key: 'amount',
      header: 'Amount',
      render: (row) => <MoneyDisplay value={row.amount} />,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => formatLabel(row.status),
    },
    {
      key: 'by',
      header: 'Received By',
      render: (row) => row.createdBy?.fullName ?? '—',
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="data-table__actions">
          <button
            type="button"
            className="data-table__action"
            onClick={() => void openDetail(row)}
          >
            View
          </button>
          <button
            type="button"
            className="data-table__action"
            onClick={() => void openDetail(row).then(() => undefined)}
          >
            Receipt
          </button>
          {canRefund &&
          row.transactionType === 'PAYMENT' &&
          row.status === 'COMPLETED' ? (
            <button
              type="button"
              className="data-table__action"
              onClick={() => {
                setRefundTarget(row);
                setRefundAmount(row.amount);
                setRefundReason('');
              }}
            >
              Refund
            </button>
          ) : null}
          {canReverse &&
          row.transactionType === 'PAYMENT' &&
          row.status === 'COMPLETED' ? (
            <button
              type="button"
              className="data-table__action data-table__action--danger"
              onClick={() => {
                setReverseTarget(row);
                setReverseReason('');
              }}
            >
              Reverse
            </button>
          ) : null}
        </div>
      ),
    },
  ];

  const years = Array.from({ length: 6 }, (_, i) => now.getFullYear() - i);

  return (
    <section className="entity-page payments-page">
      <PageHeader title="Payments" breadcrumb={['Home', 'Payments']} />

      {canRecord ? (
        <div className="entity-page__toolbar payments-page__toolbar">
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => setShowForm(true)}
          >
            Record Payment
          </button>
        </div>
      ) : null}

      {summary ? (
        <div className="payments-page__summary">
          <SummaryCard
            label="Total Received Today"
            value={formatPkr(summary.totalReceivedToday)}
            tone="success"
          />
          {canViewFullSummary ? (
            <SummaryCard
              label="Total Received This Month"
              value={formatPkr(summary.totalReceivedThisMonth)}
              tone="gold"
            />
          ) : null}
          <SummaryCard
            label="Booking Payments"
            value={formatPkr(summary.bookingPayments)}
            tone="info"
          />
          <SummaryCard
            label="Monthly Tenant Payments"
            value={formatPkr(summary.monthlyTenantPayments)}
            tone="default"
          />
          {canViewFullSummary ? (
            <SummaryCard
              label="Refunds"
              value={formatPkr(summary.refunds)}
              tone="warn"
            />
          ) : null}
          <SummaryCard
            label="Outstanding Balance"
            value={formatPkr(summary.outstandingBalance)}
            tone="danger"
          />
        </div>
      ) : null}

      <FilterBar>
        <label>
          <span>Search</span>
          <input
            type="search"
            value={search}
            placeholder="Payment #, guest, tenant, unit…"
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <label>
          <span>Source</span>
          <select
            value={paymentForType}
            onChange={(e) =>
              setPaymentForType(e.target.value as PaymentForType | '')
            }
          >
            <option value="">All</option>
            <option value="BOOKING">Booking</option>
            <option value="MONTHLY_TENANCY">Monthly Tenancy</option>
          </select>
        </label>
        <label>
          <span>Method</span>
          <select
            value={paymentMethod}
            onChange={(e) =>
              setPaymentMethod(e.target.value as PaymentMethod | '')
            }
          >
            <option value="">All</option>
            <option value="CASH">Cash</option>
            <option value="BANK_TRANSFER">Bank Transfer</option>
            <option value="CARD">Card</option>
            <option value="EASYPAISA">Easypaisa</option>
            <option value="JAZZCASH">JazzCash</option>
            <option value="OTHER">Other</option>
          </select>
        </label>
        <label>
          <span>Transaction Type</span>
          <select
            value={transactionType}
            onChange={(e) =>
              setTransactionType(e.target.value as PaymentTransactionType | '')
            }
          >
            <option value="">All</option>
            <option value="PAYMENT">Payment</option>
            <option value="REFUND">Refund</option>
            <option value="REVERSAL">Reversal</option>
            <option value="ADJUSTMENT">Adjustment</option>
          </select>
        </label>
        <label>
          <span>Status</span>
          <select
            value={status}
            onChange={(e) =>
              setStatus(e.target.value as PaymentRecordStatus | '')
            }
          >
            <option value="">All</option>
            <option value="COMPLETED">Completed</option>
            <option value="REVERSED">Reversed</option>
            <option value="REFUNDED">Refunded</option>
            <option value="PENDING">Pending</option>
            <option value="CANCELLED">Cancelled</option>
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
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={String(i + 1)}>
                {new Date(2000, i, 1).toLocaleString(undefined, {
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
      </FilterBar>

      {isLoading ? <LoadingState message="Loading payments…" /> : null}
      {!isLoading && error ? (
        <ErrorState message={error} onRetry={() => void loadData()} />
      ) : null}
      {!isLoading && !error && payments.length === 0 ? (
        <EmptyState
          title="No payments found"
          description="Record an installment against a booking or monthly tenancy."
        />
      ) : null}
      {!isLoading && !error && payments.length > 0 ? (
        <DataTable columns={columns} rows={payments} rowKey={(row) => row.id} />
      ) : null}

      <PaymentFormModal
        open={showForm}
        token={token ?? ''}
        isSuperAdmin={isSuperAdmin}
        onClose={() => setShowForm(false)}
        onSaved={() => {
          setToast({ message: 'Payment recorded.', tone: 'success' });
          void loadData();
        }}
        onError={(message) => setToast({ message, tone: 'error' })}
      />

      <PaymentDetailModal
        open={showDetail}
        payment={selected}
        canRefund={canRefund}
        canReverse={canReverse}
        busy={busy}
        onClose={() => setShowDetail(false)}
        onRefund={() => {
          if (!selected) return;
          setRefundTarget(selected);
          setRefundAmount(selected.amount);
          setRefundReason('');
        }}
        onReverse={() => {
          if (!selected) return;
          setReverseTarget(selected);
          setReverseReason('');
        }}
        onPrint={() => selected && printReceipt(selected)}
      />

      <ConfirmDialog
        open={Boolean(refundTarget)}
        title="Refund payment?"
        message={`Enter amount and reason. Max refundable: ${formatPkr(refundTarget?.amount)}. Original payment is kept in history.`}
        confirmLabel="Refund"
        busy={busy}
        onCancel={() => setRefundTarget(null)}
        onConfirm={() => void confirmRefund()}
      />

      {refundTarget ? (
        <div className="payments-page__inline-fields">
          <label>
            Refund Amount
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={refundAmount}
              onChange={(e) => setRefundAmount(e.target.value)}
            />
          </label>
          <label>
            Reason
            <input
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
            />
          </label>
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(reverseTarget)}
        title="Reverse payment?"
        message="Creates a REVERSAL installment and marks the original as REVERSED. History is preserved."
        confirmLabel="Reverse"
        busy={busy}
        onCancel={() => setReverseTarget(null)}
        onConfirm={() => void confirmReverse()}
      />

      {reverseTarget ? (
        <div className="payments-page__inline-fields">
          <label>
            Reason
            <input
              value={reverseReason}
              onChange={(e) => setReverseReason(e.target.value)}
            />
          </label>
        </div>
      ) : null}

      <Toast
        message={toast.message}
        tone={toast.tone}
        onClose={() => setToast({ message: '', tone: 'success' })}
      />
    </section>
  );
}
