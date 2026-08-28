import { useCallback, useEffect, useMemo, useState, Fragment } from 'react';
import { fetchProperties } from '../api/properties';
import {
  archiveOwner,
  endOwnerAssignment,
  fetchOwnerPayments,
  fetchOwnerStatementTotals,
  fetchOwnerStatements,
  fetchOwnersMonthlySummary,
  finalizeOwnerStatement,
  generateOwnerStatements,
  markOwnerStatementPaid,
  reverseOwnerPayment,
} from '../api/owners';
import { SummaryCard } from '../components/dashboard/SummaryCard';
import { OwnerAssignmentFormModal } from '../components/owners/OwnerAssignmentFormModal';
import { OwnerDetailDrawer } from '../components/owners/OwnerDetailDrawer';
import { OwnerFormModal } from '../components/owners/OwnerFormModal';
import { OwnerPaymentFormModal } from '../components/owners/OwnerPaymentFormModal';
import { OwnerPaymentStatusTick } from '../components/owners/OwnerPaymentStatusTick';
import { OwnerReviseAgreementModal } from '../components/owners/OwnerReviseAgreementModal';
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
import type { Property } from '../types/property';
import type {
  Owner,
  OwnerMonthlyStatement,
  OwnerMonthlySummary,
  OwnerMonthlySummaryRow,
  OwnerMonthlySummaryUnit,
  OwnerPayment,
  OwnerStatementTotals,
  OwnerUnitAssignment,
} from '../types/owner';
import '../styles/forms.css';
import './OwnersPage.css';

type Tab = 'owners' | 'collection' | 'payments';

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
] as const;

function periodLabel(month: number, year: number) {
  return `${MONTH_NAMES[month - 1] ?? `Month ${month}`} ${year}`;
}

function shiftMonth(month: number, year: number, delta: number) {
  const d = new Date(year, month - 1 + delta, 1);
  return { month: d.getMonth() + 1, year: d.getFullYear() };
}

function directionLabel(value: string) {
  if (value === 'RECEIVABLE_FROM_OWNER') return 'Receivable';
  if (value === 'PAYABLE_TO_OWNER') return 'Payable';
  return value;
}

function statementFromUnit(
  owner: OwnerMonthlySummaryRow,
  unit: OwnerMonthlySummaryUnit,
  month: number,
  year: number,
): OwnerMonthlyStatement | null {
  if (!unit.statementId) return null;
  return {
    id: unit.statementId,
    ownerUnitAssignmentId: unit.agreementId,
    ownerId: owner.ownerId,
    propertyId: unit.propertyId,
    unitId: unit.unitId,
    statementMonth: month,
    statementYear: year,
    accountDirection: unit.accountDirection ?? 'RECEIVABLE_FROM_OWNER',
    expectedAmount: unit.expected,
    previousBalance: '0',
    adjustmentAmount: '0',
    totalPayableOrReceivable: unit.expected,
    totalPaid: unit.paid,
    remainingAmount: unit.remaining,
    dueDate: unit.dueDate ?? new Date().toISOString(),
    paymentStatus: unit.paymentStatus,
    paymentStatusTick: unit.paymentStatusTick,
    finalized: false,
    notes: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    owner: {
      id: owner.ownerId,
      fullName: owner.fullName,
      phone: owner.phone,
    },
    property: { id: unit.propertyId, name: unit.propertyName },
    unit: {
      id: unit.unitId,
      unitNumber: unit.unitNumber,
      floor: unit.floor,
    },
  };
}

function canMarkStatementPaid(
  paymentStatus: string | null | undefined,
  remainingAmount: string | null | undefined,
): boolean {
  if (paymentStatus === 'PAID' || paymentStatus === 'OVERPAID') return false;
  if (remainingAmount == null || remainingAmount === '') return false;
  const remaining = Number(remainingAmount);
  return Number.isFinite(remaining) && remaining > 0;
}

