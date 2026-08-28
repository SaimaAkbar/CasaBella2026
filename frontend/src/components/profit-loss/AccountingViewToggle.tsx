import type { AccountingView } from '../../types/profit-loss';

type Props = {
  value: AccountingView;
  onChange: (value: AccountingView) => void;
};

export function AccountingViewToggle({ value, onChange }: Props) {
  return (
    <div className="pl-view-toggle" role="group" aria-label="Accounting view">
      <button
        type="button"
        className={`pl-view-toggle__btn${value === 'ACCRUAL' ? ' is-active' : ''}`}
        onClick={() => onChange('ACCRUAL')}
      >
        Accrual
      </button>
      <button
        type="button"
        className={`pl-view-toggle__btn${value === 'CASH' ? ' is-active' : ''}`}
        onClick={() => onChange('CASH')}
      >
        Cash
      </button>
    </div>
  );
}
