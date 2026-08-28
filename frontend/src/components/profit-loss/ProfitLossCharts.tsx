import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatPkr } from '../../lib/format';
import type {
  NamedAmount,
  ProfitLossByPropertyRow,
  ProfitLossTrendRow,
} from '../../types/profit-loss';

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const PIE_COLORS = [
  '#d4af37',
  '#22c55e',
  '#3b82f6',
  '#f97316',
  '#ef4444',
  '#a78bfa',
  '#14b8a6',
  '#f472b6',
  '#94a3b8',
];

type Props = {
  trend: ProfitLossTrendRow[];
  incomeSources: NamedAmount[];
  expenseCategories: NamedAmount[];
  byProperty: ProfitLossByPropertyRow[];
};

export function ProfitLossCharts({
  trend,
  incomeSources,
  expenseCategories,
  byProperty,
}: Props) {
  const trendData = trend.map((row) => ({
    name: MONTHS[row.month - 1] ?? String(row.month),
    income: Number(row.income),
    expenses: Number(row.expenses),
    net: Number(row.netAmount),
  }));

  const incomePie = incomeSources.map((row) => ({
    name: row.source ?? 'Other',
    value: Number(row.amount),
  }));

  const expensePie = expenseCategories.map((row) => ({
    name: row.category ?? 'Other',
    value: Number(row.amount),
  }));

  const propertyData = byProperty.map((row) => ({
    name: row.propertyName,
    income: Number(row.income),
    expenses: Number(row.expenses),
    net: Number(row.netAmount),
  }));

  return (
    <div className="pl-charts">
      <article className="pl-chart-card">
        <h3>Monthly Income vs Expenses</h3>
        <div className="pl-chart-card__body">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={trendData}>
              <CartesianGrid stroke="rgba(212,175,55,0.12)" />
              <XAxis dataKey="name" stroke="#9ca3af" />
              <YAxis stroke="#9ca3af" />
              <Tooltip formatter={(value) => formatPkr(Number(value ?? 0))} />
              <Legend />
              <Bar dataKey="income" fill="#22c55e" name="Income" />
              <Bar dataKey="expenses" fill="#ef4444" name="Expenses" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </article>

      <article className="pl-chart-card">
        <h3>Monthly Net Profit / Loss</h3>
        <div className="pl-chart-card__body">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={trendData}>
              <CartesianGrid stroke="rgba(212,175,55,0.12)" />
              <XAxis dataKey="name" stroke="#9ca3af" />
              <YAxis stroke="#9ca3af" />
              <Tooltip formatter={(value) => formatPkr(Number(value ?? 0))} />
              <Legend />
              <Line
                type="monotone"
                dataKey="net"
                stroke="#d4af37"
                strokeWidth={2}
                name="Net"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </article>

      <article className="pl-chart-card">
        <h3>Income Breakdown</h3>
        <div className="pl-chart-card__body">
          {incomePie.length === 0 ? (
            <p className="pl-chart-card__empty">No income in this period.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={incomePie}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={90}
                  label
                >
                  {incomePie.map((_, index) => (
                    <Cell
                      key={index}
                      fill={PIE_COLORS[index % PIE_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatPkr(Number(value ?? 0))} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </article>

      <article className="pl-chart-card">
        <h3>Expense Breakdown</h3>
        <div className="pl-chart-card__body">
          {expensePie.length === 0 ? (
            <p className="pl-chart-card__empty">No expenses in this period.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={expensePie}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={90}
                  label
                >
                  {expensePie.map((_, index) => (
                    <Cell
                      key={index}
                      fill={PIE_COLORS[index % PIE_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatPkr(Number(value ?? 0))} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </article>

      <article className="pl-chart-card pl-chart-card--wide">
        <h3>Property-wise Performance</h3>
        <div className="pl-chart-card__body">
          {propertyData.length === 0 ? (
            <p className="pl-chart-card__empty">No properties found.</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={propertyData}>
                <CartesianGrid stroke="rgba(212,175,55,0.12)" />
                <XAxis dataKey="name" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <Tooltip formatter={(value) => formatPkr(Number(value ?? 0))} />
                <Legend />
                <Bar dataKey="income" fill="#22c55e" name="Income" />
                <Bar dataKey="expenses" fill="#ef4444" name="Expenses" />
                <Bar dataKey="net" fill="#d4af37" name="Net" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </article>
    </div>
  );
}
