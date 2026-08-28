import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import type { DashboardSummary } from '../../types/dashboard';

type OccupancyOverviewProps = {
  summary: DashboardSummary | null;
};

export function OccupancyOverview({ summary }: OccupancyOverviewProps) {
  const occupied = summary?.occupied ?? 0;
  const available = summary?.available ?? 0;
  const cleaning = summary?.cleaning ?? 0;
  const monthlyEmpty = summary?.monthlyEmpty ?? 0;
  const maintenance = summary?.maintenance ?? 0;
  const blocked = summary?.blocked ?? 0;
  const total =
    occupied + available + cleaning + monthlyEmpty + maintenance + blocked;

  const percent = total > 0 ? Math.round((occupied / total) * 100) : 0;

  const data = [
    { name: 'Occupied', value: occupied, color: '#3b82f6' },
    { name: 'Available', value: available, color: '#22c55e' },
    { name: 'Cleaning Pending', value: cleaning, color: '#ef4444' },
    { name: 'Monthly Empty', value: monthlyEmpty, color: '#d4a017' },
    { name: 'Maintenance', value: maintenance, color: '#94a3b8' },
    { name: 'Blocked', value: blocked, color: '#111827' },
  ].filter((d) => d.value > 0);

  const chartData =
    data.length > 0 ? data : [{ name: 'Empty', value: 1, color: '#e5e7eb' }];

  return (
    <section className="dash-card">
      <header className="dash-card__header">
        <h2>Occupancy Overview</h2>
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
            <strong>{percent}%</strong>
            <span>Occupied</span>
          </div>
        </div>
        <ul className="occupancy-chart__legend">
          {data.map((item) => (
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
          ))}
        </ul>
      </div>
    </section>
  );
}
