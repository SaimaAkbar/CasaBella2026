import { useEffect, useMemo, useState } from 'react';
import { fetchExpenseCategories } from '../api/expense-categories';
import {
  archiveElectricityReading,
  fetchElectricityRate,
  fetchElectricityRateHistory,
  fetchElectricityReadings,
  generateElectricityMonth,
  initializeElectricityBill,
} from '../api/electricity-readings';
import {
  archiveExpense,
  fetchExpense,
  fetchExpenseMonthlySummary,
  fetchExpenses,
  fetchPropertyMonthView,
} from '../api/expenses';
import { fetchProperties } from '../api/properties';
import { fetchUnits } from '../api/units';
import { SummaryCard } from '../components/dashboard/SummaryCard';
import { BulkExpenseModal } from '../components/expenses/BulkExpenseModal';
import { ElectricityRateFormModal } from '../components/expenses/ElectricityRateFormModal';
import { EnterCurrentReadingModal } from '../components/expenses/EnterCurrentReadingModal';
import { ExpenseCategoryFormModal } from '../components/expenses/ExpenseCategoryFormModal';
import { ExpenseDetailModal } from '../components/expenses/ExpenseDetailModal';
import { ExpenseFormModal } from '../components/expenses/ExpenseFormModal';
import { ExpenseStatusTick } from '../components/expenses/ExpenseStatusTick';
import { OtherExpenseFormModal } from '../components/expenses/OtherExpenseFormModal';
import { RecordExpensePaymentModal } from '../components/expenses/RecordExpensePaymentModal';
import { UnitExpenseDrawer } from '../components/expenses/UnitExpenseDrawer';
import { PageHeader } from '../components/PageHeader';
import { DataTable, type DataTableColumn } from '../components/ui/DataTable';
import { DateTimeDisplay } from '../components/ui/DateTimeDisplay';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { FilterBar } from '../components/ui/FilterBar';
import { FormModal } from '../components/ui/FormModal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { LoadingState } from '../components/ui/LoadingState';
import { MoneyDisplay } from '../components/ui/MoneyDisplay';
import { RowMoreMenu } from '../components/ui/RowMoreMenu';
import { Toast } from '../components/ui/Toast';
import { useAuth } from '../context/AuthContext';
import { useApiErrorHandler } from '../hooks/useApiErrorHandler';
import { formatPkr } from '../lib/format';
import type {
  ElectricityRateHistory,
  ElectricityReading,
  Expense,
  ExpenseCategory,
  ExpenseMonthlySummary,
  ExpenseTabKey,
  PaymentMethod,
  PropertyMonthView,
  PropertyMonthViewUnit,
  UnitMonthExpenseStatus,
} from '../types/expense';
import type { Property } from '../types/property';
import type { Unit } from '../types/unit';
import '../styles/forms.css';
import './ExpensesPage.css';

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
] as const;

const TABS: Array<{
  key: ExpenseTabKey;
  label: string;
  categoryName: string | null;
}> = [
  { key: 'overview', label: 'Overview', categoryName: null },
  { key: 'electricity', label: 'Electricity Bills', categoryName: 'Electricity' },
  { key: 'maintenance', label: 'Maintenance', categoryName: 'Maintenance' },
  { key: 'society', label: 'Society', categoryName: 'Society Bill' },
  { key: 'water', label: 'Water Bill', categoryName: 'Water' },
  { key: 'internet', label: 'Internet', categoryName: 'Internet' },
  { key: 'cleaning', label: 'Cleaning', categoryName: 'Cleaning' },
  { key: 'liftBill', label: 'Lift Bill', categoryName: 'Lift Bill' },
  {
    key: 'liftMaintenance',
    label: 'Lift Maintenance',
    categoryName: 'Lift Maintenance',
  },
  { key: 'other', label: 'Other Expenses', categoryName: 'Other' },
];

type CategoryUnitRow = {
  unitId: string;
  unitNumber: string;
  floor: string | null;
  amount: string;
  paid: string;
  remaining: string;
  status: UnitMonthExpenseStatus;
  primaryExpenseId: string | null;
};

type ElectricityUnitRow = {
  unitId: string;
  unitNumber: string;
  floor: string | null;
  reading: ElectricityReading | null;
};

type PendingDelete =
  | { kind: 'expense'; expense: Expense }
  | { kind: 'expenses'; label: string; ids: string[] }
  | { kind: 'reading'; reading: ElectricityReading };

const DEFAULT_PROPERTY_NAME = 'casabella';

function defaultExpensePropertyId(properties: Property[]): string {
  const active = properties.filter((property) => property.isActive !== false);
  const pool = active.length > 0 ? active : properties;
  const exact = pool.find(
    (property) => property.name.trim().toLowerCase() === DEFAULT_PROPERTY_NAME,
  );
  if (exact) return exact.id;
  const partial = pool.find((property) =>
    property.name.toLowerCase().includes(DEFAULT_PROPERTY_NAME),
  );
  return partial?.id ?? pool[0]?.id ?? '';
}

function periodLabel(month: number, year: number) {
  return `${MONTH_NAMES[month - 1] ?? `Month ${month}`} ${year}`;
}

function shortPeriod(month: number, year: number) {
  return `${(MONTH_NAMES[month - 1] ?? '').slice(0, 3)} ${year}`;
}

function moneySum(values: string[]) {
  return values
    .reduce((sum, value) => sum + (Number(value) || 0), 0)
    .toFixed(2);
}

function deriveRowsStatus(rows: Expense[]): UnitMonthExpenseStatus {
  if (!rows.length) return 'NO_CHARGE';
  const remaining = rows.reduce(
    (sum, row) => sum + (Number(row.remainingAmount) || 0),
    0,
  );
  const paid = rows.reduce((sum, row) => sum + (Number(row.paidAmount) || 0), 0);
  if (rows.some((row) => row.paymentStatus === 'OVERDUE') && remaining > 0) {
    return 'OVERDUE';
  }
  if (remaining <= 0) return 'PAID';
  if (paid > 0) return 'PARTIAL';
  return 'UNPAID';
}

function categoryAmountDisplay(
  unit: PropertyMonthViewUnit,
  key: keyof PropertyMonthViewUnit['expenses'],
) {
  const amount = unit.expenses[key];
  if (
    key === 'electricity' &&
    unit.electricityReadingRequired &&
    Number(amount) === 0
  ) {
    return <em className="expenses-reading-required">Reading Required</em>;
  }
  return <MoneyDisplay value={amount} />;
}

