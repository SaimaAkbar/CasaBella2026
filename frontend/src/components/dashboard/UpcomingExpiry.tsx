export type ExpiryItem = {
  id: string;
  title: string;
  description: string;
  dateLabel: string;
};

type UpcomingExpiryProps = {
  items: ExpiryItem[];
  /** Count from notifications API when item list is unavailable. */
  upcomingCount?: number;
};

export function UpcomingExpiry({ items, upcomingCount = 0 }: UpcomingExpiryProps) {
  return (
    <section className="dash-card">
      <header className="dash-card__header">
        <h2>Upcoming Expiry</h2>
      </header>
      {items.length === 0 ? (
        <p className="dash-card__empty">
          {upcomingCount > 0
            ? `${upcomingCount} upcoming expiry alert(s) flagged by notifications. Detailed expiry list API is not available yet.`
            : 'No upcoming expiries to show.'}
        </p>
      ) : (
        <ul className="upcoming-expiry">
          {items.map((item) => (
            <li key={item.id} className="upcoming-expiry__row">
              <div>
                <strong>{item.title}</strong>
                <span>{item.description}</span>
              </div>
              <span className="upcoming-expiry__badge">{item.dateLabel}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
