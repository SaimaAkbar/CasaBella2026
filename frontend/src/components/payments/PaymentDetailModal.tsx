import { formatLabel, formatPkr } from '../../lib/format';
import type { Payment } from '../../types/payment';
import { DateTimeDisplay } from '../ui/DateTimeDisplay';
import { FormModal } from '../ui/FormModal';
import { MoneyDisplay } from '../ui/MoneyDisplay';
import '../../styles/forms.css';

type PaymentDetailModalProps = {
  open: boolean;
  payment: Payment | null;
  canRefund: boolean;
  canReverse: boolean;
  busy: boolean;
  onClose: () => void;
  onRefund: () => void;
  onReverse: () => void;
  onPrint: () => void;
};

export function PaymentDetailModal({
  open,
  payment,
  canRefund,
  canReverse,
  busy,
  onClose,
  onRefund,
  onReverse,
  onPrint,
}: PaymentDetailModalProps) {
  if (!payment) return null;

  const payer =
    payment.booking?.guest?.fullName ??
    payment.monthlyTenancy?.tenant?.fullName ??
    '—';
  const property =
    payment.booking?.unit?.property?.name ??
    payment.monthlyTenancy?.unit?.property?.name ??
    '—';
  const unit =
    payment.booking?.unit?.unitNumber ??
    payment.monthlyTenancy?.unit?.unitNumber ??
    '—';

  return (
    <FormModal open={open} title="Payment Details" onClose={onClose}>
      <dl className="detail-list">
        <div>
          <dt>Payment Number</dt>
          <dd>{payment.paymentNumber}</dd>
        </div>
        <div>
          <dt>Source</dt>
          <dd>{formatLabel(payment.paymentForType)}</dd>
        </div>
        <div>
          <dt>Payer</dt>
          <dd>{payer}</dd>
        </div>
        <div>
          <dt>Property / Unit</dt>
          <dd>
            {property} / {unit}
          </dd>
        </div>
        <div>
          <dt>Amount</dt>
          <dd>
            <MoneyDisplay value={payment.amount} />
          </dd>
        </div>
        <div>
          <dt>Method</dt>
          <dd>{formatLabel(payment.paymentMethod)}</dd>
        </div>
        <div>
          <dt>Reference</dt>
          <dd>{payment.transactionReference || '—'}</dd>
        </div>
        <div>
          <dt>Transaction Type</dt>
          <dd>{formatLabel(payment.transactionType)}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{formatLabel(payment.status)}</dd>
        </div>
        <div>
          <dt>Date</dt>
          <dd>
            <DateTimeDisplay value={payment.paymentDate} />
          </dd>
        </div>
        <div>
          <dt>Creator</dt>
          <dd>{payment.createdBy?.fullName ?? '—'}</dd>
        </div>
        <div>
          <dt>Approver</dt>
          <dd>{payment.approvedBy?.fullName ?? '—'}</dd>
        </div>
        <div>
          <dt>Original Payment</dt>
          <dd>{payment.originalPayment?.paymentNumber ?? '—'}</dd>
        </div>
        <div>
          <dt>Notes</dt>
          <dd>{payment.notes || '—'}</dd>
        </div>
        {payment.receipt ? (
          <>
            <div>
              <dt>Total Payable</dt>
              <dd>{formatPkr(payment.receipt.totalPayable)}</dd>
            </div>
            <div>
              <dt>Total Received</dt>
              <dd>{formatPkr(payment.receipt.totalReceived)}</dd>
            </div>
            <div>
              <dt>Remaining Balance</dt>
              <dd>{formatPkr(payment.receipt.remainingBalance)}</dd>
            </div>
          </>
        ) : null}
      </dl>

      <div className="form-actions" style={{ flexWrap: 'wrap' }}>
        <button type="button" className="btn btn--primary" onClick={onPrint}>
          Print Receipt
        </button>
        {canRefund &&
        payment.transactionType === 'PAYMENT' &&
        payment.status === 'COMPLETED' ? (
          <button
            type="button"
            className="btn btn--ghost"
            disabled={busy}
            onClick={onRefund}
          >
            Refund
          </button>
        ) : null}
        {canReverse &&
        payment.transactionType === 'PAYMENT' &&
        payment.status === 'COMPLETED' ? (
          <button
            type="button"
            className="btn btn--ghost"
            disabled={busy}
            onClick={onReverse}
          >
            Reverse
          </button>
        ) : null}
        <button type="button" className="btn btn--ghost" onClick={onClose}>
          Close
        </button>
      </div>
    </FormModal>
  );
}
