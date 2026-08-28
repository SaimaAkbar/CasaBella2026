import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchProperties } from '../api/properties';
import {
  fetchExpenseBreakdown,
  fetchExpenseCategories,
  fetchIncomeBreakdown,
  fetchIncomeSources,
  fetchProfitLossByProperty,
  fetchProfitLossByUnit,
  fetchProfitLossSummary,
  fetchProfitLossTrend,
} from '../api/profit-loss';
import { fetchUnits } from '../api/units';
import { SummaryCard } from '../components/dashboard/SummaryCard';
import { PageHeader } from '../components/PageHeader';
import { AccountingViewToggle } from '../components/profit-loss/AccountingViewToggle';
import { DrillDownModal } from '../components/profit-loss/DrillDownModal';
import { ProfitLossBadge } from '../components/profit-loss/ProfitLossBadge';
import { ProfitLossCharts } from '../components/profit-loss/ProfitLossCharts';
import { DataTable, type DataTableColumn } from '../components/ui/DataTable';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { FilterBar } from '../components/ui/FilterBar';
import { LoadingState } from '../components/ui/LoadingState';
import { Toast } from '../components/ui/Toast';
import { useAuth } from '../context/AuthContext';
import { useApiErrorHandler } from '../hooks/useApiErrorHandler';
import { formatPkr } from '../lib/format';
import type {
  AccountingView,
  ExpenseBreakdownRow,
  IncomeBreakdownRow,
  NamedAmount,
  ProfitLossByPropertyRow,
  ProfitLossByUnitRow,
  ProfitLossQuery,
  ProfitLossSummary,
  ProfitLossTrendRow,
} from '../types/profit-loss';
import type { Property } from '../types/property';
import type { Unit } from '../types/unit';
import '../styles/forms.css';
import './ProfitLossPage.css';

