type StatusItem = {
  key: string;
  label: string;
  count: number;
  tone: 'green' | 'blue' | 'red' | 'orange' | 'gray' | 'white';
};

type RoomStatusOverviewProps = {
  items: StatusItem[];
};

export function RoomStatusOverview({ items }: RoomStatusOverviewProps) {
  return (
    <section className="dash-card">
      <header className="dash-card__header">
        <h2>Room Status Overview</h2>
      </header>
      <div className="room-status-overview">
        {items.map((item) => (
          <div
            key={item.key}
            className={`room-status-overview__item room-status-overview__item--${item.tone}`}
          >
            <strong aria-label={`${item.label}: ${item.count}`}>
              {item.count}
            </strong>
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