function isAlreadyPaid(
  paymentStatus: string | null | undefined,
  remainingAmount: string | null | undefined,
): boolean {
  if (paymentStatus === 'PAID' || paymentStatus === 'OVERPAID') return true;
  if (remainingAmount == null || remainingAmount === '') return false;
  const remaining = Number(remainingAmount);
  return Number.isFinite(remaining) && remaining <= 0;
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows
    .map((row) =>
      row
        .map((cell) => {
          const value = cell ?? '';
          if (/[",\n]/.test(value)) {
            return `"${value.replaceAll('"', '""')}"`;
          }
          return value;
        })
        .join(','),
    )
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function OwnersPage() {
  const { token, user } = useAuth();
  const handleApiError = useApiErrorHandler();
  const role = user?.role;
  const isSuperAdmin = role === 'SUPER_ADMIN';
  const canAccess = role === 'SUPER_ADMIN';

  const now = useMemo(() => new Date(), []);
  const [tab, setTab] = useState<Tab>('owners');
  const [properties, setProperties] = useState<Property[]>([]);

  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [propertyId, setPropertyId] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const [summary, setSummary] = useState<OwnerMonthlySummary | null>(null);
  const [expandedOwnerIds, setExpandedOwnerIds] = useState<Set<string>>(
    () => new Set(),
  );

  const [statements, setStatements] = useState<OwnerMonthlyStatement[]>([]);
  const [totals, setTotals] = useState<OwnerStatementTotals | null>(null);
  const [payments, setPayments] = useState<OwnerPayment[]>([]);
  const [accountDirection, setAccountDirection] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [showMoreFilters, setShowMoreFilters] = useState(false);

  const [listLoading, setListLoading] = useState(true);
  const [tabLoading, setTabLoading] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<{
    message: string;
    tone: 'success' | 'error';
  }>({ message: '', tone: 'success' });
  const [busy, setBusy] = useState(false);
  const [cacheVersion, setCacheVersion] = useState(0);

  const [showOwnerForm, setShowOwnerForm] = useState(false);
  const [editOwner, setEditOwner] = useState<Owner | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<Owner | null>(null);
  const [showAssignmentForm, setShowAssignmentForm] = useState(false);
  const [editAssignment, setEditAssignment] =
    useState<OwnerUnitAssignment | null>(null);
  const [assignmentPreset, setAssignmentPreset] = useState<{
    ownerId?: string;
    propertyId?: string;
    unitId?: string;
  }>({});
  const [endTarget, setEndTarget] = useState<OwnerUnitAssignment | null>(null);
  const [paymentStatement, setPaymentStatement] =
    useState<OwnerMonthlyStatement | null>(null);
  const [markPaidTarget, setMarkPaidTarget] =
    useState<OwnerMonthlyStatement | null>(null);
  const [unitChooser, setUnitChooser] = useState<OwnerMonthlySummaryRow | null>(
    null,
  );
  const [showGenerate, setShowGenerate] = useState(false);
  const [genMonth, setGenMonth] = useState(String(now.getMonth() + 1));
  const [genYear, setGenYear] = useState(String(now.getFullYear()));
  const [reverseTarget, setReverseTarget] = useState<OwnerPayment | null>(null);
  const [reverseReason, setReverseReason] = useState('');
  const [detailOwnerId, setDetailOwnerId] = useState<string | null>(null);
  const [detailVersion, setDetailVersion] = useState(0);
  const [reviseAssignment, setReviseAssignment] =
    useState<OwnerUnitAssignment | null>(null);

  const period = summary?.period ?? {
    month,
    year,
    label: periodLabel(month, year),
  };

  const monthlyQueryKey = useMemo(
    () => ({
      month,
      year,
      propertyId: propertyId || undefined,
      search: search.trim() || undefined,
    }),
    [month, year, propertyId, search],
  );

  const invalidate = useCallback(() => {
    setCacheVersion((v) => v + 1);
    setDetailVersion((v) => v + 1);
  }, []);

  const refetchMonthlySummary = useCallback(async () => {
    if (!token || !canAccess) return;
    setListLoading(true);
    setError('');
    try {
      const data = await fetchOwnersMonthlySummary(token, monthlyQueryKey);
      setSummary(data);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setListLoading(false);
    }
  }, [token, canAccess, monthlyQueryKey, handleApiError]);

  useEffect(() => {
    if (!token || !canAccess) return;
    void fetchProperties(token)
      .then(setProperties)
      .catch((err) => setError(handleApiError(err)));
  }, [token, canAccess, handleApiError]);

  useEffect(() => {
    void refetchMonthlySummary();
  }, [refetchMonthlySummary, cacheVersion]);

  useEffect(() => {
    const t = window.setTimeout(() => setSearch(searchInput.trim()), 250);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const reloadTabData = useCallback(async () => {
    if (!token || !canAccess || tab === 'owners') return;
    setTabLoading(true);
    setError('');
    try {
      if (tab === 'collection') {
        const [rows, totalRows] = await Promise.all([
          fetchOwnerStatements(token, {
            month,
            year,
            propertyId: propertyId || undefined,
            accountDirection: accountDirection || undefined,
            paymentStatus: paymentStatus || undefined,
            search: search.trim() || undefined,
          }),
          fetchOwnerStatementTotals(token, {
            month,
            year,
            propertyId: propertyId || undefined,
            accountDirection: accountDirection || undefined,
            paymentStatus: paymentStatus || undefined,
            search: search.trim() || undefined,
          }),
        ]);
        setStatements(rows);
        setTotals(totalRows);
      } else {
        const rows = await fetchOwnerPayments(token, {
          propertyId: propertyId || undefined,
          search: search.trim() || undefined,
        });
        setPayments(rows);
      }
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setTabLoading(false);
    }
  }, [
    token,
    canAccess,
    tab,
    month,
    year,
    propertyId,
    accountDirection,
    paymentStatus,
    search,
    handleApiError,
  ]);

  useEffect(() => {
    void reloadTabData();
  }, [reloadTabData, cacheVersion]);

  function goPrevMonth() {
    const next = shiftMonth(month, year, -1);
    setMonth(next.month);
    setYear(next.year);
  }

  function goNextMonth() {
    const next = shiftMonth(month, year, 1);
    setMonth(next.month);
    setYear(next.year);
  }

  function goCurrentMonth() {
    const d = new Date();
    setMonth(d.getMonth() + 1);
    setYear(d.getFullYear());
  }

  function toggleExpand(ownerId: string) {
    setExpandedOwnerIds((prev) => {
      const next = new Set(prev);
      if (next.has(ownerId)) next.delete(ownerId);
      else next.add(ownerId);
      return next;
    });
  }

  function openPaymentForUnit(
    owner: OwnerMonthlySummaryRow,
    unit: OwnerMonthlySummaryUnit,
  ) {
    const statement = statementFromUnit(owner, unit, month, year);
    if (!statement) {
      setToast({
        message: 'Generate monthly statement first',
        tone: 'error',
      });
      return;
    }
    setUnitChooser(null);
    setPaymentStatement(statement);
  }

  function openMarkPaidForUnit(
    owner: OwnerMonthlySummaryRow,
    unit: OwnerMonthlySummaryUnit,
  ) {
    void (async () => {
      if (!token) {
        setToast({ message: 'Sign in again to mark paid', tone: 'error' });
        return;
      }
      if (!isSuperAdmin) {
        setToast({
          message: 'Only Super Admin can mark owner statements paid',
          tone: 'error',
        });
        return;
      }
      if (isAlreadyPaid(unit.paymentStatus, unit.remaining)) {
        setToast({ message: 'Already paid', tone: 'error' });
        return;
      }
      if (!canMarkStatementPaid(unit.paymentStatus, unit.remaining)) {
        setToast({ message: 'Already paid', tone: 'error' });
        return;
      }

      let statementId = unit.statementId;
      if (!statementId) {
        setBusy(true);
        try {
          const result = await generateOwnerStatements(token, {
            month,
            year,
            ownerId: owner.ownerId,
            unitId: unit.unitId,
          });
          const match = result.details?.find(
            (d) =>
              d.unitId === unit.unitId &&
              d.statementId &&
              (d.status === 'CREATED' || d.status === 'SKIPPED'),
          );
          statementId = match?.statementId ?? null;
          if (!statementId) {
            setToast({
              message: 'Generate monthly statement first',
              tone: 'error',
            });
            return;
          }
          // Keep table/statementId in sync if user cancels confirm.
          invalidate();
        } catch (err) {
          setToast({ message: handleApiError(err), tone: 'error' });
          return;
        } finally {
          setBusy(false);
        }
      }

      const statement = statementFromUnit(
        owner,
        { ...unit, statementId },
        month,
        year,
      );
      if (!statement) {
        setToast({
          message: 'Generate monthly statement first',
          tone: 'error',
        });
        return;
      }

      setUnitChooser(null);
      setMarkPaidTarget(statement);
    })();
  }

  function startRecordPayment(owner: OwnerMonthlySummaryRow) {
    if (owner.units.length === 0) {
      setToast({ message: 'Assign a unit before recording payment', tone: 'error' });
      return;
    }
    if (owner.units.length === 1) {
      openPaymentForUnit(owner, owner.units[0]);
      return;
    }
    setUnitChooser(owner);
  }

  function openEditAgreementForOwner(owner: OwnerMonthlySummaryRow) {
    if (owner.units.length === 0) {
      setToast({ message: 'No active agreements to revise', tone: 'error' });
      return;
    }
    if (owner.units.length === 1) {
      setReviseAssignment({
        id: owner.units[0].agreementId,
        ownerId: owner.ownerId,
        propertyId: owner.units[0].propertyId,
        unitId: owner.units[0].unitId,
        accountDirection:
          owner.units[0].accountDirection ?? 'RECEIVABLE_FROM_OWNER',
        ownershipPercentage: '0',
        fixedMonthlyAmount: owner.units[0].agreedMonthlyAmount,
        agreementStart: new Date().toISOString(),
        agreementEnd: null,
        dueDay: 15,
        status: 'ACTIVE',
        notes: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        endedAt: null,
        owner: {
          id: owner.ownerId,
          fullName: owner.fullName,
          phone: owner.phone,
        },
        property: {
          id: owner.units[0].propertyId,
          name: owner.units[0].propertyName,
        },
        unit: {
          id: owner.units[0].unitId,
          unitNumber: owner.units[0].unitNumber,
          floor: owner.units[0].floor,
          unitType: owner.units[0].unitType,
        },
      });
      return;
    }
    setExpandedOwnerIds((prev) => new Set(prev).add(owner.ownerId));
    setToast({
      message: 'Expand the row and choose Edit on the unit to revise',
      tone: 'success',
    });
  }

  if (!canAccess) {
    return (
      <div className="owners-page">
        <PageHeader title="Owners" breadcrumb={['Home', 'Owners']} />
        <ErrorState message="Owners is Super Admin only. Admin and Receptionist cannot access owner financial data." />
      </div>
    );
  }

  const isLoading = tab === 'owners' ? listLoading : tabLoading;
  const owners = summary?.owners ?? [];
  const cardTotals = summary?.totals;

  const statementColumns: DataTableColumn<OwnerMonthlyStatement>[] = [
    {
      key: 'property',
      header: 'Property',
      render: (r) => r.property?.name ?? '—',
    },
    {
      key: 'unit',
      header: 'Unit',
      render: (r) => r.unit?.unitNumber ?? '—',
    },
    {
      key: 'owner',
      header: 'Owner',
      render: (r) => r.owner?.fullName ?? '—',
    },
    {
      key: 'expected',
      header: 'Expected',
      render: (r) => <MoneyDisplay value={r.totalPayableOrReceivable} />,
    },
    {
      key: 'paid',
      header: 'Paid',
      render: (r) => <MoneyDisplay value={r.totalPaid} />,
    },
    {
      key: 'remaining',
      header: 'Remaining',
      render: (r) => <MoneyDisplay value={r.remainingAmount} />,
    },
    {
      key: 'direction',
      header: 'Direction',
      render: (r) => directionLabel(r.accountDirection),
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => (
        <OwnerPaymentStatusTick
          status={r.paymentStatus}
          tick={r.paymentStatusTick}
        />
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (r) => (
        <div className="owners-page__actions">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => setPaymentStatement(r)}
          >
            Pay
          </button>
          {canMarkStatementPaid(r.paymentStatus, r.remainingAmount) &&
          isSuperAdmin ? (
            <button
              type="button"
              className="btn btn--ghost"
              onClick={(event) => {
                event.stopPropagation();
                setMarkPaidTarget(r);
              }}
            >
              Mark Paid
            </button>
          ) : null}
          {!r.finalized ? (
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => {
                void (async () => {
                  if (!token) return;
                  try {
                    await finalizeOwnerStatement(token, r.id);
                    setToast({ message: 'Statement finalized', tone: 'success' });
                    invalidate();
                  } catch (err) {
                    setToast({ message: handleApiError(err), tone: 'error' });
                  }
                })();
              }}
            >
              Finalize
            </button>
          ) : null}
        </div>
      ),
    },
  ];

  const paymentColumns: DataTableColumn<OwnerPayment>[] = [
    {
      key: 'date',
      header: 'Date',
      render: (r) => formatDate(r.paymentDate),
    },
    {
      key: 'number',
      header: '#',
      render: (r) => r.paymentNumber,
    },
    {
      key: 'owner',
      header: 'Owner',
      render: (r) => r.owner?.fullName ?? '—',
    },
    {
      key: 'amount',
      header: 'Amount',
      render: (r) => <MoneyDisplay value={r.amount} />,
    },
    {
      key: 'method',
      header: 'Method',
      render: (r) => r.paymentMethod.replaceAll('_', ' '),
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => r.status,
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (r) =>
        r.status === 'COMPLETED' && r.transactionType === 'PAYMENT' ? (
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => {
              setReverseReason('');
              setReverseTarget(r);
            }}
          >
            Reverse
          </button>
        ) : null,
    },
  ];

  return (
    <div className="owners-page">
      <PageHeader
        title="Owners"
        breadcrumb={['Home', 'Owners']}
        actions={
          <div className="owners-page__actions">
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => {
                setEditOwner(null);
                setShowOwnerForm(true);
              }}
            >
              + Add Owner
            </button>
            {tab === 'collection' ? (
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => {
                  setGenMonth(String(month));
                  setGenYear(String(year));
                  setShowGenerate(true);
                }}
              >
                Generate Statements
              </button>
            ) : null}
          </div>
        }
      />
      <p className="owners-page__subtitle">
        Owner payments and apartment assignments — {period.label}
      </p>

      <div className="owners-page__tabs" role="tablist">
        {(
          [
            ['owners', 'Owners'],
            ['collection', 'Monthly Collection'],
            ['payments', 'Payment History'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={
              tab === id
                ? 'owners-page__tab owners-page__tab--active'
                : 'owners-page__tab'
            }
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="owners-page__period-bar">
        <label>
          Month
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
          >
            {MONTH_NAMES.map((name, idx) => (
              <option key={name} value={idx + 1}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Year
          <input
            type="number"
            min={2000}
            max={2100}
            value={year}
            onChange={(e) => setYear(Number(e.target.value) || year)}
          />
        </label>
        <label>
          Property
          <select
            value={propertyId}
            onChange={(e) => setPropertyId(e.target.value)}
          >
            <option value="">All properties</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="owners-page__period-search">
          Search
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Owner name, phone, CNIC"
          />
        </label>
        <div className="owners-page__period-nav">
          <button type="button" className="btn btn--ghost" onClick={goPrevMonth}>
            ← Prev
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={goCurrentMonth}
          >
            Current Month
          </button>
          <button type="button" className="btn btn--ghost" onClick={goNextMonth}>
            Next Month →
          </button>
        </div>
      </div>

      {error ? <ErrorState message={error} /> : null}
      {isLoading ? <LoadingState message="Loading owners…" /> : null}

      {!isLoading && !error && tab === 'owners' ? (
        <>
          <div className="owners-page__summary owners-page__summary--pastel">
            <SummaryCard
              label="Total Owners"
              value={String(cardTotals?.totalOwners ?? 0)}
              tone="info"
            />
            <SummaryCard
              label="Assigned Units"
              value={String(cardTotals?.assignedUnits ?? 0)}
              tone="gold"
            />
            <SummaryCard
              label={`Expected — ${period.label}`}
              value={formatPkr(cardTotals?.expected ?? '0')}
              tone="success"
            />
            <SummaryCard
              label={`Outstanding — ${period.label}`}
              value={formatPkr(cardTotals?.remaining ?? '0')}
              tone="danger"
            />
          </div>

          {owners.length ? (
            <div className="owners-page__table-wrap">
              <table className="owners-page__main-table">
                <thead>
                  <tr>
                    <th>Owner</th>
                    <th>Assigned Units</th>
                    <th>Expected ({period.label})</th>
                    <th>Paid ({period.label})</th>
                    <th>Remaining</th>
                    <th>Month Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {owners.map((owner) => {
                    const expanded = expandedOwnerIds.has(owner.ownerId);
                    return (
                      <Fragment key={owner.ownerId}>
                        <tr>
                          <td>
                            <strong>{owner.fullName}</strong>
                            <div className="owners-page__muted">{owner.phone}</div>
                          </td>
                          <td>
                            {owner.unitCount > 0 ? (
                              <button
                                type="button"
                                className="btn btn--ghost owners-page__units-toggle"
                                onClick={() => toggleExpand(owner.ownerId)}
                              >
                                {owner.unitCount}{' '}
                                {owner.unitCount === 1 ? 'Unit' : 'Units'}
                                {expanded ? ' ▴' : ' ▾'}
                              </button>
                            ) : (
                              <span className="owners-page__muted">0 Units</span>
                            )}
                          </td>
                          <td>
                            <MoneyDisplay value={owner.expected} />
                          </td>
                          <td>
                            <MoneyDisplay value={owner.paid} />
                          </td>
                          <td>
                            <MoneyDisplay value={owner.remaining} />
                          </td>
                          <td>
                            {owner.unitCount ? (
                              <OwnerPaymentStatusTick
                                status={owner.status}
                                tick={owner.statusTick}
                              />
                            ) : (
                              <span className="owners-page__muted">—</span>
                            )}
                          </td>
                          <td>
                            <div className="owners-page__actions">
                              <button
                                type="button"
                                className="btn btn--ghost"
                                onClick={() => setDetailOwnerId(owner.ownerId)}
                              >
                                View
                              </button>
                              <button
                                type="button"
                                className="btn btn--ghost"
                                onClick={() => startRecordPayment(owner)}
                              >
                                Record Payment
                              </button>
                              <button
                                type="button"
                                className="btn btn--ghost"
                                onClick={() => {
                                  setAssignmentPreset({ ownerId: owner.ownerId });
                                  setEditAssignment(null);
                                  setShowAssignmentForm(true);
                                }}
                              >
                                Assign Unit
                              </button>
                              {isSuperAdmin ? (
                                <button
                                  type="button"
                                  className="btn btn--ghost"
                                  onClick={() => openEditAgreementForOwner(owner)}
                                >
                                  Edit Agreement
                                </button>
                              ) : null}
                              <button
                                type="button"
                                className="btn btn--ghost"
                                onClick={() => {
                                  setEditOwner({
                                    id: owner.ownerId,
                                    fullName: owner.fullName,
                                    fatherOrSpouseName: null,
                                    phone: owner.phone,
                                    alternatePhone: null,
                                    email: owner.email,
                                    cnic: null,
                                    address: null,
                                    city: null,
                                    bankName: null,
                                    accountTitle: null,
                                    accountNumberOrIban: null,
                                    branchName: null,
                                    notes: null,
                                    isActive: owner.isActive,
                                    createdAt: new Date().toISOString(),
                                    updatedAt: new Date().toISOString(),
                                  });
                                  setShowOwnerForm(true);
                                }}
                              >
                                Edit
                              </button>
                              {isSuperAdmin ? (
                                <button
                                  type="button"
                                  className="btn btn--ghost"
                                  onClick={() =>
                                    setArchiveTarget({
                                      id: owner.ownerId,
                                      fullName: owner.fullName,
                                      fatherOrSpouseName: null,
                                      phone: owner.phone,
                                      alternatePhone: null,
                                      email: owner.email,
                                      cnic: null,
                                      address: null,
                                      city: null,
                                      bankName: null,
                                      accountTitle: null,
                                      accountNumberOrIban: null,
                                      branchName: null,
                                      notes: null,
                                      isActive: owner.isActive,
                                      createdAt: new Date().toISOString(),
                                      updatedAt: new Date().toISOString(),
                                    })
                                  }
                                >
                                  Archive
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                        {expanded
                          ? owner.units.map((unit) => (
                              <tr
                                key={`${owner.ownerId}-${unit.agreementId}`}
                                className="owners-page__unit-row"
                              >
                                <td colSpan={2}>
                                  <div className="owners-page__unit-cell">
                                    {unit.propertyName} — {unit.unitNumber}
                                    {unit.floor != null
                                      ? ` (Floor ${unit.floor})`
                                      : ''}
                                  </div>
                                </td>
                                <td>
                                  <MoneyDisplay value={unit.expected} />
                                </td>
                                <td>
                                  <MoneyDisplay value={unit.paid} />
                                </td>
                                <td>
                                  <MoneyDisplay value={unit.remaining} />
                                </td>
                                <td>
                                  <OwnerPaymentStatusTick
                                    status={unit.paymentStatus}
                                    tick={unit.paymentStatusTick}
                                  />
                                </td>
                                <td>
                                  <div className="owners-page__actions">
                                    <button
                                      type="button"
                                      className="btn btn--ghost"
                                      onClick={() =>
                                        openPaymentForUnit(owner, unit)
                                      }
                                    >
                                      Pay
                                    </button>
                                    {canMarkStatementPaid(
                                      unit.paymentStatus,
                                      unit.remaining,
                                    ) && isSuperAdmin ? (
                                      <button
                                        type="button"
                                        className="btn btn--ghost"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          openMarkPaidForUnit(owner, unit);
                                        }}
                                      >
                                        Mark Paid
                                      </button>
                                    ) : null}
                                    {isSuperAdmin ? (
                                      <button
                                        type="button"
                                        className="btn btn--ghost"
                                        onClick={() => {
                                          setReviseAssignment({
                                            id: unit.agreementId,
                                            ownerId: owner.ownerId,
                                            propertyId: unit.propertyId,
                                            unitId: unit.unitId,
                                            accountDirection:
                                              unit.accountDirection ??
                                              'RECEIVABLE_FROM_OWNER',
                                            ownershipPercentage: '0',
                                            fixedMonthlyAmount:
                                              unit.agreedMonthlyAmount,
                                            agreementStart:
                                              new Date().toISOString(),
                                            agreementEnd: null,
                                            dueDay: 15,
                                            status: 'ACTIVE',
                                            notes: null,
                                            createdAt: new Date().toISOString(),
                                            updatedAt: new Date().toISOString(),
                                            endedAt: null,
                                            owner: {
                                              id: owner.ownerId,
                                              fullName: owner.fullName,
                                              phone: owner.phone,
                                            },
                                            property: {
                                              id: unit.propertyId,
                                              name: unit.propertyName,
                                            },
                                            unit: {
                                              id: unit.unitId,
                                              unitNumber: unit.unitNumber,
                                              floor: unit.floor,
                                              unitType: unit.unitType,
                                            },
                                          });
                                        }}
                                      >
                                        Edit Agreement
                                      </button>
                                    ) : null}
                                    <button
                                      type="button"
                                      className="btn btn--ghost"
                                      onClick={() =>
                                        setEndTarget({
                                          id: unit.agreementId,
                                          ownerId: owner.ownerId,
                                          propertyId: unit.propertyId,
                                          unitId: unit.unitId,
                                          accountDirection:
                                            unit.accountDirection ??
                                            'RECEIVABLE_FROM_OWNER',
                                          ownershipPercentage: '0',
                                          fixedMonthlyAmount:
                                            unit.agreedMonthlyAmount,
                                          agreementStart:
                                            new Date().toISOString(),
                                          agreementEnd: null,
                                          dueDay: 15,
                                          status: 'ACTIVE',
                                          notes: null,
                                          createdAt: new Date().toISOString(),
                                          updatedAt: new Date().toISOString(),
                                          endedAt: null,
                                          owner: {
                                            id: owner.ownerId,
                                            fullName: owner.fullName,
                                            phone: owner.phone,
                                          },
                                        })
                                      }
                                    >
                                      End
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))
                          : null}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="No owners for this period"
              description="Add an owner or clear filters."
            />
          )}
        </>
      ) : null}

      {!isLoading && !error && tab === 'collection' ? (
        <>
          <p className="owners-page__subtitle">
            Monthly collection for {period.label}
          </p>
          <div className="owners-page__toolbar">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setShowMoreFilters((v) => !v)}
            >
              {showMoreFilters ? 'Hide Filters' : 'More Filters'}
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => {
                downloadCsv(`owner-collection-${period.label}.csv`, [
                  [
                    'Property',
                    'Unit',
                    'Owner',
                    'Expected',
                    'Paid',
                    'Remaining',
                    'Status',
                  ],
                  ...statements.map((s) => [
                    s.property?.name ?? '',
                    s.unit?.unitNumber ?? '',
                    s.owner?.fullName ?? '',
                    s.totalPayableOrReceivable,
                    s.totalPaid,
                    s.remainingAmount,
                    s.paymentStatus,
                  ]),
                ]);
              }}
            >
              Export CSV
            </button>
          </div>
          {showMoreFilters ? (
            <FilterBar>
              <label>
                Direction
                <select
                  value={accountDirection}
                  onChange={(e) => setAccountDirection(e.target.value)}
                >
                  <option value="">All</option>
                  <option value="RECEIVABLE_FROM_OWNER">Receivable</option>
                  <option value="PAYABLE_TO_OWNER">Payable</option>
                </select>
              </label>
              <label>
                Status
                <select
                  value={paymentStatus}
                  onChange={(e) => setPaymentStatus(e.target.value)}
                >
                  <option value="">All</option>
                  <option value="UNPAID">Unpaid</option>
                  <option value="PARTIAL">Partial</option>
                  <option value="PAID">Paid</option>
                  <option value="OVERDUE">Overdue</option>
                  <option value="OVERPAID">Overpaid</option>
                </select>
              </label>
            </FilterBar>
          ) : null}
          {totals ? (
            <div className="owners-page__summary owners-page__summary--pastel">
              <SummaryCard
                label={`Expected — ${period.label}`}
                value={formatPkr(totals.totalExpected)}
                tone="gold"
              />
              <SummaryCard
                label={`Paid — ${period.label}`}
                value={formatPkr(totals.totalPaid)}
                tone="success"
              />
              <SummaryCard
                label={`Remaining — ${period.label}`}
                value={formatPkr(totals.totalRemaining)}
                tone="danger"
              />
            </div>
          ) : null}
          {statements.length ? (
            <DataTable
              columns={statementColumns}
              rows={statements}
              rowKey={(r) => r.id}
            />
          ) : (
            <EmptyState
              title={`No statements for ${period.label}`}
              description="Generate statements for this month."
            />
          )}
        </>
      ) : null}

      {!isLoading && !error && tab === 'payments' ? (
        payments.length ? (
          <DataTable
            columns={paymentColumns}
            rows={payments}
            rowKey={(r) => r.id}
          />
        ) : (
          <EmptyState
            title="No owner payments"
            description="Record a payment from the Owners tab."
          />
        )
      ) : null}

      {unitChooser ? (
        <div className="owners-page__drawer" role="dialog">
          <div className="owners-page__drawer-panel">
            <header>
              <div>
                <h2>Choose unit to pay</h2>
                <p>
                  {unitChooser.fullName} — {period.label}
                </p>
              </div>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => setUnitChooser(null)}
              >
                Close
              </button>
            </header>
            <table className="owners-page__detail-table">
              <thead>
                <tr>
                  <th>Unit</th>
                  <th>Remaining</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {unitChooser.units.map((unit) => (
                  <tr key={unit.agreementId}>
                    <td>
                      {unit.propertyName} — {unit.unitNumber}
                    </td>
                    <td>{formatPkr(unit.remaining)}</td>
                    <td>
                      <OwnerPaymentStatusTick
                        status={unit.paymentStatus}
                        tick={unit.paymentStatusTick}
                      />
                    </td>
                    <td>
                      <div className="owners-page__actions">
                        <button
                          type="button"
                          className="btn btn--primary"
                          onClick={() => openPaymentForUnit(unitChooser, unit)}
                        >
                          Pay
                        </button>
                        {canMarkStatementPaid(
                          unit.paymentStatus,
                          unit.remaining,
                        ) && isSuperAdmin ? (
                          <button
                            type="button"
                            className="btn btn--ghost"
                            onClick={(event) => {
                              event.stopPropagation();
                              openMarkPaidForUnit(unitChooser, unit);
                            }}
                          >
                            Mark Paid
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <OwnerFormModal
        open={showOwnerForm}
        token={token!}
        initial={editOwner}
        onClose={() => setShowOwnerForm(false)}
        onSaved={() => {
          setTab('owners');
          invalidate();
          setToast({ message: 'Owner saved', tone: 'success' });
        }}
        onError={(message) => setToast({ message, tone: 'error' })}
      />

      <OwnerAssignmentFormModal
        open={showAssignmentForm}
        token={token!}
        owners={(summary?.owners ?? []).map((o) => ({
          id: o.ownerId,
          fullName: o.fullName,
          fatherOrSpouseName: null,
          phone: o.phone,
          alternatePhone: null,
          email: o.email,
          cnic: null,
          address: null,
          city: null,
          bankName: null,
          accountTitle: null,
          accountNumberOrIban: null,
          branchName: null,
          notes: null,
          isActive: o.isActive,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }))}
        properties={properties}
        initial={editAssignment}
        presetOwnerId={assignmentPreset.ownerId}
        presetPropertyId={assignmentPreset.propertyId}
        presetUnitId={assignmentPreset.unitId}
        onClose={() => setShowAssignmentForm(false)}
        onSaved={() => {
          setToast({ message: 'Unit assigned', tone: 'success' });
          invalidate();
        }}
        onError={(message) => setToast({ message, tone: 'error' })}
      />

      <OwnerPaymentFormModal
        open={Boolean(paymentStatement)}
        token={token!}
        statement={paymentStatement}
        onClose={() => setPaymentStatement(null)}
        onSaved={() => {
          setToast({ message: 'Payment recorded', tone: 'success' });
          invalidate();
        }}
        onError={(message) => setToast({ message, tone: 'error' })}
      />

      <OwnerDetailDrawer
        open={Boolean(detailOwnerId)}
        token={token!}
        ownerId={detailOwnerId}
        refreshVersion={detailVersion}
        periodLabel={period.label}
        isSuperAdmin={isSuperAdmin}
        onClose={() => setDetailOwnerId(null)}
        onPayStatement={(statementId) => {
          const match = statements.find((s) => s.id === statementId);
          if (match) {
            setDetailOwnerId(null);
            setPaymentStatement(match);
            return;
          }
          void (async () => {
            if (!token) return;
            try {
              const rows = await fetchOwnerStatements(token, {
                month,
                year,
              });
              const found = rows.find((s) => s.id === statementId);
              if (!found) {
                setToast({
                  message: 'Generate monthly statement first',
                  tone: 'error',
                });
                return;
              }
              setDetailOwnerId(null);
              setPaymentStatement(found);
            } catch (err) {
              setToast({ message: handleApiError(err), tone: 'error' });
            }
          })();
        }}
        onMarkPaid={(statement) => {
          if (!isSuperAdmin) {
            setToast({
              message: 'Only Super Admin can mark owner statements paid',
              tone: 'error',
            });
            return;
          }
          if (
            isAlreadyPaid(statement.paymentStatus, statement.remainingAmount)
          ) {
            setToast({ message: 'Already paid', tone: 'error' });
            return;
          }
          if (
            !canMarkStatementPaid(
              statement.paymentStatus,
              statement.remainingAmount,
            )
          ) {
            setToast({ message: 'Already paid', tone: 'error' });
            return;
          }
          setDetailOwnerId(null);
          setMarkPaidTarget(statement);
        }}
        onReviseAssignment={(assignment) => {
          setDetailOwnerId(null);
          setReviseAssignment(assignment);
        }}
        onEndAssignment={(assignment) => setEndTarget(assignment)}
        onError={(message) => setToast({ message, tone: 'error' })}
      />

      <OwnerReviseAgreementModal
        open={Boolean(reviseAssignment)}
        token={token!}
        assignment={reviseAssignment}
        onClose={() => setReviseAssignment(null)}
        onSaved={() => {
          setToast({ message: 'Agreement revised', tone: 'success' });
          invalidate();
        }}
        onError={(message) => setToast({ message, tone: 'error' })}
      />

      <ConfirmDialog
        open={Boolean(archiveTarget)}
        title="Archive owner?"
        message={`Archive ${archiveTarget?.fullName ?? ''}? Active assignments must be ended first.`}
        confirmLabel="Archive"
        busy={busy}
        onCancel={() => setArchiveTarget(null)}
        onConfirm={() => {
          void (async () => {
            if (!token || !archiveTarget) return;
            setBusy(true);
            try {
              await archiveOwner(token, archiveTarget.id);
              setArchiveTarget(null);
              setToast({ message: 'Owner archived', tone: 'success' });
              invalidate();
            } catch (err) {
              setToast({ message: handleApiError(err), tone: 'error' });
            } finally {
              setBusy(false);
            }
          })();
        }}
      />

      <ConfirmDialog
        open={Boolean(markPaidTarget)}
        title="Mark statement as paid?"
        message={
          markPaidTarget
            ? `Record a ${formatPkr(markPaidTarget.remainingAmount)} CASH payment for ${markPaidTarget.owner?.fullName ?? 'owner'} (${markPaidTarget.property?.name ?? ''} ${markPaidTarget.unit?.unitNumber ?? ''})? Status will turn green Paid. Note: “Marked paid by Super Admin”.`
            : ''
        }
        confirmLabel="Mark Paid"
        busy={busy}
        onCancel={() => setMarkPaidTarget(null)}
        onConfirm={() => {
          const target = markPaidTarget;
          void (async () => {
            if (!token) {
              setToast({
                message: 'Sign in again to mark paid',
                tone: 'error',
              });
              return;
            }
            if (!target?.id) {
              setToast({
                message: 'Generate monthly statement first',
                tone: 'error',
              });
              setMarkPaidTarget(null);
              return;
            }
            if (
              isAlreadyPaid(target.paymentStatus, target.remainingAmount)
            ) {
              setToast({ message: 'Already paid', tone: 'error' });
              setMarkPaidTarget(null);
              return;
            }
            setBusy(true);
            try {
              await markOwnerStatementPaid(token, {
                ownerMonthlyStatementId: target.id,
              });
              setMarkPaidTarget(null);
              setToast({
                message: 'Marked paid — status is now Paid',
                tone: 'success',
              });
              invalidate();
            } catch (err) {
              console.error('Mark paid failed', err);
              setToast({ message: handleApiError(err), tone: 'error' });
            } finally {
              setBusy(false);
            }
          })();
        }}
      />

      <ConfirmDialog
        open={Boolean(endTarget)}
        title="End assignment?"
        message={`End ownership for ${endTarget?.owner?.fullName ?? ''} on this unit?`}
        confirmLabel="End Assignment"
        busy={busy}
        onCancel={() => setEndTarget(null)}
        onConfirm={() => {
          void (async () => {
            if (!token || !endTarget) return;
            setBusy(true);
            try {
              await endOwnerAssignment(token, endTarget.id);
              setEndTarget(null);
              setToast({ message: 'Assignment ended', tone: 'success' });
              invalidate();
            } catch (err) {
              setToast({ message: handleApiError(err), tone: 'error' });
            } finally {
              setBusy(false);
            }
          })();
        }}
      />

      <FormModal
        open={showGenerate}
        title="Generate Monthly Statements"
        onClose={() => setShowGenerate(false)}
      >
        <form
          className="form-grid"
          onSubmit={(e) => {
            e.preventDefault();
            void (async () => {
              if (!token) return;
              setBusy(true);
              try {
                const result = await generateOwnerStatements(token, {
                  month: Number(genMonth),
                  year: Number(genYear),
                  propertyId: propertyId || undefined,
                });
                setShowGenerate(false);
                setToast({
                  message: `Created ${result.created}, skipped ${result.skipped}, failed ${result.failed}`,
                  tone: 'success',
                });
                invalidate();
              } catch (err) {
                setToast({ message: handleApiError(err), tone: 'error' });
              } finally {
                setBusy(false);
              }
            })();
          }}
        >
          <div className="form-grid form-grid--2">
            <label className="form-field">
              <span>Month</span>
              <input
                type="number"
                min={1}
                max={12}
                value={genMonth}
                onChange={(e) => setGenMonth(e.target.value)}
              />
            </label>
            <label className="form-field">
              <span>Year</span>
              <input
                type="number"
                min={2000}
                max={2100}
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
            <button type="submit" className="btn btn--primary" disabled={busy}>
              {busy ? 'Working…' : 'Generate'}
            </button>
          </div>
        </form>
      </FormModal>

      <FormModal
        open={Boolean(reverseTarget)}
        title="Reverse Owner Payment"
        onClose={() => setReverseTarget(null)}
      >
        <form
          className="form-grid"
          onSubmit={(e) => {
            e.preventDefault();
            void (async () => {
              if (!token || !reverseTarget) return;
              setBusy(true);
              try {
                await reverseOwnerPayment(
                  token,
                  reverseTarget.id,
                  reverseReason.trim(),
                );
                setReverseTarget(null);
                setToast({ message: 'Payment reversed', tone: 'success' });
                invalidate();
              } catch (err) {
                setToast({ message: handleApiError(err), tone: 'error' });
              } finally {
                setBusy(false);
              }
            })();
          }}
        >
          <label className="form-field">
            <span>Reason</span>
            <textarea
              required
              minLength={3}
              rows={3}
              value={reverseReason}
              onChange={(e) => setReverseReason(e.target.value)}
            />
          </label>
          <div className="form-actions">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setReverseTarget(null)}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn--primary" disabled={busy}>
              {busy ? 'Working…' : 'Reverse'}
            </button>
          </div>
        </form>
      </FormModal>

      {toast.message ? (
        <Toast
          message={toast.message}
          tone={toast.tone}
          onClose={() => setToast({ message: '', tone: 'success' })}
        />
      ) : null}
    </div>
  );
}
