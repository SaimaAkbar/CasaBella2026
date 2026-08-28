import { formatDate, formatLabel, formatPkr } from '../../lib/format';
import type { Expense } from '../../types/expense';
import { FormModal } from '../ui/FormModal';
import { MoneyDisplay } from '../ui/MoneyDisplay';
import { PaymentStatusBadge } from '../ui/PaymentStatusBadge';
import '../../styles/forms.css';

type ExpenseDetailModalProps = {
  open: boolean;
  expense: Expense | null;
  canEdit?: boolean;
  canDelete?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onClose: () => void;
};

export function ExpenseDetailModal({
  open,
  expense,
  canEdit = false,
  canDelete = false,
  onEdit,
  onDelete,
  onClose,
}: ExpenseDetailModalProps) {
  if (!expense) {
    return null;
  }

  return (
    <FormModal open={open} title={expense.expenseNumber} onClose={onClose}>
      <dl className="detail-list">
        <div>
          <dt>Category</dt>
          <dd>{expense.category?.name ?? '—'}</dd>
        </div>
        <div>
          <dt>Scope</dt>
          <dd>{formatLabel(expense.expenseScope)}</dd>
        </div>
        <div>
          <dt>Date</dt>
          <dd>{formatDate(expense.expenseDate)}</dd>
        </div>
        <div>
          <dt>Property</dt>
          <dd>{expense.property?.name ?? '—'}</dd>
        </div>
        <div>
          <dt>Unit</dt>
          <dd>{expense.unit?.unitNumber ?? '—'}</dd>
        </div>
        <div>
          <dt>Booking</dt>
          <dd>
            {expense.booking
              ? `${expense.booking.bookingNumber} (${expense.booking.guest?.fullName ?? 'Guest'})`
              : '—'}
          </dd>
        </div>
        <div>
          <dt>Monthly Tenancy</dt>
          <dd>
            {expense.monthlyTenancy
              ? `${expense.monthlyTenancy.tenant?.fullName ?? 'Tenant'} — ${expense.monthlyTenancy.unit?.unitNumber ?? 'Unit'}`
              : '—'}
          </dd>
        </div>
        <div>
          <dt>Amount</dt>
          <dd>
            <MoneyDisplay value={expense.amount} />
          </dd>
        </div>
        <div>
          <dt>Paid / Remaining</dt>
          <dd>
            {formatPkr(expense.paidAmount)} / {formatPkr(expense.remainingAmount)}
          </dd>
        </div>
        <div>
          <dt>Payment Status</dt>
          <dd>
            <PaymentStatusBadge state={expense.paymentStatus} />
          </dd>
        </div>
        <div>
          <dt>Vendor</dt>
          <dd>{expense.vendorName ?? '—'}</dd>
        </div>
        <div>
          <dt>Method</dt>
          <dd>
            {expense.paymentMethod
              ? formatLabel(expense.paymentMethod)
              : '—'}
          </dd>
        </div>
        <div>
          <dt>Reference</dt>
          <dd>{expense.referenceNumber ?? '—'}</dd>
        </div>
        <div>
          <dt>Description</dt>
          <dd>{expense.description ?? '—'}</dd>
        </div>
        <div>
          <dt>Receipt</dt>
          <dd>
            {expense.receiptUrl ? (
              <a href={expense.receiptUrl} target="_blank" rel="noreferrer">
                Open receipt
              </a>
            ) : (
              '—'
            )}
          </dd>
        </div>
        <div>
          <dt>Finalized</dt>
          <dd>{expense.isFinalized ? 'Yes' : 'No'}</dd>
        </div>
        <div>
          <dt>Created By</dt>
          <dd>{expense.createdBy?.fullName ?? '—'}</dd>
        </div>
        <div>
          <dt>Approver</dt>
          <dd>{expense.approvedBy?.fullName ?? '—'}</dd>
        </div>
        <div>
          <dt>Created / Updated</dt>
          <dd>
            {formatDate(expense.createdAt)} / {formatDate(expense.updatedAt)}
          </dd>
        </div>

        {expense.electricityReading && (
          <>
            <div>
              <dt>Previous / Current Units</dt>
              <dd>
                {expense.electricityReading.previousUnits} →{' '}
                {expense.electricityReading.currentUnits}
              </dd>
            </div>
            <div>
              <dt>Consumed Units</dt>
              <dd>{expense.electricityReading.consumedUnits}</dd>
            </div>
            <div>
              <dt>Rate Per Unit</dt>
              <dd>{formatPkr(expense.electricityReading.ratePerUnit)}</dd>
            </div>
            <div>
              <dt>Billing Period</dt>
              <dd>
                {expense.electricityReading.billingMonth}/
                {expense.electricityReading.billingYear}
              </dd>
            </div>
          </>
        )}

        {expense.metadata && (
          <>
            {(expense.metadata.billingMonth || expense.metadata.billingYear) && (
              <div>
                <dt>Covered Period</dt>
                <dd>
                  {expense.metadata.billingMonth ?? '—'}/
                  {expense.metadata.billingYear ?? '—'}
                </dd>
              </div>
            )}
            {expense.metadata.payeeName && (
              <div>
                <dt>Payee</dt>
                <dd>{expense.metadata.payeeName}</dd>
              </div>
            )}
            {expense.metadata.notes && (
              <div>
                <dt>Notes</dt>
                <dd>{expense.metadata.notes}</dd>
              </div>
            )}
          </>
        )}
      </dl>
      {canEdit || canDelete ? (
        <div className="form-actions" style={{ flexWrap: 'wrap' }}>
          {canEdit && onEdit ? (
            <button type="button" className="btn btn--primary" onClick={onEdit}>
              Edit
            </button>
          ) : null}
          {canDelete && onDelete ? (
            <button type="button" className="btn btn--ghost" onClick={onDelete}>
              Delete
            </button>
          ) : null}
        </div>
      ) : null}
    </FormModal>
  );
}
