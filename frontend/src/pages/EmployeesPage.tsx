import { useEffect, useMemo, useState } from 'react';
import {
  archiveEmployee,
  fetchEmployeeSummary,
  fetchEmployees,
} from '../api/employees';
import {
  fetchSalaryRecord,
  fetchSalaryRecords,
  generateMonthlySalaries,
} from '../api/salary-records';
import { EmployeeDetailModal } from '../components/employees/EmployeeDetailModal';
import { EmployeeFormModal } from '../components/employees/EmployeeFormModal';
import {
  MonthAdvancesSummaryBar,
  SalaryAdvanceBanner,
} from '../components/employees/SalaryAdvanceBanner';
import { SalaryDetailModal } from '../components/employees/SalaryDetailModal';
import { SalaryTransactionFormModal } from '../components/employees/SalaryTransactionFormModal';
import { SummaryCard } from '../components/dashboard/SummaryCard';
import { PageHeader } from '../components/PageHeader';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { DataTable, type DataTableColumn } from '../components/ui/DataTable';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { FilterBar } from '../components/ui/FilterBar';
import { FormModal } from '../components/ui/FormModal';
import { LoadingState } from '../components/ui/LoadingState';
import { MoneyDisplay } from '../components/ui/MoneyDisplay';
import { Toast } from '../components/ui/Toast';
import { useAuth } from '../context/AuthContext';
import { useApiErrorHandler } from '../hooks/useApiErrorHandler';
import { formatDate, formatPkr } from '../lib/format';
import type {
  Employee,
  EmployeeStatus,
  EmployeeSummary,
  SalaryRecord,
  SalaryTransactionType,
} from '../types/employee';
import '../styles/forms.css';
import './EmployeesPage.css';

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

function salaryStatusLabel(record: SalaryRecord) {
  if (record.paymentStatus === 'PAID') return '✅ Paid';
  if (record.paymentStatus === 'PARTIAL') return '🟡 Partial';
  return '🔴 Unpaid';
}

function employeeStatusLabel(employee: Employee) {
  if (employee.currentMonthStatus === 'PAID') return '✅ Paid';
  if (employee.currentMonthStatus === 'PARTIAL') return '🟡 Partial';
  if (employee.currentMonthStatus === 'UNPAID') return '🔴 Unpaid';
  return '—';
}