export function ExpensesPage() {
  const { token, user } = useAuth();
  const handleApiError = useApiErrorHandler();

  const role = user?.role;
  const isSuperAdmin = role === 'SUPER_ADMIN';
  const isAdmin = role === 'ADMIN';
  const isReceptionist = role === 'RECEPTIONIST';
  const canManage = isSuperAdmin || isAdmin;
  const canViewFinance = !isReceptionist;
  const canCreate = Boolean(role);
  const canElectricity = canManage;
  const canPay = canManage;
  const canBulk = canManage;
  const canAddCategory = isSuperAdmin || isAdmin;

  const [tab, setTab] = useState<ExpenseTabKey>('overview');
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [propertyId, setPropertyId] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<
    UnitMonthExpenseStatus | ''
  >('');
  const [search, setSearch] = useState('');
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | ''>('');

  const [properties, setProperties] = useState<Property[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [summary, setSummary] = useState<ExpenseMonthlySummary | null>(null);
  const [monthView, setMonthView] = useState<PropertyMonthView | null>(null);
  const [readings, setReadings] = useState<ElectricityReading[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [rate, setRate] = useState('95');
  const [rateHistory, setRateHistory] = useState<ElectricityRateHistory[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<{
    message: string;
    tone: 'success' | 'error';
  }>({ message: '', tone: 'success' });

  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [showPropertyExpense, setShowPropertyExpense] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [showInit, setShowInit] = useState(false);
  const [showRateForm, setShowRateForm] = useState(false);
  const [showRateHistory, setShowRateHistory] = useState(false);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [drawerUnit, setDrawerUnit] = useState<PropertyMonthViewUnit | null>(
    null,
  );
  const [formPrefill, setFormPrefill] = useState<{
    propertyId?: string;
    unitId?: string;
    categoryName?: string;
  }>({});
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);
  const [readingTarget, setReadingTarget] =
    useState<ElectricityReading | null>(null);
  const [paymentTarget, setPaymentTarget] = useState<{
    mode: 'expense' | 'electricity';
    id: string;
    label: string;
    finalBill: string;
    alreadyPaid: string;
    remaining: string;
  } | null>(null);

  const [initPropertyId, setInitPropertyId] = useState('');
  const [initUnits, setInitUnits] = useState<Unit[]>([]);
  const [initRows, setInitRows] = useState<
    Record<string, { previous: string; current: string }>
  >({});
  const [initDueDate, setInitDueDate] = useState('');
  const [initBusy, setInitBusy] = useState(false);
  const [generateBusy, setGenerateBusy] = useState(false);

  const activeTab = TABS.find((t) => t.key === tab)!;
  const viewing = periodLabel(month, year);
  const short = shortPeriod(month, year);
  const selectedProperty =
    properties.find((p) => p.id === propertyId) ??
    monthView?.property ??
    null;

  const years = useMemo(
    () => Array.from({ length: 6 }, (_, i) => now.getFullYear() - i),
    [],
  );

  async function loadData() {
    if (!token || !canViewFinance) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const [cats, monthly, rateRow] = await Promise.all([
        fetchExpenseCategories(token),
        fetchExpenseMonthlySummary(token, {
          month,
          year,
          propertyId: propertyId || undefined,
        }),
        fetchElectricityRate(token).catch(() => ({ ratePerUnit: '95' })),
      ]);
      setCategories(cats);
      setSummary(monthly);
      setRate(rateRow.ratePerUnit);

      if (!propertyId) {
        setMonthView(null);
        setReadings([]);
        setExpenses([]);
        return;
      }

      const view = await fetchPropertyMonthView(token, {
        propertyId,
        month,
        year,
        search: search.trim() || undefined,
        status: paymentStatus || undefined,
      });
      setMonthView(view);

      if (tab === 'electricity') {
        const rows = await fetchElectricityReadings(token, {
          propertyId,
          billingMonth: month,
          billingYear: year,
        });
        setReadings(rows);
        setExpenses([]);
      } else if (tab !== 'overview') {
        const categoryName =
          tab === 'other' ? undefined : activeTab.categoryName ?? undefined;
        let rows = await fetchExpenses(token, {
          categoryName,
          propertyId,
          paymentMethod,
          month,
          year,
          date: selectedDate || undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          search: search.trim() || undefined,
        });
        if (tab === 'other') {
          const systemTabNames = new Set(
            TABS.filter((t) => t.categoryName && t.key !== 'other').map(
              (t) => t.categoryName as string,
            ),
          );
          rows = rows.filter(
            (e) =>
              !systemTabNames.has(e.category?.name ?? '') ||
              e.category?.name === 'Other',
          );
        }
        setExpenses(rows);
        setReadings([]);
      } else {
        setExpenses([]);
        setReadings([]);
      }
    } catch (err) {
      setError(handleApiError(err, 'Unable to load expenses.'));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [
    token,
    tab,
    month,
    year,
    propertyId,
    paymentStatus,
    search,
    selectedDate,
    startDate,
    endDate,
    paymentMethod,
  ]);

  useEffect(() => {
    if (!token) return;
    void fetchProperties(token)
      .then((rows) => {
        setProperties(rows);
        setPropertyId((current) => current || defaultExpensePropertyId(rows));
      })
      .catch(() => setProperties([]));
  }, [token]);

  useEffect(() => {
    if (!token || !showInit) return;
    const pid = initPropertyId || propertyId;
    if (!pid) {
      setInitUnits([]);
      setInitRows({});
      return;
    }
    if (!initPropertyId && propertyId) setInitPropertyId(propertyId);
    void fetchUnits(token, { propertyId: pid, isActive: true })
      .then((rows) => {
        setInitUnits(rows);
        setInitRows((prev) => {
          const next: Record<string, { previous: string; current: string }> =
            {};
          for (const unit of rows) {
            next[unit.id] = prev[unit.id] ?? { previous: '', current: '' };
          }
          return next;
        });
      })
      .catch(() => {
        setInitUnits([]);
        setInitRows({});
      });
  }, [token, showInit, initPropertyId, propertyId]);

  function clearFilters() {
    setPaymentStatus('');
    setSearch('');
    setSelectedDate('');
    setStartDate('');
    setEndDate('');
    setPaymentMethod('');
    setMonth(now.getMonth() + 1);
    setYear(now.getFullYear());
    setPropertyId(defaultExpensePropertyId(properties));
  }

  async function openExpenseDetail(expense: Expense) {
    if (!token) return;
    try {
      const full = await fetchExpense(token, expense.id);
      setSelectedExpense(full);
      setShowDetail(true);
    } catch (err) {
      setToast({
        message: handleApiError(err, 'Unable to load expense.'),
        tone: 'error',
      });
    }
  }

  async function handleGenerateMonth() {
    if (!token || !propertyId || generateBusy) return;
    setGenerateBusy(true);
    try {
      const result = await generateElectricityMonth(token, {
        propertyId,
        billingMonth: month,
        billingYear: year,
      });
      setToast({
        message: `Generated ${result.created.length} bills (${result.skipped.length} skipped).`,
        tone: 'success',
      });
      await loadData();
    } catch (err) {
      setToast({
        message: handleApiError(err, 'Unable to generate month.'),
        tone: 'error',
      });
    } finally {
      setGenerateBusy(false);
    }
  }

  async function handleInitializeAll(event: React.FormEvent) {
    event.preventDefault();
    if (!token || initBusy) return;
    const pid = initPropertyId || propertyId;
    if (!pid) {
      setToast({ message: 'Select a property first.', tone: 'error' });
      return;
    }
    const entries = initUnits
      .map((unit) => ({
        unit,
        previous: Number(initRows[unit.id]?.previous),
        current: Number(initRows[unit.id]?.current),
      }))
      .filter(
        (row) =>
          Number.isFinite(row.previous) &&
          Number.isFinite(row.current) &&
          initRows[row.unit.id]?.previous !== '' &&
          initRows[row.unit.id]?.current !== '',
      );
    if (!entries.length) {
      setToast({
        message: 'Enter previous and current readings for at least one unit.',
        tone: 'error',
      });
      return;
    }
    setInitBusy(true);
    try {
      for (const entry of entries) {
        await initializeElectricityBill(token, {
          propertyId: pid,
          unitId: entry.unit.id,
          previousReading: entry.previous,
          currentReading: entry.current,
          billingMonth: month,
          billingYear: year,
          dueDate: initDueDate || undefined,
        });
      }
      setShowInit(false);
      setToast({
        message: `Initialized ${entries.length} meter reading(s).`,
        tone: 'success',
      });
      await loadData();
    } catch (err) {
      setToast({
        message: handleApiError(err, 'Unable to initialize meters.'),
        tone: 'error',
      });
    } finally {
      setInitBusy(false);
    }
  }

  async function openRateHistory() {
    if (!token) return;
    try {
      const rows = await fetchElectricityRateHistory(token);
      setRateHistory(rows);
      setShowRateHistory(true);
    } catch (err) {
      setToast({
        message: handleApiError(err, 'Unable to load rate history.'),
        tone: 'error',
      });
    }
  }

  function openQuickAdd(unit?: PropertyMonthViewUnit) {
    setEditingExpense(null);
    setFormPrefill({
      propertyId: propertyId || undefined,
      unitId: unit?.unitId,
      categoryName: activeTab.categoryName ?? undefined,
    });
    setShowExpenseForm(true);
  }

  async function openEditExpense(expenseId: string) {
    if (!token) return;
    try {
      const full = await fetchExpense(token, expenseId);
      setFormPrefill({});
      setEditingExpense(full);
      setShowDetail(false);
      setShowExpenseForm(true);
    } catch (err) {
      setToast({
        message: handleApiError(err, 'Unable to load expense for editing.'),
        tone: 'error',
      });
    }
  }

  async function openEditUnitCharge(unit: PropertyMonthViewUnit) {
    if (!token || !propertyId) return;
    try {
      const rows = await fetchExpenses(token, {
        propertyId,
        unitId: unit.unitId,
        month,
        year,
        categoryName: activeTab.categoryName ?? undefined,
      });
      const usable = rows.filter((row) => !row.excludeFromFinancials);
      if (!usable.length) {
        openQuickAdd(unit);
        return;
      }
      await openEditExpense(usable[0].id);
    } catch (err) {
      setToast({
        message: handleApiError(err, 'Unable to load expense for editing.'),
        tone: 'error',
      });
    }
  }

  async function requestDeleteUnitCharges(
    unit: PropertyMonthViewUnit,
    categoryName?: string | null,
  ) {
    if (!token || !propertyId) return;
    try {
      const rows = await fetchExpenses(token, {
        propertyId,
        unitId: unit.unitId,
        month,
        year,
        categoryName: categoryName ?? undefined,
      });
      const usable = rows.filter((row) => !row.excludeFromFinancials);
      if (!usable.length) {
        setToast({
          message: `No charge to delete for unit ${unit.unitNumber}.`,
          tone: 'error',
        });
        return;
      }
      setPendingDelete({
        kind: 'expenses',
        label: `${unit.unitNumber} — ${categoryName ? `${categoryName} — ` : ''}${viewing}`,
        ids: usable.map((row) => row.id),
      });
    } catch (err) {
      setToast({
        message: handleApiError(err, 'Unable to prepare delete.'),
        tone: 'error',
      });
    }
  }

  async function confirmPendingDelete() {
    if (!token || !pendingDelete) return;
    setDeleting(true);
    try {
      if (pendingDelete.kind === 'reading') {
        await archiveElectricityReading(token, pendingDelete.reading.id);
      } else if (pendingDelete.kind === 'expense') {
        await archiveExpense(token, pendingDelete.expense.id);
      } else {
        for (const id of pendingDelete.ids) {
          await archiveExpense(token, id);
        }
      }
      setPendingDelete(null);
      setShowDetail(false);
      setSelectedExpense(null);
      setToast({ message: 'Deleted. History is kept as archived.', tone: 'success' });
      void loadData();
    } catch (err) {
      setToast({
        message: handleApiError(err, 'Unable to delete.'),
        tone: 'error',
      });
    } finally {
      setDeleting(false);
    }
  }

  async function openUnitHistory(unit: PropertyMonthViewUnit) {
    if (!token || !propertyId) return;
    try {
      const rows = await fetchExpenses(token, {
        propertyId,
        unitId: unit.unitId,
        month,
        year,
      });
      if (!rows.length) {
        setToast({
          message: `No expense history for unit ${unit.unitNumber} in ${viewing}.`,
          tone: 'error',
        });
        return;
      }
      await openExpenseDetail(rows[0]);
    } catch (err) {
      setToast({
        message: handleApiError(err, 'Unable to load unit history.'),
        tone: 'error',
      });
    }
  }

  async function openUnitPayment(unit: PropertyMonthViewUnit) {
    if (!token || !propertyId) return;
    try {
      const rows = await fetchExpenses(token, {
        propertyId,
        unitId: unit.unitId,
        month,
        year,
      });
      const unpaid = rows.find(
        (row) =>
          !row.excludeFromFinancials &&
          row.paymentStatus !== 'PAID' &&
          Number(row.remainingAmount) > 0,
      );
      if (!unpaid) {
        setToast({
          message: 'No unpaid expenses for this unit.',
          tone: 'error',
        });
        return;
      }
      setPaymentTarget({
        mode: 'expense',
        id: unpaid.id,
        label: unpaid.expenseNumber,
        finalBill: unpaid.amount,
        alreadyPaid: unpaid.paidAmount,
        remaining: unpaid.remainingAmount,
      });
    } catch (err) {
      setToast({
        message: handleApiError(err, 'Unable to open payment.'),
        tone: 'error',
      });
    }
  }

  function openUnitElectricity(unit: PropertyMonthViewUnit) {
    const reading =
      readings.find((row) => row.unitId === unit.unitId) ??
      (unit.electricityReadingId
        ? ({
            id: unit.electricityReadingId,
            propertyId,
            unitId: unit.unitId,
            previousUnits: '0',
            currentUnits: null,
            consumedUnits: null,
            ratePerUnit: rate,
            calculatedAmount: '0',
            readingDate: new Date().toISOString(),
            billingMonth: month,
            billingYear: year,
            notes: null,
            expenseId: null,
          } satisfies ElectricityReading)
        : null);
    if (!reading) {
      setToast({
        message:
          'No electricity record yet. Use Initialize Readings or Generate Month first.',
        tone: 'error',
      });
      setTab('electricity');
      return;
    }
    setReadingTarget(reading);
  }

  const categoryUnitRows: CategoryUnitRow[] = useMemo(() => {
    if (!monthView || tab === 'overview' || tab === 'electricity') return [];
    const byUnit = new Map<string, Expense[]>();
    for (const expense of expenses) {
      if (!expense.unitId || expense.excludeFromFinancials) continue;
      const list = byUnit.get(expense.unitId) ?? [];
      list.push(expense);
      byUnit.set(expense.unitId, list);
    }
    return monthView.units.map((unit) => {
      const rows = byUnit.get(unit.unitId) ?? [];
      const amountKey =
        tab === 'other'
          ? 'other'
          : (tab as keyof PropertyMonthViewUnit['expenses']);
      const amountFromView =
        amountKey in unit.expenses
          ? unit.expenses[amountKey as keyof PropertyMonthViewUnit['expenses']]
          : '0';
      const amount =
        rows.length > 0
          ? moneySum(rows.map((row) => row.amount))
          : amountFromView;
      const paid = moneySum(rows.map((row) => row.paidAmount));
      const remaining = moneySum(rows.map((row) => row.remainingAmount));
      return {
        unitId: unit.unitId,
        unitNumber: unit.unitNumber,
        floor: unit.floor,
        amount,
        paid,
        remaining,
        status: deriveRowsStatus(rows),
        primaryExpenseId: rows[0]?.id ?? null,
      };
    });
  }, [monthView, expenses, tab]);

  const electricityUnitRows: ElectricityUnitRow[] = useMemo(() => {
    if (!monthView) return [];
    const byUnit = new Map(readings.map((row) => [row.unitId ?? '', row]));
    return monthView.units.map((unit) => ({
      unitId: unit.unitId,
      unitNumber: unit.unitNumber,
      floor: unit.floor,
      reading: byUnit.get(unit.unitId) ?? null,
    }));
  }, [monthView, readings]);

  const propertyLevelExpenses = useMemo(
    () =>
      expenses.filter(
        (row) =>
          !row.unitId &&
          (row.expenseScope === 'PROPERTY' || row.expenseScope === 'GENERAL'),
      ),
    [expenses],
  );

  const overviewColumns: DataTableColumn<PropertyMonthViewUnit>[] = [
    {
      key: 'unit',
      header: 'Unit',
      render: (row) => (
        <button
          type="button"
          className="expenses-unit-link"
          onClick={() => setDrawerUnit(row)}
        >
          {row.unitNumber}
        </button>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (row) => (row.unitType === 'ROOM' ? 'Room' : 'Apartment'),
    },
    {
      key: 'floor',
      header: 'Floor',
      render: (row) => row.floor ?? '—',
    },
    {
      key: 'electricity',
      header: 'Electricity',
      render: (row) => categoryAmountDisplay(row, 'electricity'),
    },
    {
      key: 'maintenance',
      header: 'Maintenance',
      render: (row) => categoryAmountDisplay(row, 'maintenance'),
    },
    {
      key: 'society',
      header: 'Society',
      render: (row) => categoryAmountDisplay(row, 'society'),
    },
    {
      key: 'water',
      header: 'Water',
      render: (row) => categoryAmountDisplay(row, 'water'),
    },
    {
      key: 'internet',
      header: 'Internet',
      render: (row) => categoryAmountDisplay(row, 'internet'),
    },
    {
      key: 'cleaning',
      header: 'Cleaning',
      render: (row) => categoryAmountDisplay(row, 'cleaning'),
    },
    {
      key: 'lift',
      header: 'Lift',
      render: (row) => (
        <MoneyDisplay
          value={moneySum([row.expenses.liftBill, row.expenses.liftMaintenance])}
        />
      ),
    },
    {
      key: 'other',
      header: 'Other',
      render: (row) => categoryAmountDisplay(row, 'other'),
    },
    {
      key: 'total',
      header: 'Total',
      render: (row) => <MoneyDisplay value={row.totalExpense} />,
    },
    {
      key: 'paid',
      header: 'Paid',
      render: (row) => <MoneyDisplay value={row.paid} />,
    },
    {
      key: 'remaining',
      header: 'Remaining',
      render: (row) => <MoneyDisplay value={row.remaining} />,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <ExpenseStatusTick status={row.status} />,
    },
    {
      key: 'actions',
      header: 'Action',
      render: (row) => (
        <RowMoreMenu
          items={[
            {
              id: 'details',
              label: 'Details',
              onClick: () => setDrawerUnit(row),
            },
            {
              id: 'add',
              label: '+ Add Expense',
              hidden: !canCreate,
              onClick: () => openQuickAdd(row),
            },
            {
              id: 'edit',
              label: 'Edit',
              hidden: !canManage,
              onClick: () => void openEditUnitCharge(row),
            },
            {
              id: 'pay',
              label: 'Record Payment',
              hidden: !canPay || Number(row.remaining) <= 0,
              onClick: () => void openUnitPayment(row),
            },
            {
              id: 'delete',
              label: 'Delete',
              danger: true,
              hidden: !isSuperAdmin,
              onClick: () => void requestDeleteUnitCharges(row),
            },
          ]}
        />
      ),
    },
  ];

  const electricityColumns: DataTableColumn<ElectricityUnitRow>[] = [
    {
      key: 'unit',
      header: 'Unit',
      render: (row) => row.unitNumber,
    },
    {
      key: 'floor',
      header: 'Floor',
      render: (row) => row.floor ?? '—',
    },
    {
      key: 'prev',
      header: 'Previous',
      render: (row) =>
        row.reading
          ? (row.reading.previousReading ?? row.reading.previousUnits)
          : '—',
    },
    {
      key: 'curr',
      header: 'Current',
      render: (row) =>
        row.reading
          ? (row.reading.currentReading ?? row.reading.currentUnits ?? '—')
          : (
              <em className="expenses-reading-required">Reading Required</em>
            ),
    },
    {
      key: 'units',
      header: 'Units',
      render: (row) =>
        row.reading
          ? (row.reading.unitsConsumed ?? row.reading.consumedUnits ?? '—')
          : '—',
    },
    {
      key: 'rate',
      header: 'Rate',
      render: (row) =>
        row.reading ? <MoneyDisplay value={row.reading.ratePerUnit} /> : '—',
    },
    {
      key: 'base',
      header: 'Base Bill',
      render: (row) =>
        row.reading ? (
          <MoneyDisplay
            value={row.reading.baseBill ?? row.reading.calculatedAmount}
          />
        ) : (
          '—'
        ),
    },
    {
      key: 'due',
      header: 'Due Date',
      render: (row) =>
        row.reading?.dueDate ? (
          <DateTimeDisplay value={row.reading.dueDate} />
        ) : (
          '—'
        ),
    },
    {
      key: 'fine',
      header: '5% Fine',
      render: (row) =>
        row.reading ? (
          <MoneyDisplay value={row.reading.lateFineAmount ?? '0'} />
        ) : (
          '—'
        ),
    },
    {
      key: 'final',
      header: 'Final Bill',
      render: (row) =>
        row.reading ? (
          <MoneyDisplay
            value={
              row.reading.finalBill ?? row.reading.expense?.amount ?? '0'
            }
          />
        ) : (
          '—'
        ),
    },
    {
      key: 'paid',
      header: 'Paid',
      render: (row) =>
        row.reading ? (
          <MoneyDisplay value={row.reading.paidAmount ?? '0'} />
        ) : (
          '—'
        ),
    },
    {
      key: 'remaining',
      header: 'Remaining',
      render: (row) =>
        row.reading ? (
          <MoneyDisplay value={row.reading.remainingAmount ?? '0'} />
        ) : (
          '—'
        ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) =>
        row.reading ? (
          <ExpenseStatusTick status={row.reading.paymentStatus ?? 'UNPAID'} />
        ) : (
          <em className="expenses-reading-required">Reading Required</em>
        ),
    },
    {
      key: 'actions',
      header: 'Action',
      render: (row) => (
        <RowMoreMenu
          items={[
            {
              id: 'enter',
              label: 'Enter Reading',
              hidden: !(
                canElectricity &&
                row.reading &&
                row.reading.currentUnits == null
              ),
              onClick: () => setReadingTarget(row.reading),
            },
            {
              id: 'edit',
              label: 'Edit',
              hidden: !(
                canElectricity &&
                row.reading &&
                row.reading.currentUnits != null
              ),
              onClick: () => setReadingTarget(row.reading),
            },
            {
              id: 'pay',
              label: 'Record Payment',
              hidden: !(
                canPay &&
                row.reading?.expenseId &&
                row.reading.paymentStatus !== 'PAID' &&
                row.reading.currentUnits != null
              ),
              onClick: () =>
                setPaymentTarget({
                  mode: 'electricity',
                  id: row.reading!.id,
                  label: `${selectedProperty?.name ?? ''} — ${row.unitNumber}`,
                  finalBill:
                    row.reading!.finalBill ??
                    row.reading!.expense?.amount ??
                    '0',
                  alreadyPaid: row.reading!.paidAmount ?? '0',
                  remaining: row.reading!.remainingAmount ?? '0',
                }),
            },
            {
              id: 'delete',
              label: 'Delete',
              danger: true,
              hidden: !isSuperAdmin || !row.reading,
              onClick: () =>
                setPendingDelete({ kind: 'reading', reading: row.reading! }),
            },
          ]}
        />
      ),
    },
  ];

  const categoryColumns: DataTableColumn<CategoryUnitRow>[] = [
    {
      key: 'unit',
      header: 'Unit',
      render: (row) => row.unitNumber,
    },
    {
      key: 'floor',
      header: 'Floor',
      render: (row) => row.floor ?? '—',
    },
    {
      key: 'amount',
      header: 'Amount',
      render: (row) =>
        Number(row.amount) === 0 && row.status === 'NO_CHARGE' ? (
          <MoneyDisplay value="0" />
        ) : (
          <MoneyDisplay value={row.amount} />
        ),
    },
    {
      key: 'paid',
      header: 'Paid',
      render: (row) => <MoneyDisplay value={row.paid} />,
    },
    {
      key: 'remaining',
      header: 'Remaining',
      render: (row) => <MoneyDisplay value={row.remaining} />,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <ExpenseStatusTick status={row.status} />,
    },
    {
      key: 'actions',
      header: 'Action',
      render: (row) => {
        const unit = monthView?.units.find((item) => item.unitId === row.unitId);
        return (
          <RowMoreMenu
            items={[
              {
                id: 'add',
                label: '+ Add Expense',
                hidden: !canCreate,
                onClick: () => {
                  if (unit) openQuickAdd(unit);
                },
              },
              {
                id: 'edit',
                label: 'Edit',
                hidden: !canManage || !row.primaryExpenseId,
                onClick: () => {
                  if (row.primaryExpenseId) {
                    void openEditExpense(row.primaryExpenseId);
                  }
                },
              },
              {
                id: 'pay',
                label: 'Record Payment',
                hidden: !(
                  canPay &&
                  row.primaryExpenseId &&
                  row.status !== 'PAID' &&
                  row.status !== 'NO_CHARGE'
                ),
                onClick: () =>
                  setPaymentTarget({
                    mode: 'expense',
                    id: row.primaryExpenseId!,
                    label: `${selectedProperty?.name ?? ''} — ${row.unitNumber}`,
                    finalBill: row.amount,
                    alreadyPaid: row.paid,
                    remaining: row.remaining,
                  }),
              },
              {
                id: 'view',
                label: 'View',
                hidden: !row.primaryExpenseId,
                onClick: () => {
                  const expense = expenses.find(
                    (item) => item.id === row.primaryExpenseId,
                  );
                  if (expense) void openExpenseDetail(expense);
                },
              },
              {
                id: 'delete',
                label: 'Delete',
                danger: true,
                hidden: !isSuperAdmin || !row.primaryExpenseId || !unit,
                onClick: () => {
                  if (unit) {
                    void requestDeleteUnitCharges(unit, activeTab.categoryName);
                  }
                },
              },
            ]}
          />
        );
      },
    },
  ];

  const otherExpenseColumns: DataTableColumn<Expense>[] = [
    {
      key: 'date',
      header: 'Date',
      render: (row) => <DateTimeDisplay value={row.expenseDate} />,
    },
    {
      key: 'name',
      header: 'Expense Name',
      render: (row) =>
        row.expenseName || row.category?.name || row.description || '—',
    },
    {
      key: 'scope',
      header: 'Scope',
      render: (row) => {
        if (row.expenseScope === 'GENERAL') return 'General';
        if (row.expenseScope === 'PROPERTY') {
          return row.excludeFromFinancials ? 'Property (allocated)' : 'Property';
        }
        if (row.expenseScope === 'UNIT') {
          return row.parentExpenseId ? 'Unit (allocated)' : 'Unit';
        }
        return row.expenseScope.replaceAll('_', ' ');
      },
    },
    {
      key: 'amount',
      header: 'Amount',
      render: (row) => <MoneyDisplay value={row.amount} />,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <ExpenseStatusTick status={row.paymentStatus} />,
    },
    {
      key: 'actions',
      header: 'Action',
      render: (row) => (
        <RowMoreMenu
          items={[
            {
              id: 'view',
              label: 'View',
              onClick: () => void openExpenseDetail(row),
            },
            {
              id: 'edit',
              label: 'Edit',
              hidden: !canManage,
              onClick: () => void openEditExpense(row.id),
            },
            {
              id: 'pay',
              label: 'Record Payment',
              hidden: !(
                canPay &&
                row.paymentStatus !== 'PAID' &&
                !row.excludeFromFinancials
              ),
              onClick: () =>
                setPaymentTarget({
                  mode: 'expense',
                  id: row.id,
                  label: row.expenseNumber,
                  finalBill: row.amount,
                  alreadyPaid: row.paidAmount,
                  remaining: row.remainingAmount,
                }),
            },
            {
              id: 'delete',
              label: 'Delete',
              danger: true,
              hidden: !isSuperAdmin,
              onClick: () =>
                setPendingDelete({ kind: 'expense', expense: row }),
            },
          ]}
        />
      ),
    },
  ];

  if (isReceptionist) {
    return (
      <section className="entity-page expenses-page">
        <PageHeader title="Expenses" breadcrumb={['Home', 'Expenses']} />
        <EmptyState
          title="Limited access"
          description="Receptionist may only create operational Cleaning/Laundry expenses. Full finance tabs are for Admin and Super Admin."
        />
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => {
            if (!categories.length && token) {
              void fetchExpenseCategories(token).then(setCategories);
            }
            setShowExpenseForm(true);
          }}
        >
          Add Cleaning / Laundry Expense
        </button>
        <ExpenseFormModal
          open={showExpenseForm}
          token={token ?? ''}
          categories={categories}
          receptionistMode
          onClose={() => setShowExpenseForm(false)}
          onSaved={() => {
            setShowExpenseForm(false);
            setToast({ message: 'Expense saved.', tone: 'success' });
          }}
          onError={(message) => setToast({ message, tone: 'error' })}
          onAddCategory={() => undefined}
        />
        <Toast
          message={toast.message}
          tone={toast.tone}
          onClose={() => setToast({ message: '', tone: 'success' })}
        />
      </section>
    );
  }

  const headerTitle = selectedProperty
    ? `Expenses — ${selectedProperty.name}`
    : 'Expenses';
  const summarySource = monthView?.summary;
  const totalExpenses =
    summarySource?.totalExpenses ?? summary?.totals.totalExpenses ?? '0';
  const paidAmount = summarySource?.paid ?? summary?.totals.paidAmount ?? '0';
  const outstanding =
    summarySource?.remaining ?? summary?.totals.outstanding ?? '0';
  const overdueAmount =
    summarySource?.overdue ?? summary?.totals.overdueAmount ?? '0';
  const totalUnits =
    summarySource?.totalUnits ?? summary?.totals.totalUnits ?? 0;

  return (
    <section className="entity-page expenses-page">
      <PageHeader title={headerTitle} breadcrumb={['Home', 'Expenses']} />

      <div className="expenses-page__period">
        Viewing: <strong>{viewing}</strong>
      </div>

      <div className="expenses-page__summary expenses-page__summary--pastel">
        <SummaryCard
          label={`Total Property Expense — ${short}`}
          value={formatPkr(totalExpenses)}
          tone="gold"
        />
        <SummaryCard
          label={`Paid — ${short}`}
          value={formatPkr(paidAmount)}
          tone="success"
        />
        <SummaryCard
          label={`Outstanding — ${short}`}
          value={formatPkr(outstanding)}
          tone="warn"
        />
        <SummaryCard
          label={`Overdue — ${short}`}
          value={formatPkr(overdueAmount)}
          tone="danger"
        />
        <SummaryCard
          label={`Total Units — ${short}`}
          value={String(totalUnits)}
          tone="info"
        />
      </div>

      <FilterBar>
        <label>
          <span>Month</span>
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {MONTH_NAMES[m - 1]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Year</span>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Property</span>
          <select
            value={propertyId}
            onChange={(e) => setPropertyId(e.target.value)}
          >
            <option value="">
              {properties.length === 1 ? 'Select Property' : 'Select Property'}
            </option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Status</span>
          <select
            value={paymentStatus}
            onChange={(e) =>
              setPaymentStatus(e.target.value as UnitMonthExpenseStatus | '')
            }
          >
            <option value="">All</option>
            <option value="NO_CHARGE">No Charge</option>
            <option value="UNPAID">Unpaid</option>
            <option value="PARTIAL">Partial</option>
            <option value="PAID">Paid</option>
            <option value="OVERDUE">Overdue</option>
          </select>
        </label>
        <label>
          <span>Search</span>
          <input
            type="search"
            value={search}
            placeholder="Unit, floor, expense name"
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => setShowMoreFilters((v) => !v)}
        >
          More Filters
        </button>
        <button type="button" className="btn btn--ghost" onClick={clearFilters}>
          Clear Filters
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => {
            setMonth(now.getMonth() + 1);
            setYear(now.getFullYear());
          }}
        >
          Current Month
        </button>
      </FilterBar>

      {showMoreFilters ? (
        <FilterBar>
          <label>
            <span>Selected Date</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </label>
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
          <label>
            <span>Payment Method</span>
            <select
              value={paymentMethod}
              onChange={(e) =>
                setPaymentMethod(e.target.value as PaymentMethod | '')
              }
            >
              <option value="">All</option>
              <option value="CASH">Cash</option>
              <option value="BANK_TRANSFER">Bank Transfer</option>
              <option value="CARD">Card</option>
              <option value="EASYPAISA">Easypaisa</option>
              <option value="JAZZCASH">JazzCash</option>
              <option value="OTHER">Other</option>
            </select>
          </label>
        </FilterBar>
      ) : null}

      <div className="expenses-tabs" role="tablist">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            className={`expenses-tabs__btn${tab === item.key ? ' expenses-tabs__btn--active' : ''}`}
            onClick={() => setTab(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="expenses-page__toolbar">
        {tab === 'electricity' ? (
          <>
            <div className="expenses-page__rate">
              Rate per Unit: <strong>{formatPkr(rate)}</strong>
            </div>
            {isSuperAdmin ? (
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => setShowRateForm(true)}
              >
                Change Rate
              </button>
            ) : null}
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => void openRateHistory()}
            >
              Rate History
            </button>
            {isSuperAdmin ? (
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => {
                  setInitPropertyId(propertyId);
                  setShowInit(true);
                }}
              >
                Initialize Readings
              </button>
            ) : null}
            {canElectricity ? (
              <button
                type="button"
                className="btn btn--primary"
                disabled={!propertyId || generateBusy}
                onClick={() => void handleGenerateMonth()}
                title={!propertyId ? 'Select a property first' : undefined}
              >
                Generate Month
              </button>
            ) : null}
          </>
        ) : (
          <>
            {canCreate ? (
              <button
                type="button"
                className="btn btn--primary"
                disabled={!propertyId && tab !== 'other'}
                onClick={() => openQuickAdd()}
              >
                {tab === 'other'
                  ? '+ Add Other Expense'
                  : tab === 'overview'
                    ? '+ Add Expense'
                    : `+ Add ${activeTab.label.replace(/ Charges| Bill| Expenses/g, '')} Expense`}
              </button>
            ) : null}
            {canCreate ? (
              <button
                type="button"
                className="btn btn--ghost"
                disabled={!propertyId}
                onClick={() => setShowPropertyExpense(true)}
                title={!propertyId ? 'Select a property first' : undefined}
              >
                + Property Expense
              </button>
            ) : null}
            {canBulk && tab !== 'maintenance' && tab !== 'overview' ? (
              <button
                type="button"
                className="btn btn--ghost"
                disabled={!propertyId}
                onClick={() => setShowBulk(true)}
              >
                Apply to Multiple Units
              </button>
            ) : null}
            {canAddCategory && tab === 'other' ? (
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => setShowCategoryForm(true)}
              >
                Add New Type
              </button>
            ) : null}
          </>
        )}
      </div>

      <h3 className="expenses-page__section-title">
        {selectedProperty
          ? `${activeTab.label} — ${selectedProperty.name} — ${viewing}`
          : `${activeTab.label} — ${viewing}`}
      </h3>

      {!propertyId ? (
        <EmptyState
          title="Select a property"
          description="Choose a property to load its apartments and rooms from the Units table. Expenses never create apartments."
        />
      ) : null}

      {propertyId && isLoading ? (
        <LoadingState message="Loading expenses…" />
      ) : null}
      {propertyId && !isLoading && error ? (
        <ErrorState message={error} onRetry={() => void loadData()} />
      ) : null}

      {propertyId && !isLoading && !error && tab === 'overview' ? (
        monthView?.units.length ? (
          <div className="expenses-overview-wrap">
            <DataTable
              columns={overviewColumns}
              rows={monthView.units}
              rowKey={(row) => row.unitId}
            />
          </div>
        ) : (
          <EmptyState
            title="No active units"
            description="Add apartments/rooms under Properties → Units. They will appear here automatically."
          />
        )
      ) : null}

      {propertyId && !isLoading && !error && tab === 'electricity' ? (
        electricityUnitRows.length ? (
          <DataTable
            columns={electricityColumns}
            rows={electricityUnitRows}
            rowKey={(row) => row.unitId}
          />
        ) : (
          <EmptyState
            title="No units for this property"
            description="Active units from the Units table appear here even before readings exist."
          />
        )
      ) : null}

      {propertyId &&
      !isLoading &&
      !error &&
      tab !== 'overview' &&
      tab !== 'electricity' ? (
        <>
          {categoryUnitRows.length ? (
            <DataTable
              columns={categoryColumns}
              rows={categoryUnitRows}
              rowKey={(row) => row.unitId}
            />
          ) : (
            <EmptyState
              title="No units for this property"
              description="Active units appear here even when no expenses exist yet (No Charge)."
            />
          )}
          {tab === 'other' && propertyLevelExpenses.length > 0 ? (
            <div className="expenses-property-section">
              <h4>Property / General Other Expenses</h4>
              <DataTable
                columns={otherExpenseColumns}
                rows={propertyLevelExpenses}
                rowKey={(row) => row.id}
              />
            </div>
          ) : null}
        </>
      ) : null}

      {ExpenseFormOrOther()}

      <OtherExpenseFormModal
        open={showPropertyExpense}
        token={token ?? ''}
        categories={categories}
        billingMonth={month}
        billingYear={year}
        preferredPropertyId={propertyId || undefined}
        preferredScope="PROPERTY"
        onClose={() => setShowPropertyExpense(false)}
        onSaved={() => {
          setShowPropertyExpense(false);
          setToast({ message: 'Property expense saved.', tone: 'success' });
          void loadData();
        }}
        onError={(message) => setToast({ message, tone: 'error' })}
        onCategoriesChanged={() => {
          if (token) void fetchExpenseCategories(token).then(setCategories);
        }}
      />

      <BulkExpenseModal
        open={showBulk}
        token={token ?? ''}
        categories={categories}
        defaultCategoryName={activeTab.categoryName ?? 'Maintenance'}
        properties={properties}
        month={month}
        year={year}
        onClose={() => setShowBulk(false)}
        onSaved={() => {
          setShowBulk(false);
          setToast({ message: 'Bulk expenses created.', tone: 'success' });
          void loadData();
        }}
        onError={(message) => setToast({ message, tone: 'error' })}
      />

      <EnterCurrentReadingModal
        open={Boolean(readingTarget)}
        token={token ?? ''}
        reading={readingTarget}
        onClose={() => setReadingTarget(null)}
        onSaved={() => {
          setReadingTarget(null);
          setToast({ message: 'Reading saved.', tone: 'success' });
          void loadData();
        }}
        onError={(message) => setToast({ message, tone: 'error' })}
      />

      <RecordExpensePaymentModal
        open={Boolean(paymentTarget)}
        token={token ?? ''}
        mode={paymentTarget?.mode ?? 'expense'}
        targetId={paymentTarget?.id ?? ''}
        label={paymentTarget?.label ?? ''}
        finalBill={paymentTarget?.finalBill ?? '0'}
        alreadyPaid={paymentTarget?.alreadyPaid ?? '0'}
        remaining={paymentTarget?.remaining ?? '0'}
        onClose={() => setPaymentTarget(null)}
        onSaved={() => {
          setPaymentTarget(null);
          setToast({ message: 'Payment recorded.', tone: 'success' });
          void loadData();
        }}
        onError={(message) => setToast({ message, tone: 'error' })}
      />

      <ElectricityRateFormModal
        open={showRateForm}
        token={token ?? ''}
        onClose={() => setShowRateForm(false)}
        onSaved={(nextRate) => {
          setShowRateForm(false);
          setRate(nextRate);
          setToast({
            message: `Rate updated to ${formatPkr(nextRate)}.`,
            tone: 'success',
          });
        }}
        onError={(message) => setToast({ message, tone: 'error' })}
      />

      <ExpenseCategoryFormModal
        open={showCategoryForm}
        token={token ?? ''}
        onClose={() => setShowCategoryForm(false)}
        onSaved={(category) => {
          setCategories((prev) =>
            [...prev, category].sort((a, b) => a.name.localeCompare(b.name)),
          );
          setShowCategoryForm(false);
          setToast({
            message: `Category "${category.name}" added.`,
            tone: 'success',
          });
        }}
        onError={(message) => setToast({ message, tone: 'error' })}
      />

      <ExpenseDetailModal
        open={showDetail}
        expense={selectedExpense}
        canEdit={canManage}
        canDelete={isSuperAdmin}
        onEdit={() => {
          if (selectedExpense) void openEditExpense(selectedExpense.id);
        }}
        onDelete={() => {
          if (selectedExpense) {
            setPendingDelete({ kind: 'expense', expense: selectedExpense });
          }
        }}
        onClose={() => {
          setShowDetail(false);
          setSelectedExpense(null);
        }}
      />

      <UnitExpenseDrawer
        open={Boolean(drawerUnit)}
        propertyName={selectedProperty?.name ?? ''}
        periodLabel={viewing}
        unit={drawerUnit}
        canAddExpense={canCreate}
        canPay={canPay}
        canElectricity={canElectricity}
        onClose={() => setDrawerUnit(null)}
        onAddExpense={() => {
          if (drawerUnit) openQuickAdd(drawerUnit);
          setDrawerUnit(null);
        }}
        onRecordPayment={() => {
          if (drawerUnit) void openUnitPayment(drawerUnit);
        }}
        onElectricityReading={() => {
          if (drawerUnit) openUnitElectricity(drawerUnit);
          setDrawerUnit(null);
        }}
        onViewHistory={() => {
          if (drawerUnit) void openUnitHistory(drawerUnit);
        }}
        onEdit={() => {
          if (drawerUnit) {
            void openEditUnitCharge(drawerUnit);
            setDrawerUnit(null);
          }
        }}
        onDelete={() => {
          if (drawerUnit) void requestDeleteUnitCharges(drawerUnit);
        }}
        onDelete={() => {
          if (drawerUnit) void requestDeleteUnitCharges(drawerUnit);
        }}
        canEdit={canManage}
        canDelete={isSuperAdmin}
      />

      <FormModal
        open={showInit}
        title={`Initialize Readings — ${viewing}`}
        onClose={() => setShowInit(false)}
      >
        <form className="form-grid" onSubmit={(e) => void handleInitializeAll(e)}>
          <label className="form-field">
            <span>Property</span>
            <select
              value={initPropertyId}
              onChange={(e) => setInitPropertyId(e.target.value)}
              required
            >
              <option value="">Select</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>Due Date</span>
            <input
              type="date"
              value={initDueDate}
              onChange={(e) => setInitDueDate(e.target.value)}
            />
          </label>
          <div className="expenses-init-table-wrap">
            <table className="expenses-init-table">
              <thead>
                <tr>
                  <th>Unit</th>
                  <th>Previous</th>
                  <th>Current</th>
                </tr>
              </thead>
              <tbody>
                {initUnits.map((unit) => (
                  <tr key={unit.id}>
                    <td>{unit.unitNumber}</td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        step="0.001"
                        value={initRows[unit.id]?.previous ?? ''}
                        onChange={(e) =>
                          setInitRows((prev) => ({
                            ...prev,
                            [unit.id]: {
                              previous: e.target.value,
                              current: prev[unit.id]?.current ?? '',
                            },
                          }))
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        step="0.001"
                        value={initRows[unit.id]?.current ?? ''}
                        onChange={(e) =>
                          setInitRows((prev) => ({
                            ...prev,
                            [unit.id]: {
                              previous: prev[unit.id]?.previous ?? '',
                              current: e.target.value,
                            },
                          }))
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!initUnits.length ? (
              <p className="form-hint">Select a property to load its units.</p>
            ) : null}
          </div>
          <p className="form-hint">
            Creates a separate electricity record per unit. Leave a row blank to
            skip it.
          </p>
          <div className="form-actions">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setShowInit(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn--primary"
              disabled={initBusy}
            >
              {initBusy ? 'Saving…' : 'Save All'}
            </button>
          </div>
        </form>
      </FormModal>

      <FormModal
        open={showRateHistory}
        title="Electricity Rate History"
        onClose={() => setShowRateHistory(false)}
      >
        {rateHistory.length === 0 ? (
          <p className="form-hint">No rate history yet.</p>
        ) : (
          <ul className="expenses-rate-history">
            {rateHistory.map((row) => (
              <li key={row.id}>
                <strong>{formatPkr(row.ratePerUnit)}</strong> from{' '}
                {new Date(row.effectiveFrom).toLocaleString()}
                {row.effectiveTo
                  ? ` to ${new Date(row.effectiveTo).toLocaleString()}`
                  : ' (current)'}
                {row.reason ? ` — ${row.reason}` : ''}
                {row.changedBy ? ` · ${row.changedBy.fullName}` : ''}
              </li>
            ))}
          </ul>
        )}
        <div className="form-actions">
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => setShowRateHistory(false)}
          >
            Close
          </button>
        </div>
      </FormModal>

      <Toast
        message={toast.message}
        tone={toast.tone}
        onClose={() => setToast({ message: '', tone: 'success' })}
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={
          pendingDelete?.kind === 'reading'
            ? 'Delete electricity bill?'
            : 'Delete expense?'
        }
        message={
          pendingDelete?.kind === 'reading'
            ? `This removes the ${viewing} reading and archives the linked expense. History is kept.`
            : pendingDelete?.kind === 'expense'
              ? `${pendingDelete.expense.expenseNumber} will be archived. History is kept.`
              : pendingDelete?.kind === 'expenses'
                ? `Charges for ${pendingDelete.label} will be archived. History is kept.`
                : ''
        }
        confirmLabel="Delete"
        busy={deleting}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => void confirmPendingDelete()}
      />
    </section>
  );

  function ExpenseFormOrOther() {
    if (tab === 'other' && !formPrefill.unitId && !editingExpense) {
      return (
        <OtherExpenseFormModal
          open={showExpenseForm}
          token={token ?? ''}
          categories={categories}
          billingMonth={month}
          billingYear={year}
          preferredPropertyId={formPrefill.propertyId || propertyId || undefined}
          preferredUnitId={formPrefill.unitId}
          preferredScope={formPrefill.unitId ? 'UNIT' : undefined}
          onClose={() => {
            setShowExpenseForm(false);
            setFormPrefill({});
            setEditingExpense(null);
          }}
          onSaved={() => {
            setShowExpenseForm(false);
            setFormPrefill({});
            setEditingExpense(null);
            setToast({ message: 'Expense saved.', tone: 'success' });
            void loadData();
          }}
          onError={(message) => setToast({ message, tone: 'error' })}
          onCategoriesChanged={() => {
            if (token) void fetchExpenseCategories(token).then(setCategories);
          }}
        />
      );
    }

    return (
      <ExpenseFormModal
        open={showExpenseForm}
        token={token ?? ''}
        categories={categories}
        expense={editingExpense}
        receptionistMode={false}
        preferredCategoryName={
          formPrefill.categoryName ?? activeTab.categoryName ?? undefined
        }
        preferredPropertyId={formPrefill.propertyId || propertyId || undefined}
        preferredUnitId={formPrefill.unitId}
        billingMonth={month}
        billingYear={year}
        onClose={() => {
          setShowExpenseForm(false);
          setFormPrefill({});
          setEditingExpense(null);
        }}
        onSaved={() => {
          setShowExpenseForm(false);
          setFormPrefill({});
          setEditingExpense(null);
          setToast({
            message: editingExpense ? 'Expense updated.' : 'Expense saved.',
            tone: 'success',
          });
          void loadData();
        }}
        onError={(message) => setToast({ message, tone: 'error' })}
        onAddCategory={() => setShowCategoryForm(true)}
      />
    );
  }
}
