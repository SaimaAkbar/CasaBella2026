import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { exportReport, fetchReport } from '../../api/reports';
import { fetchProperties } from '../../api/properties';
import { fetchUnits } from '../../api/units';
import { SummaryCard } from '../dashboard/SummaryCard';
import { DataTable, type DataTableColumn } from '../ui/DataTable';
import { DateTimeDisplay } from '../ui/DateTimeDisplay';
import { EmptyState } from '../ui/EmptyState';
import { ErrorState } from '../ui/ErrorState';
import { FilterBar } from '../ui/FilterBar';
import { LoadingState } from '../ui/LoadingState';
import { MoneyDisplay } from '../ui/MoneyDisplay';
import { useApiErrorHandler } from '../../hooks/useApiErrorHandler';
import { formatDate, formatLabel, formatPkr } from '../../lib/format';
import type { Property } from '../../types/property';
import type {
  ExportFormat,
  ReportPayload,
  ReportQuery,
  ReportType,
} from '../../types/report';
import type { Unit } from '../../types/unit';
import '../../styles/forms.css';
import './ReportViewer.css';

type ReportViewerProps = {
  token: string;
  reportType: ReportType;
  reportName: string;
  onBack: () => void;
  onToast: (message: string, tone: 'success' | 'error') => void;
};

const now = new Date();
const PAGE_SIZE = 25;

const MONEY_KEY =
  /amount|balance|income|expense|salary|cost|price|total|net|payable|received|paid|remaining|refund|adjustment|valuation|deposit|rent|advance|bonus|deduction|rate/i;

const DATE_KEY = /date|checkIn|checkOut|start|end|joining|reading/i;

function todayIso() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function summaryLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .replace(/Percentage/i, '%')
    .trim();
}

function formatSummaryValue(
  key: string,
  value: string | number | null,
): string {
  if (value === null || value === undefined || value === '') {
    return '—';
  }

  if (MONEY_KEY.test(key) && typeof value !== 'boolean') {
    return formatPkr(value);
  }

  if (typeof value === 'number') {
    return String(value);
  }

  if (typeof value === 'string' && DATE_KEY.test(key)) {
    return formatDate(value);
  }

  return formatLabel(String(value));
}

function formatCellValue(key: string, value: unknown): ReactNode {
  if (value === null || value === undefined || value === '') {
    return '—';
  }

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  if (MONEY_KEY.test(key) && (typeof value === 'number' || typeof value === 'string')) {
    const numeric = typeof value === 'number' ? value : Number(value);
    if (!Number.isNaN(numeric)) {
      return <MoneyDisplay value={value as string | number} />;
    }
  }

  if (
    typeof value === 'string' &&
    (DATE_KEY.test(key) || /^\d{4}-\d{2}-\d{2}/.test(value))
  ) {
    if (value.includes('T')) {
      return <DateTimeDisplay value={value} />;
    }
    return formatDate(value);
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return formatLabel(String(value));
}

function formatCellPlain(key: string, value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '—';
  }

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  if (MONEY_KEY.test(key) && (typeof value === 'number' || typeof value === 'string')) {
    return formatPkr(value as string | number);
  }

  if (
    typeof value === 'string' &&
    (DATE_KEY.test(key) || /^\d{4}-\d{2}-\d{2}/.test(value))
  ) {
    return value.includes('T')
      ? new Date(value).toLocaleString()
      : formatDate(value);
  }

  return String(value);
}

