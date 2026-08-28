import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import type { DashboardRoomGridItem } from '../../types/dashboard';

type BookingTypeBreakdownProps = {
  units: DashboardRoomGridItem[];
};

export function BookingTypeBreakdown({ units }: BookingTypeBreakdownProps) {
  const monthly = units.filter((u) => u.bookingType === 'MONTHLY').length;
  const daily = units.filter((u) => u.bookingType === 'DAILY').length;
  const hourly = units.filter((u) => u.bookingType === 'HOURLY').length;
  const total = monthly + daily + hourly;

  const data = [
    { name: 'Monthly Tenants', value: monthly, color: '#d4a017' },
    { name: 'Daily Guests', value: daily, color: '#3b82f6' },
    { name: 'Hourly Guests', value: hourly, color: '#8b5cf6' },
  ].filter((d) => d.value > 0);

  const chartData =
    data.length > 0 ? data : [{ name: 'None', value: 1, color: '#e5e7eb' }];

  return (
    <section className="dash-card">
      <header className="dash-card__header">
        <h2>Booking Type Breakdown</h2>
      </header>
      <div className="occupancy-chart">
        <div className="occupancy-chart__chart" aria-hidden="true">
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                innerRadius={48}
                outerRadius={70}
                paddingAngle={2}
                stroke="none"
              >
                {chartData.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="occupancy-chart__center">
            <strong>{total}</strong>
            <span>Active</span>
          </div>
        </div>
        <ul className="occupancy-chart__legend">
          {data.length === 0 ? (
            <li>
              <span className="occupancy-chart__swatch occupancy-chart__swatch--gray" />
              No active bookings/tenancies <strong>0</strong>
            </li>
          ) : (
            data.map((item) => (
              <li key={item.name}>
                <span
                  className="occupancy-chart__swatch"
                  style={{ background: item.color }}
                />
                {item.name}{' '}
                <strong>
                  {item.value}
                  {total > 0
                    ? ` (${Math.round((item.value / total) * 100)}%)`
                    : ''}
                </strong>
              </li>
            ))
          )}
        </ul>
      </div>
    </section>
  );
}
