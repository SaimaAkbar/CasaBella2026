type Period = 'today' | 'month' | 'year' | 'custom' | 'all';

type PeriodSelectorProps = {
  value: Period;
  onChange: (value: Period) => void;
  onRefresh: () => void;
  isLoading?: boolean;
};

const OPTIONS: Array<{ value: Period; label: string }> = [
  { value: 'today', label: 'Today' },
  { value: 'month', label: 'This Month' },
  { value: 'year', label: 'This Year' },
  { value: 'custom', label: 'Custom' },
];

export function PeriodSelector({
  value,
  onChange,
  onRefresh,
  isLoading,
}: PeriodSelectorProps) {
  return (
    <div className="period-selector">
      <label className="period-selector__select">
        <span className="visually-hidden">Period</span>
        <select
          value={value === 'all' ? 'today' : value}
          onChange={(e) => onChange(e.target.value as Period)}
          aria-label="Dashboard period"
        >
          {OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        className="period-selector__refresh"
        onClick={onRefresh}
        disabled={isLoading}
        aria-label="Refresh dashboard"
      >
        Refresh
      </button>
    </div>
  );
}