const now = new Date();
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function todayIso() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function ProfitLossPage() {
  const { token, user } = useAuth();
  const handleApiError = useApiErrorHandler();

  const canAccess =
    user?.role === 'SUPER_ADMIN' ||
    (user?.role === 'ADMIN' && Boolean(user.canAccessProfitLoss));

  const [accountingView, setAccountingView] =
    useState<AccountingView>('ACCRUAL');
  const [mode, setMode] = useState<
    'today' | 'date' | 'month' | 'year' | 'range'
  >('month');
  const [date, setDate] = useState(todayIso());
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [propertyId, setPropertyId] = useState('');
  const [unitId, setUnitId] = useState('');
  const [applied, setApplied] = useState<ProfitLossQuery>({
    month: now.getMonth() + 1,
    year: now.getFullYear(),
    accountingView: 'ACCRUAL',
  });

  const [properties, setProperties] = useState<Property[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [summary, setSummary] = useState<ProfitLossSummary | null>(null);
  const [trend, setTrend] = useState<ProfitLossTrendRow[]>([]);
  const [byProperty, setByProperty] = useState<ProfitLossByPropertyRow[]>([]);
  const [byUnit, setByUnit] = useState<ProfitLossByUnitRow[]>([]);
  const [incomeSources, setIncomeSources] = useState<NamedAmount[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<NamedAmount[]>(
    [],
  );

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<{
    message: string;
    tone: 'success' | 'error';
  }>({ message: '', tone: 'success' });

  const [drillMode, setDrillMode] = useState<'income' | 'expense' | null>(null);
  const [drillLoading, setDrillLoading] = useState(false);
  const [incomeRows, setIncomeRows] = useState<IncomeBreakdownRow[]>([]);
  const [expenseRows, setExpenseRows] = useState<ExpenseBreakdownRow[]>([]);

  const filteredUnits = useMemo(
    () =>
      propertyId ? units.filter((u) => u.propertyId === propertyId) : units,
    [units, propertyId],
  );

  useEffect(() => {
    if (!token || !canAccess) return;
    void Promise.all([fetchProperties(token), fetchUnits(token)])
      .then(([props, unitRows]) => {
        setProperties(props);
        setUnits(unitRows);
      })
      .catch(() => undefined);
  }, [token, canAccess]);

  const buildQuery = useCallback((): ProfitLossQuery => {
    const base: ProfitLossQuery = {
      accountingView,
      propertyId: propertyId || undefined,
      unitId: unitId || undefined,
    };
    if (mode === 'today') return { ...base, date: todayIso() };
    if (mode === 'date') return { ...base, date };
    if (mode === 'year') return { ...base, year: Number(year) };
    if (mode === 'range')
      return { ...base, startDate, endDate };
    return { ...base, month: Number(month), year: Number(year) };
  }, [
    accountingView,
    propertyId,
    unitId,
    mode,
    date,
    month,
    year,
    startDate,
    endDate,
  ]);

  const load = useCallback(
    async (query: ProfitLossQuery) => {
      if (!token || !canAccess) return;
      setIsLoading(true);
      setError('');
      try {
        const trendYear =
          query.year ||
          (query.startDate
            ? Number(query.startDate.slice(0, 4))
            : now.getFullYear());

        const [
          summaryData,
          trendData,
          propertyData,
          incomeSourceData,
          expenseCategoryData,
        ] = await Promise.all([
          fetchProfitLossSummary(token, query),
          fetchProfitLossTrend(token, {
            year: trendYear,
            propertyId: query.propertyId,
            unitId: query.unitId,
            accountingView: query.accountingView,
          }),
          fetchProfitLossByProperty(token, query),
          fetchIncomeSources(token, query),
          fetchExpenseCategories(token, query),
        ]);

        setSummary(summaryData);
        setTrend(trendData);
        setByProperty(propertyData);
        setIncomeSources(incomeSourceData);
        setExpenseCategories(expenseCategoryData);

        if (query.propertyId) {
          const unitData = await fetchProfitLossByUnit(token, {
            ...query,
            propertyId: query.propertyId,
          });
          setByUnit(unitData);
        } else {
          setByUnit([]);
        }
      } catch (err) {
        setError(handleApiError(err, 'Unable to load Profit & Loss'));
      } finally {
        setIsLoading(false);
      }
    },
    [token, canAccess, handleApiError],
  );

  useEffect(() => {
    if (!canAccess) return;
    void load(applied);
  }, [canAccess, applied, load]);

  function applyFilters() {
    const query = buildQuery();
    if (mode === 'range' && (!startDate || !endDate)) {
      setToast({
        message: 'Start and end dates are required for a custom range.',
        tone: 'error',
      });
      return;
    }
    setApplied(query);
  }

  function resetFilters() {
    setAccountingView('ACCRUAL');
    setMode('month');
    setDate(todayIso());
    setMonth(String(now.getMonth() + 1));
    setYear(String(now.getFullYear()));
    setStartDate('');
    setEndDate('');
    setPropertyId('');
    setUnitId('');
    setApplied({
      month: now.getMonth() + 1,
      year: now.getFullYear(),
      accountingView: 'ACCRUAL',
    });
  }

  async function openDrill(kind: 'income' | 'expense') {
    if (!token) return;
    setDrillMode(kind);
    setDrillLoading(true);
    try {
      if (kind === 'income') {
        setIncomeRows(await fetchIncomeBreakdown(token, applied));
      } else {
        setExpenseRows(await fetchExpenseBreakdown(token, applied));
      }
    } catch (err) {
      setToast({
        message: handleApiError(err, 'Unable to load drill-down'),
        tone: 'error',
      });
      setDrillMode(null);
    } finally {
      setDrillLoading(false);
    }
  }

  const trendColumns: DataTableColumn<ProfitLossTrendRow>[] = [
    {
      key: 'period',
      header: 'Period',
      render: (row) => MONTH_NAMES[row.month - 1] ?? String(row.month),
    },
    {
      key: 'income',
      header: 'Income',
      render: (row) => formatPkr(row.income),
    },
    {
      key: 'expenses',
      header: 'Expenses',
      render: (row) => formatPkr(row.expenses),
    },
    {
      key: 'net',
      header: 'Profit / Loss',
      render: (row) => formatPkr(row.netAmount),
    },
    {
      key: 'result',
      header: 'Result',
      render: (row) => <ProfitLossBadge resultType={row.resultType} />,
    },
  ];

  const propertyColumns: DataTableColumn<ProfitLossByPropertyRow>[] = [
    {
      key: 'property',
      header: 'Property',
      render: (row) => row.propertyName,
    },
    { key: 'units', header: 'Units', render: (row) => row.unitCount },
    {
      key: 'income',
      header: 'Income',
      render: (row) => formatPkr(row.income),
    },
    {
      key: 'expenses',
      header: 'Expenses',
      render: (row) => formatPkr(row.expenses),
    },
    {
      key: 'net',
      header: 'Net',
      render: (row) => formatPkr(row.netAmount),
    },
    {
      key: 'result',
      header: 'Result',
      render: (row) => <ProfitLossBadge resultType={row.resultType} />,
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => {
            setPropertyId(row.propertyId);
            setUnitId('');
            setApplied((prev) => ({
              ...prev,
              propertyId: row.propertyId,
              unitId: undefined,
            }));
          }}
        >
          View Units
        </button>
      ),
    },
  ];

  const unitColumns: DataTableColumn<ProfitLossByUnitRow>[] = [
    {
      key: 'property',
      header: 'Property',
      render: (row) => row.propertyName,
    },
    { key: 'unit', header: 'Unit', render: (row) => row.unitNumber },
    { key: 'type', header: 'Type', render: (row) => row.unitType },
    {
      key: 'income',
      header: 'Income',
      render: (row) => formatPkr(row.income),
    },
    {
      key: 'expenses',
      header: 'Expenses',
      render: (row) => formatPkr(row.expenses),
    },
    {
      key: 'net',
      header: 'Net',
      render: (row) => formatPkr(row.netAmount),
    },
    {
      key: 'result',
      header: 'Result',
      render: (row) => <ProfitLossBadge resultType={row.resultType} />,
    },
  ];

  const trendTotals = useMemo(() => {
    const income = trend.reduce((s, r) => s + Number(r.income), 0);
    const expenses = trend.reduce((s, r) => s + Number(r.expenses), 0);
    const net = income - expenses;
    return { income, expenses, net };
  }, [trend]);

  if (!canAccess) {
    return (
      <section className="pl-page">
        <PageHeader
          title="Profit & Loss"
          breadcrumb={['Home', 'Profit & Loss']}
        />
        <div className="pl-denied" role="alert">
          You do not have permission to view Profit & Loss. Super Admin can
          grant access with <strong>canAccessProfitLoss</strong>.
        </div>
      </section>
    );
  }

  const resultTone =
    summary?.result.resultType === 'PROFIT'
      ? 'success'
      : summary?.result.resultType === 'LOSS'
        ? 'danger'
        : 'gold';

  return (
    <section className="pl-page">
      <PageHeader
        title="Profit & Loss"
        breadcrumb={['Home', 'Profit & Loss']}
      />

      <div className="pl-page__toolbar">
        <AccountingViewToggle
          value={accountingView}
          onChange={setAccountingView}
        />
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => {
            setMode('today');
            setApplied({
              date: todayIso(),
              accountingView,
              propertyId: propertyId || undefined,
              unitId: unitId || undefined,
            });
          }}
        >
          Today
        </button>
        <button
          type="button"
          className="btn btn--primary"
          onClick={applyFilters}
        >
          Apply Filters
        </button>
        <button type="button" className="btn btn--ghost" onClick={resetFilters}>
          Reset
        </button>
      </div>

      <FilterBar>
        <label>
          <span>Period Mode</span>
          <select
            value={mode}
            onChange={(e) =>
              setMode(e.target.value as typeof mode)
            }
          >
            <option value="today">Today</option>
            <option value="date">Selected Date</option>
            <option value="month">Month</option>
            <option value="year">Year</option>
            <option value="range">Custom Range</option>
          </select>
        </label>
        {mode === 'date' ? (
          <label>
            <span>Date</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
        ) : null}
        {mode === 'month' ? (
          <>
            <label>
              <span>Month</span>
              <input
                type="number"
                min={1}
                max={12}
                value={month}
                onChange={(e) => setMonth(e.target.value)}
              />
            </label>
            <label>
              <span>Year</span>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
              />
            </label>
          </>
        ) : null}
        {mode === 'year' ? (
          <label>
            <span>Year</span>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(e.target.value)}
            />
          </label>
        ) : null}
        {mode === 'range' ? (
          <>
            <label>
              <span>Start Date</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </label>
            <label>
              <span>End Date</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </label>
          </>
        ) : null}
        <label>
          <span>Property</span>
          <select
            value={propertyId}
            onChange={(e) => {
              setPropertyId(e.target.value);
              setUnitId('');
            }}
          >
            <option value="">All properties</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Unit</span>
          <select
            value={unitId}
            onChange={(e) => setUnitId(e.target.value)}
            disabled={!propertyId}
          >
            <option value="">All units</option>
            {filteredUnits.map((u) => (
              <option key={u.id} value={u.id}>
                {u.unitNumber}
              </option>
            ))}
          </select>
        </label>
      </FilterBar>

      {summary ? (
        <p className="pl-page__meta">
          Period: <strong>{summary.period.label}</strong> · View:{' '}
          <strong>{summary.period.accountingView}</strong> ·{' '}
          {summary.metadata.generalExpensesPolicy}
        </p>
      ) : null}

      {error ? (
        <ErrorState message={error} onRetry={() => void load(applied)} />
      ) : null}
      {isLoading ? <LoadingState message="Calculating Profit & Loss…" /> : null}

      {summary && !isLoading ? (
        <div className="pl-page__summary">
          <SummaryCard
            label="Total Income"
            value={
              <button
                type="button"
                className="pl-clickable"
                onClick={() => void openDrill('income')}
              >
                {formatPkr(summary.income.totalIncome)}
              </button>
            }
            tone="success"
          />
          <SummaryCard
            label="Total Expenses"
            value={
              <button
                type="button"
                className="pl-clickable"
                onClick={() => void openDrill('expense')}
              >
                {formatPkr(summary.expenses.totalExpenses)}
              </button>
            }
            tone="danger"
          />
          <SummaryCard
            label={
              summary.result.resultType === 'LOSS'
                ? 'Net Loss'
                : summary.result.resultType === 'PROFIT'
                  ? 'Net Profit'
                  : 'Break Even'
            }
            value={`${formatPkr(summary.result.netAmount)} · ${summary.result.resultType.replace('_', ' ')}`}
            tone={resultTone}
          />
          <SummaryCard
            label="Booking Income"
            value={formatPkr(summary.income.bookingIncome)}
            tone="info"
          />
          <SummaryCard
            label="Monthly Rent Income"
            value={formatPkr(summary.income.monthlyTenancyIncome)}
            tone="info"
          />
          <SummaryCard
            label="Outstanding Receivables"
            value={formatPkr(summary.receivables.outstandingReceivables)}
            tone="warn"
          />
          <SummaryCard
            label="Paid Expenses"
            value={formatPkr(summary.expenses.paidExpenses)}
            tone="default"
          />
          <SummaryCard
            label="Unpaid Expenses"
            value={formatPkr(summary.expenses.unpaidExpenses)}
            tone="warn"
          />
        </div>
      ) : null}

      {!isLoading && summary ? (
        <>
          <ProfitLossCharts
            trend={trend}
            incomeSources={incomeSources}
            expenseCategories={expenseCategories}
            byProperty={byProperty}
          />

          <div className="pl-page__section">
            <h2>Monthly Trend</h2>
            {trend.length === 0 ? (
              <EmptyState title="No trend data" />
            ) : (
              <>
                <DataTable
                  columns={trendColumns}
                  rows={trend}
                  rowKey={(r) => String(r.month)}
                />
                <p className="pl-page__meta">
                  Total — Income: <strong>{formatPkr(trendTotals.income)}</strong>{' '}
                  · Expenses:{' '}
                  <strong>{formatPkr(trendTotals.expenses)}</strong> · Net:{' '}
                  <strong>{formatPkr(trendTotals.net)}</strong>
                </p>
              </>
            )}
          </div>

          <div className="pl-page__section">
            <h2>Property Performance</h2>
            {byProperty.length === 0 ? (
              <EmptyState title="No property results" />
            ) : (
              <DataTable
                columns={propertyColumns}
                rows={byProperty}
                rowKey={(r) => r.propertyId}
              />
            )}
          </div>

          {propertyId ? (
            <div className="pl-page__section">
              <h2>Unit Performance</h2>
              {byUnit.length === 0 ? (
                <EmptyState title="No unit results" />
              ) : (
                <DataTable
                  columns={unitColumns}
                  rows={byUnit}
                  rowKey={(r) => r.unitId}
                />
              )}
            </div>
          ) : null}
        </>
      ) : null}

      <DrillDownModal
        open={Boolean(drillMode)}
        mode={drillMode}
        loading={drillLoading}
        incomeRows={incomeRows}
        expenseRows={expenseRows}
        onClose={() => setDrillMode(null)}
      />

      <Toast
        message={toast.message}
        tone={toast.tone}
        onClose={() => setToast({ message: '', tone: 'success' })}
      />
    </section>
  );
}
