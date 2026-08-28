import { MoneyDisplay } from '../ui/MoneyDisplay';
import { ModalOverlay } from '../ui/ModalOverlay';
import { ExpenseStatusTick } from './ExpenseStatusTick';
import type { PropertyMonthViewUnit } from '../../types/expense';
import './UnitExpenseDrawer.css';

type Props = {
  open: boolean;
  propertyName: string;
  periodLabel: string;
  unit: PropertyMonthViewUnit | null;
  canAddExpense: boolean;
  canPay: boolean;
  canElectricity: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  onClose: () => void;
  onAddExpense: () => void;
  onRecordPayment: () => void;
  onElectricityReading: () => void;
  onViewHistory: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
};

const CATEGORY_ROWS: Array<{
  key: keyof PropertyMonthViewUnit['expenses'];
  label: string;
}> = [
  { key: 'electricity', label: 'Electricity' },
  { key: 'maintenance', label: 'Maintenance' },
  { key: 'society', label: 'Society' },
  { key: 'water', label: 'Water' },
  { key: 'internet', label: 'Internet' },
  { key: 'cleaning', label: 'Cleaning' },
  { key: 'liftBill', label: 'Lift Bill' },
  { key: 'liftMaintenance', label: 'Lift Maintenance' },
  { key: 'other', label: 'Other' },
];

export function UnitExpenseDrawer({
  open,
  propertyName,
  periodLabel,
  unit,
  canAddExpense,
  canPay,
  canElectricity,
  canEdit = false,
  canDelete = false,
  onClose,
  onAddExpense,
  onRecordPayment,
  onElectricityReading,
  onViewHistory,
  onEdit,
  onDelete,
}: Props) {
  if (!open || !unit) return null;

  return (
    <ModalOverlay
      open={open}
      onClose={onClose}
      className="unit-expense-drawer-overlay"
    >
      <aside
        className="unit-expense-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="unit-expense-drawer-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="unit-expense-drawer__header">
          <div>
            <h2 id="unit-expense-drawer-title">
              {propertyName} — {unit.unitType === 'ROOM' ? 'Room' : 'Apartment'}{' '}
              {unit.unitNumber}
            </h2>
            <p>{periodLabel}</p>
          </div>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </header>

        <div className="unit-expense-drawer__body">
          <ul className="unit-expense-drawer__cats">
            {CATEGORY_ROWS.map((row) => {
              const amount = unit.expenses[row.key];
              const isElectricity = row.key === 'electricity';
              const showReadingRequired =
                isElectricity &&
                unit.electricityReadingRequired &&
                Number(amount) === 0;
              return (
                <li key={row.key}>
                  <span>{row.label}</span>
                  {showReadingRequired ? (
                    <em className="unit-expense-drawer__muted">
                      Reading Required
                    </em>
                  ) : (
                    <MoneyDisplay value={amount} />
                  )}
                </li>
              );
            })}
          </ul>

          <div className="unit-expense-drawer__totals">
            <div>
              <span>Total</span>
              <strong>
                <MoneyDisplay value={unit.totalExpense} />
              </strong>
            </div>
            <div>
              <span>Paid</span>
              <strong>
                <MoneyDisplay value={unit.paid} />
              </strong>
            </div>
            <div>
              <span>Remaining</span>
              <strong>
                <MoneyDisplay value={unit.remaining} />
              </strong>
            </div>
            <div>
              <span>Status</span>
              <ExpenseStatusTick status={unit.status} />
            </div>
          </div>

          <div className="unit-expense-drawer__actions">
            {canAddExpense ? (
              <button
                type="button"
                className="btn btn--primary"
                onClick={onAddExpense}
              >
                Add Expense
              </button>
            ) : null}
            {canPay && Number(unit.remaining) > 0 ? (
              <button
                type="button"
                className="btn btn--ghost"
                onClick={onRecordPayment}
              >
                Record Payment
              </button>
            ) : null}
            {canElectricity ? (
              <button
                type="button"
                className="btn btn--ghost"
                onClick={onElectricityReading}
              >
                Electricity Reading
              </button>
            ) : null}
            <button
              type="button"
              className="btn btn--ghost"
              onClick={onViewHistory}
            >
              View History
            </button>
            {canEdit && onEdit ? (
              <button
                type="button"
                className="btn btn--ghost"
                onClick={onEdit}
              >
                Edit
              </button>
            ) : null}
            {canDelete && onDelete ? (
              <button
                type="button"
                className="btn btn--ghost"
                onClick={onDelete}
              >
                Delete
              </button>
            ) : null}
          </div>
        </div>
      </aside>
    </ModalOverlay>
  );
}
