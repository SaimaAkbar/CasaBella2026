import { useEffect, useState } from 'react';
import {
  fetchPaymentsByBooking,
  fetchPaymentsByTenancy,
} from '../../api/payments';
import { formatLabel, formatPkr } from '../../lib/format';
import type { Payment } from '../../types/payment';
import { ReprintReceiptButton } from '../receipts/ReprintReceiptButton';
import { DateTimeDisplay } from '../ui/DateTimeDisplay';
import { LoadingState } from '../ui/LoadingState';

type PaymentHistoryListProps = {
  token: string;
  bookingId?: string;
  monthlyTenancyId?: string;
  onAddPayment?: () => void;
  canAddPayment?: boolean;
  canReprint?: boolean;
  refreshKey?: number;
  onReprintError?: (message: string) => void;
};

export function PaymentHistoryList({
  token,
  bookingId,
  monthlyTenancyId,
  onAddPayment,
  canAddPayment = false,
  canReprint = true,
  refreshKey = 0,
  onReprintError,
}: PaymentHistoryListProps) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token || (!bookingId && !monthlyTenancyId)) return;

    let cancelled = false;
    setLoading(true);
    setError('');

    const request = bookingId
      ? fetchPaymentsByBooking(token, bookingId)
      : fetchPaymentsByTenancy(token, monthlyTenancyId!);

    void request
      .then((rows) => {
        if (!cancelled) setPayments(rows);
      })
      .catch(() => {
        if (!cancelled) setError('Unable to load payment history.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token, bookingId, monthlyTenancyId, refreshKey]);

  return (
    <div className="payment-history">
      <div className="payment-history__header">
        <h3>Payment History</h3>
        <div className="payment-history__header-actions">
          {canReprint && payments.length > 0 ? (
            <ReprintReceiptButton
              token={token}
              target={{
                sourceType: 'payment',
                sourceId: payments[payments.length - 1].id,
              }}
              label="Print Latest Receipt"
              onError={onReprintError}
            />
          ) : null}
          {canAddPayment && onAddPayment ? (
            <button type="button" className="btn btn--ghost" onClick={onAddPayment}>
              Add Payment
            </button>
          ) : null}
        </div>
      </div>

      {loading ? <LoadingState message="Loading payments…" /> : null}
      {error ? <p className="form-field__error">{error}</p> : null}
      {!loading && !error && payments.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          No installments recorded yet. Use Add Payment — do not edit received
          totals directly.
        </p>
      ) : null}
      {!loading && payments.length > 0 ? (
        <table className="payment-history__table">
          <thead>
            <tr>
              <th>Number</th>
              <th>Date</th>
              <th>Type</th>
              <th>Method</th>
              <th>Amount</th>
              <th>Status</th>
              {canReprint ? <th>Receipt</th> : null}
            </tr>
          </thead>
          <tbody>
            {payments.map((payment) => (
              <tr key={payment.id}>
                <td>{payment.paymentNumber}</td>
                <td>
                  <DateTimeDisplay value={payment.paymentDate} />
                </td>
                <td>{formatLabel(payment.transactionType)}</td>
                <td>{formatLabel(payment.paymentMethod)}</td>
                <td>{formatPkr(payment.amount)}</td>
                <td>{formatLabel(payment.status)}</td>
                {canReprint ? (
                  <td>
                    <ReprintReceiptButton
                      token={token}
                      target={{ sourceType: 'payment', sourceId: payment.id }}
                      onError={onReprintError}
                    />
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  );
}
