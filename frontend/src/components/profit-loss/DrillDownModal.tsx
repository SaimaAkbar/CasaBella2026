import { formatDate, formatLabel, formatPkr } from '../../lib/format';
import type {
  ExpenseBreakdownRow,
  IncomeBreakdownRow,
} from '../../types/profit-loss';
import { FormModal } from '../ui/FormModal';
import { LoadingState } from '../ui/LoadingState';
import '../../styles/forms.css';

type Props = {
  open: boolean;
  mode: 'income' | 'expense' | null;
  loading: boolean;
  incomeRows: IncomeBreakdownRow[];
  expenseRows: ExpenseBreakdownRow[];
  onClose: () => void;
};

export function DrillDownModal({
  open,
  mode,
  loading,
  incomeRows,
  expenseRows,
  onClose,
}: Props) {
  return (
    <FormModal
      open={open}
      title={mode === 'expense' ? 'Expense Drill-down' : 'Income Drill-down'}
      onClose={onClose}
    >
      <div className="form-grid">
        {loading ? <LoadingState message="Loading details…" /> : null}
        {!loading && mode === 'income' ? (
          incomeRows.length === 0 ? (
            <p className="form-hint">No income rows for this period.</p>
          ) : (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Payment #</th>
                    <th>Date</th>
                    <th>Source</th>
                    <th>Guest / Tenant</th>
                    <th>Property</th>
                    <th>Unit</th>
                    <th>Signed</th>
                    <th>Type</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {incomeRows.map((row) => (
                    <tr key={row.paymentId}>
                      <td>{row.paymentNumber}</td>
                      <td>{formatDate(row.paymentDate)}</td>
                      <td>{formatLabel(row.source)}</td>
                      <td>{row.guestOrTenant ?? '—'}</td>
                      <td>{row.propertyName ?? '—'}</td>
                      <td>{row.unitNumber ?? '—'}</td>
                      <td>{formatPkr(row.signedAmount)}</td>
                      <td>{formatLabel(row.transactionType)}</td>
                      <td>{formatLabel(row.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : null}
        {!loading && mode === 'expense' ? (
          expenseRows.length === 0 ? (
            <p className="form-hint">No expense rows for this period.</p>
          ) : (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Expense #</th>
                    <th>Date</th>
                    <th>Category</th>
                    <th>Property</th>
                    <th>Unit</th>
                    <th>Vendor</th>
                    <th>Amount</th>
                    <th>Paid</th>
                    <th>Counted</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {expenseRows.map((row) => (
                    <tr key={row.expenseId}>
                      <td>{row.expenseNumber}</td>
                      <td>{formatDate(row.expenseDate)}</td>
                      <td>{row.category}</td>
                      <td>{row.propertyName ?? '—'}</td>
                      <td>{row.unitNumber ?? '—'}</td>
                      <td>{row.vendorName ?? '—'}</td>
                      <td>{formatPkr(row.amount)}</td>
                      <td>{formatPkr(row.paidAmount)}</td>
                      <td>{formatPkr(row.countedAmount)}</td>
                      <td>{formatLabel(row.paymentStatus)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : null}
        <div className="form-actions">
          <button type="button" className="btn btn--primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </FormModal>
  );
}