export function EmployeesPage() {
  const { token, user } = useAuth();
  const handleApiError = useApiErrorHandler();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const [tab, setTab] = useState<'employees' | 'salaries'>('employees');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [summary, setSummary] = useState<EmployeeSummary | null>(null);
  const [salaryRecords, setSalaryRecords] = useState<SalaryRecord[]>([]);

  const [search, setSearch] = useState('');
  const [position, setPosition] = useState('');
  const [status, setStatus] = useState<EmployeeStatus | ''>('');

  const [salaryMonth, setSalaryMonth] = useState(String(now.getMonth() + 1));
  const [salaryYear, setSalaryYear] = useState(String(now.getFullYear()));

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<{
    message: string;
    tone: 'success' | 'error';
  }>({ message: '', tone: 'success' });

  const [showEmployeeForm, setShowEmployeeForm] = useState(false);
  const [editEmployee, setEditEmployee] = useState<Employee | null>(null);
  const [detailEmployeeId, setDetailEmployeeId] = useState<string | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<Employee | null>(null);
  const [showGenerate, setShowGenerate] = useState(false);
  const [genMonth, setGenMonth] = useState(String(now.getMonth() + 1));
  const [genYear, setGenYear] = useState(String(now.getFullYear()));
  const [txType, setTxType] = useState<SalaryTransactionType | null>(null);
  const [txPreset, setTxPreset] = useState<SalaryRecord | null>(null);
  const [txEmployeeId, setTxEmployeeId] = useState<string | undefined>();
  const [detailRecord, setDetailRecord] = useState<SalaryRecord | null>(null);
  const [busy, setBusy] = useState(false);

  const employeeQuery = useMemo(
    () => ({
      search: search.trim() || undefined,
      position: position || undefined,
      status,
      isActive: true as const,
    }),
    [search, position, status],
  );

  const salaryQuery = useMemo(
    () => ({
      salaryMonth: Number(salaryMonth),
      salaryYear: Number(salaryYear),
    }),
    [salaryMonth, salaryYear],
  );

  async function loadEmployees() {
    if (!token) return;
    setIsLoading(true);
    setError('');
    try {
      const [rows, stats] = await Promise.all([
        fetchEmployees(token, employeeQuery),
        fetchEmployeeSummary(token, {
          month: Number(salaryMonth),
          year: Number(salaryYear),
        }),
      ]);
      setEmployees(rows);
      setSummary(stats);
    } catch (err) {
      setError(handleApiError(err, 'Unable to load employees.'));
    } finally {
      setIsLoading(false);
    }
  }

  async function loadSalaries() {
    if (!token) return;
    setIsLoading(true);
    setError('');
    try {
      const [rows, stats] = await Promise.all([
        fetchSalaryRecords(token, salaryQuery),
        fetchEmployeeSummary(token, {
          month: Number(salaryMonth),
          year: Number(salaryYear),
        }),
      ]);
      setSalaryRecords(rows);
      setSummary(stats);
      if (employees.length === 0) {
        const list = await fetchEmployees(token, { isActive: true });
        setEmployees(list);
      }
    } catch (err) {
      setError(handleApiError(err, 'Unable to load salary records.'));
    } finally {
      setIsLoading(false);
    }
  }

  async function refreshAll() {
    if (tab === 'employees') await loadEmployees();
    else await loadSalaries();
  }

  useEffect(() => {
    if (!isSuperAdmin) {
      setError('Only Super Admin can access Employees & Salaries.');
      setIsLoading(false);
      return;
    }
    if (tab === 'employees') {
      void loadEmployees();
      return;
    }
    void loadSalaries();
  }, [token, tab, employeeQuery, salaryQuery, isSuperAdmin]);

  async function openSalaryDetail(record: SalaryRecord) {
    if (!token) return;
    try {
      const full = await fetchSalaryRecord(token, record.id);
      setDetailRecord(full);
    } catch (err) {
      setToast({
        message: handleApiError(err, 'Unable to load salary detail.'),
        tone: 'error',
      });
    }
  }

  async function handleGenerate() {
    if (!token || busy) return;
    setBusy(true);
    try {
      const result = await generateMonthlySalaries(token, {
        month: Number(genMonth),
        year: Number(genYear),
      });
      setShowGenerate(false);
      setSalaryMonth(genMonth);
      setSalaryYear(genYear);
      setTab('salaries');
      setToast({
        message: `Created ${result.created}, skipped ${result.skipped}, failed ${result.failed}.`,
        tone: 'success',
      });
      await loadSalaries();
    } catch (err) {
      setToast({
        message: handleApiError(err, 'Unable to generate salaries.'),
        tone: 'error',
      });
    } finally {
      setBusy(false);
    }
  }

  function clearFilters() {
    setSearch('');
    setPosition('');
    setStatus('');
  }

  const employeeColumns: DataTableColumn<Employee>[] = [
    {
      key: 'code',
      header: 'Employee Code',
      render: (row) => row.employeeCode,
    },
    { key: 'name', header: 'Name', render: (row) => row.fullName },
    {
      key: 'father',
      header: 'Father Name',
      render: (row) => row.fatherOrSpouseName ?? row.fatherName ?? '—',
    },
    { key: 'phone', header: 'Phone', render: (row) => row.phone },
    { key: 'cnic', header: 'CNIC', render: (row) => row.cnic ?? '—' },
    { key: 'position', header: 'Position', render: (row) => row.position },
    {
      key: 'joining',
      header: 'Joining Date',
      render: (row) => formatDate(row.joiningDate),
    },
    {
      key: 'salary',
      header: 'Monthly Salary',
      render: (row) =>
        row.monthlySalary != null ? (
          <MoneyDisplay value={row.monthlySalary} />
        ) : (
          '—'
        ),
    },
    {
      key: 'monthStatus',
      header: 'Current Month Status',
      render: (row) => (
        <span>
          {employeeStatusLabel(row)}
          {row.currentMonthHasAdvance ? (
            <span className="employees-badge employees-badge--advance">
              ADVANCE PAID
            </span>
          ) : null}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="data-table__actions">
          <button
            type="button"
            className="data-table__action"
            onClick={() => setDetailEmployeeId(row.id)}
          >
            View
          </button>
          <button
            type="button"
            className="data-table__action"
            onClick={() => {
              setEditEmployee(row);
              setShowEmployeeForm(true);
            }}
          >
            Edit
          </button>
          <button
            type="button"
            className="data-table__action"
            onClick={() => setTab('salaries')}
          >
            Salary
          </button>
          <button
            type="button"
            className="data-table__action"
            onClick={() => {
              setTxPreset(null);
              setTxEmployeeId(row.id);
              setTxType('ADVANCE');
            }}
          >
            Add Advance
          </button>
          {row.isActive ? (
            <button
              type="button"
              className="data-table__action data-table__action--danger"
              onClick={() => setArchiveTarget(row)}
            >
              Archive
            </button>
          ) : null}
        </div>
      ),
    },
  ];

  const salaryColumns: DataTableColumn<SalaryRecord>[] = [
    {
      key: 'name',
      header: 'Employee',
      render: (row) => row.employee?.fullName ?? '—',
    },
    {
      key: 'base',
      header: 'Base Salary',
      render: (row) => <MoneyDisplay value={row.baseSalary} />,
    },
    {
      key: 'advance',
      header: 'Advance',
      render: (row) => (
        <span>
          <MoneyDisplay value={row.totalAdvance} />
          {Number(row.totalAdvance) > 0 ? (
            <span className="employees-badge employees-badge--advance">
              ADVANCE PAID
            </span>
          ) : null}
        </span>
      ),
    },
    {
      key: 'bonus',
      header: 'Bonus',
      render: (row) => <MoneyDisplay value={row.totalBonus} />,
    },
    {
      key: 'deduction',
      header: 'Deduction',
      render: (row) => <MoneyDisplay value={row.totalDeductions} />,
    },
    {
      key: 'net',
      header: 'Net Salary',
      render: (row) => <MoneyDisplay value={row.netPayable} />,
    },
    {
      key: 'paid',
      header: 'Paid',
      render: (row) => <MoneyDisplay value={row.totalPaid} />,
    },
    {
      key: 'remaining',
      header: 'Remaining',
      render: (row) => <MoneyDisplay value={row.remainingBalance} />,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => salaryStatusLabel(row),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="data-table__actions">
          <button
            type="button"
            className="data-table__action"
            onClick={() => void openSalaryDetail(row)}
          >
            View
          </button>
          <button
            type="button"
            className="data-table__action"
            onClick={() => {
              setTxPreset(row);
              setTxType('ADVANCE');
            }}
          >
            Advance
          </button>
          <button
            type="button"
            className="data-table__action"
            onClick={() => {
              setTxPreset(row);
              setTxType('BONUS');
            }}
          >
            Bonus
          </button>
          <button
            type="button"
            className="data-table__action"
            onClick={() => {
              setTxPreset(row);
              setTxType('DEDUCTION');
            }}
          >
            Deduction
          </button>
          <button
            type="button"
            className="data-table__action"
            onClick={() => {
              setTxPreset(row);
              setTxType('SALARY_PAYMENT');
            }}
          >
            Payment
          </button>
        </div>
      ),
    },
  ];

  if (!isSuperAdmin) {
    return (
      <section className="entity-page employees-page">
        <PageHeader
          title="Employees"
          breadcrumb={['Home', 'Employees']}
        />
        <ErrorState message="Only Super Admin can access Employees & Salaries." />
      </section>
    );
  }

  return (
    <section className="entity-page employees-page">
      <PageHeader title="Employees" breadcrumb={['Home', 'Employees']} />
      <p className="employees-page__subtitle">
        Manage employee profiles and monthly salaries.
      </p>

      <div className="employees-page__tabs">
        <button
          type="button"
          className={tab === 'employees' ? 'btn btn--primary' : 'btn btn--ghost'}
          onClick={() => setTab('employees')}
        >
          Employees
        </button>
        <button
          type="button"
          className={tab === 'salaries' ? 'btn btn--primary' : 'btn btn--ghost'}
          onClick={() => setTab('salaries')}
        >
          Salaries
        </button>
      </div>

      <div className="entity-page__toolbar employees-page__toolbar">
        {tab === 'employees' ? (
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => {
              setEditEmployee(null);
              setShowEmployeeForm(true);
            }}
          >
            + Add Employee
          </button>
        ) : (
          <>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setShowGenerate(true)}
            >
              Generate Salaries
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => {
                setTxPreset(null);
                setTxEmployeeId(undefined);
                setTxType('ADVANCE');
              }}
            >
              Add Advance
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => {
                setTxPreset(null);
                setTxEmployeeId(undefined);
                setTxType('SALARY_PAYMENT');
              }}
            >
              Record Salary Payment
            </button>
          </>
        )}
      </div>

      {summary ? (
        <div className="employees-page__summary employees-page__summary--pastel">
          {tab === 'employees' ? (
            <>
              <SummaryCard
                label="Total Employees"
                value={summary.totalEmployees}
                tone="gold"
              />
              <SummaryCard
                label="Active Employees"
                value={summary.activeEmployees}
                tone="success"
              />
              <SummaryCard
                label="Salary Payable This Month"
                value={formatPkr(summary.monthlySalaryPayable)}
                tone="info"
              />
              <SummaryCard
                label="Outstanding Salary This Month"
                value={formatPkr(summary.salaryOutstanding)}
                tone="warn"
              />
            </>
          ) : (
            <>
              <SummaryCard
                label="Total Salary"
                value={formatPkr(summary.totalSalary ?? summary.monthlySalaryPayable)}
                tone="gold"
              />
              <SummaryCard
                label="Total Advances"
                value={formatPkr(summary.totalAdvances)}
                tone="danger"
              />
              <SummaryCard
                label="Total Paid"
                value={formatPkr(summary.salaryPaid)}
                tone="success"
              />
              <SummaryCard
                label="Remaining Salary"
                value={formatPkr(summary.salaryOutstanding)}
                tone="warn"
              />
            </>
          )}
        </div>
      ) : null}

      {tab === 'employees' ? (
        <FilterBar>
          <label>
            <span>Search</span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, phone, code…"
            />
          </label>
          <label>
            <span>Status</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as EmployeeStatus | '')}
            >
              <option value="">All</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="RESIGNED">Resigned</option>
              <option value="TERMINATED">Terminated</option>
            </select>
          </label>
          <label>
            <span>Designation</span>
            <input
              value={position}
              onChange={(e) => setPosition(e.target.value)}
            />
          </label>
          <button type="button" className="btn btn--ghost" onClick={clearFilters}>
            Clear Filters
          </button>
        </FilterBar>
      ) : (
        <FilterBar>
          <label>
            <span>Salary Month</span>
            <select
              value={salaryMonth}
              onChange={(e) => setSalaryMonth(e.target.value)}
            >
              {MONTH_NAMES.map((name, index) => (
                <option key={name} value={index + 1}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Year</span>
            <select
              value={salaryYear}
              onChange={(e) => setSalaryYear(e.target.value)}
            >
              {Array.from({ length: 6 }, (_, i) => now.getFullYear() - i + 1).map(
                (y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ),
              )}
            </select>
          </label>
          <p className="employees-page__viewing">
            Viewing: {MONTH_NAMES[Number(salaryMonth) - 1]} {salaryYear}
          </p>
        </FilterBar>
      )}

      {isLoading ? <LoadingState message="Loading…" /> : null}
      {!isLoading && error ? (
        <ErrorState
          message={error}
          onRetry={() => void refreshAll()}
        />
      ) : null}
      {!isLoading &&
      !error &&
      tab === 'employees' &&
      employees.length === 0 ? (
        <EmptyState title="No employees found" />
      ) : null}
      {!isLoading &&
      !error &&
      tab === 'salaries' &&
      salaryRecords.length === 0 ? (
        <EmptyState title="No salary records for this month" />
      ) : null}
      {!isLoading && !error && tab === 'employees' && employees.length > 0 ? (
        <DataTable
          columns={employeeColumns}
          rows={employees}
          rowKey={(row) => row.id}
        />
      ) : null}
      {!isLoading &&
      !error &&
      tab === 'salaries' &&
      salaryRecords.length > 0 ? (
        <>
          <MonthAdvancesSummaryBar
            records={salaryRecords}
            month={Number(salaryMonth)}
            year={Number(salaryYear)}
          />
          <DataTable
            columns={salaryColumns}
            rows={salaryRecords}
            rowKey={(row) => row.id}
            renderAfterRow={(row) =>
              Number(row.totalAdvance) > 0 ? (
                <SalaryAdvanceBanner record={row} variant="row" />
              ) : null
            }
          />
        </>
      ) : null}

      <EmployeeFormModal
        open={showEmployeeForm}
        token={token ?? ''}
        employee={editEmployee}
        onClose={() => {
          setShowEmployeeForm(false);
          setEditEmployee(null);
        }}
        onSaved={() => {
          setShowEmployeeForm(false);
          setEditEmployee(null);
          setToast({ message: 'Employee saved.', tone: 'success' });
          void loadEmployees();
        }}
        onError={(message) => setToast({ message, tone: 'error' })}
      />

      <EmployeeDetailModal
        open={Boolean(detailEmployeeId)}
        token={token ?? ''}
        employeeId={detailEmployeeId}
        onClose={() => setDetailEmployeeId(null)}
        onOpenSalary={(record) => {
          void openSalaryDetail(record);
        }}
        onError={(message) => setToast({ message, tone: 'error' })}
        onReversed={() => {
          setToast({ message: 'Transaction reversed.', tone: 'success' });
          void refreshAll();
        }}
      />

      {txType ? (
        <SalaryTransactionFormModal
          open={Boolean(txType)}
          token={token ?? ''}
          type={txType}
          employees={employees}
          presetRecord={txPreset}
          presetEmployeeId={txEmployeeId}
          defaultMonth={Number(salaryMonth)}
          defaultYear={Number(salaryYear)}
          onClose={() => {
            setTxType(null);
            setTxPreset(null);
            setTxEmployeeId(undefined);
          }}
          onSaved={() => {
            setTxType(null);
            setTxPreset(null);
            setTxEmployeeId(undefined);
            setToast({ message: 'Transaction saved.', tone: 'success' });
            void refreshAll();
          }}
          onError={(message) => setToast({ message, tone: 'error' })}
        />
      ) : null}

      <SalaryDetailModal
        open={Boolean(detailRecord)}
        record={detailRecord}
        onClose={() => setDetailRecord(null)}
      />

      <FormModal
        open={showGenerate}
        title="Generate Monthly Salaries"
        onClose={() => setShowGenerate(false)}
      >
        <div className="form-grid form-grid--2">
          <label className="form-field">
            <span>Month</span>
            <select
              value={genMonth}
              onChange={(e) => setGenMonth(e.target.value)}
            >
              {MONTH_NAMES.map((name, index) => (
                <option key={name} value={index + 1}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>Year</span>
            <input
              type="number"
              min="2000"
              max="2100"
              value={genYear}
              onChange={(e) => setGenYear(e.target.value)}
            />
          </label>
        </div>
        <div className="form-actions">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => setShowGenerate(false)}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn--primary"
            disabled={busy}
            onClick={() => void handleGenerate()}
          >
            {busy ? 'Generating…' : 'Generate'}
          </button>
        </div>
      </FormModal>

      <ConfirmDialog
        open={Boolean(archiveTarget)}
        title="Archive employee?"
        message={`Archive ${archiveTarget?.fullName ?? 'this employee'}?`}
        confirmLabel="Archive"
        busy={busy}
        onCancel={() => setArchiveTarget(null)}
        onConfirm={() => {
          if (!token || !archiveTarget) return;
          setBusy(true);
          void archiveEmployee(token, archiveTarget.id)
            .then(() => {
              setArchiveTarget(null);
              setToast({ message: 'Employee archived.', tone: 'success' });
              void loadEmployees();
            })
            .catch((err) =>
              setToast({
                message: handleApiError(err, 'Unable to archive.'),
                tone: 'error',
              }),
            )
            .finally(() => setBusy(false));
        }}
      />

      <Toast
        message={toast.message}
        tone={toast.tone}
        onClose={() => setToast({ message: '', tone: 'success' })}
      />
    </section>
  );
}
