type SummaryRow = {
  key: string;
  label: string;
  count: number;
  tone: 'blue' | 'amber' | 'green' | 'purple' | 'red' | 'gold';
};

type TodaySummaryProps = {
  rows: SummaryRow[];
};

export function TodaySummary({ rows }: TodaySummaryProps) {
  return (
    <section className="dash-card">
      <header className="dash-card__header">
        <h2>Today&apos;s Activity</h2>
      </header>
      <ul className="today-summary">
        {rows.map((row) => (
          <li key={row.key} className="today-summary__row">
            <span
              className={`today-summary__icon today-summary__icon--${row.tone}`}
              aria-hidden="true"
            />
            <span className="today-summary__label">{row.label}</span>
            <strong>{row.count}</strong>
          </li>
        ))}
      </ul>
    </section>
  );
}