function printReport(report: ReportPayload) {
  const win = window.open('', '_blank', 'noopener,noreferrer');
  if (!win) {
    return false;
  }

  const headers = report.columns.map((c) => `<th>${c.header}</th>`).join('');
  const body = report.rows
    .map(
      (row) =>
        `<tr>${report.columns
          .map(
            (col) =>
              `<td>${formatCellPlain(col.key, row[col.key])}</td>`,
          )
          .join('')}</tr>`,
    )
    .join('');

  win.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>${report.reportName}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
    h1 { font-size: 1.25rem; margin: 0 0 0.5rem; }
    p { margin: 0 0 1rem; color: #444; font-size: 0.9rem; }
    table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
    th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
    th { background: #f3f3f3; }
  </style>
</head>
<body>
  <h1>${report.reportName}</h1>
  <p>Generated ${new Date(report.generatedAt).toLocaleString()} by ${report.generatedBy.fullName}</p>
  <table>
    <thead><tr>${headers}</tr></thead>
    <tbody>${body}</tbody>
  </table>
</body>
</html>`);
  win.document.close();
  win.focus();
  win.print();
  return true;
}

export function ReportViewer({
  token,
  reportType,
  reportName,
  onBack,
  onToast,
}: ReportViewerProps) {
  const handleApiError = useApiErrorHandler();

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
  const [page, setPage] = useState(1);

  const [properties, setProperties] = useState<Property[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [applied, setApplied] = useState<ReportQuery>({
    month: now.getMonth() + 1,
    year: now.getFullYear(),
    page: 1,
    limit: PAGE_SIZE,
  });

  const [report, setReport] = useState<ReportPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [exportBusy, setExportBusy] = useState<ExportFormat | 'print' | null>(
    null,
  );

  const filteredUnits = useMemo(
    () =>
      propertyId ? units.filter((u) => u.propertyId === propertyId) : units,
    [units, propertyId],
  );

  useEffect(() => {
    void Promise.all([fetchProperties(token), fetchUnits(token)])
      .then(([props, unitRows]) => {
        setProperties(props);
        setUnits(unitRows);
      })
      .catch(() => undefined);
  }, [token]);

  const buildQuery = useCallback(
    (pageNum = page): ReportQuery => {
      const base: ReportQuery = {
        propertyId: propertyId || undefined,
        unitId: unitId || undefined,
        page: pageNum,
        limit: PAGE_SIZE,
      };

      if (mode === 'today') return { ...base, date: todayIso() };
      if (mode === 'date') return { ...base, date };
      if (mode === 'year') return { ...base, year: Number(year) };
      if (mode === 'range') return { ...base, startDate, endDate };
      return { ...base, month: Number(month), year: Number(year) };
    },
    [propertyId, unitId, page, mode, date, year, startDate, endDate, month],
  );

  const load = useCallback(
    async (query: ReportQuery) => {
      setIsLoading(true);
      setError('');
      try {
        const data = await fetchReport(token, reportType, query);
        setReport(data);
      } catch (err) {
        setError(handleApiError(err, 'Unable to load report'));
        setReport(null);
      } finally {
        setIsLoading(false);
      }
    },
    [token, reportType, handleApiError],
  );

  useEffect(() => {
    void load(applied);
  }, [applied, load]);

  function applyFilters() {
    if (mode === 'range' && (!startDate || !endDate)) {
      onToast('Start and end dates are required for a custom range.', 'error');
      return;
    }
    setPage(1);
    setApplied(buildQuery(1));
  }

  function resetFilters() {
    setMode('month');
    setDate(todayIso());
    setMonth(String(now.getMonth() + 1));
    setYear(String(now.getFullYear()));
    setStartDate('');
    setEndDate('');
    setPropertyId('');
    setUnitId('');
    setPage(1);
    setApplied({
      month: now.getMonth() + 1,
      year: now.getFullYear(),
      page: 1,
      limit: PAGE_SIZE,
    });
  }

  function goToPage(nextPage: number) {
    setPage(nextPage);
    setApplied(buildQuery(nextPage));
  }

  async function handleExport(format: ExportFormat) {
    setExportBusy(format);
    try {
      await exportReport(token, reportType, { ...applied, format });
      onToast(`${reportName} exported as ${format.toUpperCase()}.`, 'success');
    } catch (err) {
      onToast(handleApiError(err, 'Unable to export report'), 'error');
    } finally {
      setExportBusy(null);
    }
  }

  function handlePrint() {
    if (!report || report.rows.length === 0) {
      onToast('No rows to print on this page.', 'error');
      return;
    }
    setExportBusy('print');
    const ok = printReport(report);
    if (!ok) {
      onToast('Pop-up blocked. Allow pop-ups to print this report.', 'error');
    }
    setExportBusy(null);
  }

  const tableColumns: DataTableColumn<Record<string, unknown>>[] = useMemo(
    () =>
      (report?.columns ?? []).map((col) => ({
        key: col.key,
        header: col.header,
        render: (row) => formatCellValue(col.key, row[col.key]),
      })),
    [report?.columns],
  );

  const totalPages = report
    ? Math.max(1, Math.ceil(report.pagination.total / report.pagination.limit))
    : 1;

  return (
    <div className="report-viewer">
      <div className="report-viewer__header">
        <div>
          <button type="button" className="btn btn--ghost" onClick={onBack}>
            ← Back to Reports
          </button>
          <h2 className="report-viewer__title">{reportName}</h2>
        </div>
        <div className="report-viewer__actions">
          <button
            type="button"
            className="btn btn--ghost"
            disabled={Boolean(exportBusy) || isLoading}
            onClick={handlePrint}
          >
            {exportBusy === 'print' ? 'Printing…' : 'Print'}
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            disabled={Boolean(exportBusy) || isLoading}
            onClick={() => void handleExport('pdf')}
          >
            {exportBusy === 'pdf' ? 'Exporting…' : 'PDF'}
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            disabled={Boolean(exportBusy) || isLoading}
            onClick={() => void handleExport('xlsx')}
          >
            {exportBusy === 'xlsx' ? 'Exporting…' : 'Excel'}
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            disabled={Boolean(exportBusy) || isLoading}
            onClick={() => void handleExport('csv')}
          >
            {exportBusy === 'csv' ? 'Exporting…' : 'CSV'}
          </button>
        </div>
      </div>

      <div className="report-viewer__toolbar">
        <button type="button" className="btn btn--primary" onClick={applyFilters}>
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
            onChange={(e) => setMode(e.target.value as typeof mode)}
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
            disabled={!propertyId && filteredUnits.length > 50}
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

      {report?.metadata?.notice ? (
        <p className="report-viewer__notice">{report.metadata.notice}</p>
      ) : null}

      {report ? (
        <p className="report-viewer__meta">
          Generated <DateTimeDisplay value={report.generatedAt} /> by{' '}
          <strong>{report.generatedBy.fullName}</strong> ({report.generatedBy.role})
          {report.metadata?.confidential ? (
            <>
              {' '}
              · <strong>Confidential</strong>
            </>
          ) : null}
        </p>
      ) : null}

      {isLoading ? <LoadingState message="Generating report…" /> : null}

      {!isLoading && error ? (
        <ErrorState message={error} onRetry={() => void load(applied)} />
      ) : null}

      {!isLoading && !error && report ? (
        <>
          {Object.keys(report.summary).length > 0 ? (
            <div className="report-viewer__summary">
              {Object.entries(report.summary).map(([key, value]) => (
                <SummaryCard
                  key={key}
                  label={summaryLabel(key)}
                  value={formatSummaryValue(key, value)}
                  tone={
                    key.toLowerCase().includes('net') ||
                    key.toLowerCase().includes('profit')
                      ? 'gold'
                      : 'default'
                  }
                />
              ))}
            </div>
          ) : null}

          {report.rows.length === 0 ? (
            <EmptyState
              title="No rows for this report"
              description="Try adjusting filters or choose a different period."
            />
          ) : (
            <>
              <DataTable
                columns={tableColumns}
                rows={report.rows}
                rowKey={(row) =>
                  String(row.id ?? row.paymentNumber ?? row.bookingNumber ?? '')
                }
              />

              {Object.keys(report.totals).length > 0 ? (
                <div className="report-viewer__totals">
                  {Object.entries(report.totals).map(([key, value]) => (
                    <div key={key} className="report-viewer__total-item">
                      <span>{summaryLabel(key)}</span>
                      <strong>{formatSummaryValue(key, value)}</strong>
                    </div>
                  ))}
                </div>
              ) : null}

              {report.pagination.total > report.pagination.limit ? (
                <div className="report-viewer__pagination">
                  <button
                    type="button"
                    className="btn btn--ghost"
                    disabled={page <= 1 || isLoading}
                    onClick={() => goToPage(page - 1)}
                  >
                    Previous
                  </button>
                  <span>
                    Page {report.pagination.page} of {totalPages} (
                    {report.pagination.total} rows)
                  </span>
                  <button
                    type="button"
                    className="btn btn--ghost"
                    disabled={page >= totalPages || isLoading}
                    onClick={() => goToPage(page + 1)}
                  >
                    Next
                  </button>
                </div>
              ) : null}
            </>
          )}
        </>
      ) : null}
    </div>
  );
}
