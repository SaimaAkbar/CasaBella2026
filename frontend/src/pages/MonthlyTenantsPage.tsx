import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError } from '../api/client';
import { fetchProperties } from '../api/properties';
import { fetchUnits } from '../api/units';
import {
  createMonthlyAgreement,
  endMonthlyAgreement,
  fetchMonthlyAgreements,
  updateMonthlyAgreement,
  type MonthlyAgreement,
} from '../api/monthly-agreements';
import {
  fetchMonthlyBills,
  generateMonthlyBill,
  type MonthlyBill,
} from '../api/monthly-bills';
import {
  archiveMonthlyTenant,
  createMonthlyTenant,
  fetchMonthlyTenant,
  fetchMonthlyTenants,
  updateMonthlyTenant,
} from '../api/monthly-tenants';
import { fetchElectricityReadings } from '../api/electricity-readings';
import { fetchPaymentsByTenancy } from '../api/payments';
import {
  createMonthlyTenancy,
  endMonthlyTenancy,
  fetchMonthlyTenancies,
  fetchMonthlyTenancySummary,
  markTenancyEmpty,
  markTenancyOccupied,
  recordRentRevision,
  updateMonthlyTenancy,
} from '../api/monthly-tenancies';
import { AdjustTenancyModal } from '../components/monthly-tenants/AdjustTenancyModal';
import { ElectricityReadingFormModal } from '../components/expenses/ElectricityReadingFormModal';
import { EnterCurrentReadingModal } from '../components/expenses/EnterCurrentReadingModal';
import { ReceiveTenantPaymentModal } from '../components/monthly-tenants/ReceiveTenantPaymentModal';
import { TenantDetailModal } from '../components/monthly-tenants/TenantDetailModal';
import { TenantFormModal } from '../components/monthly-tenants/TenantFormModal';
import { TenancyDetailModal } from '../components/monthly-tenants/TenancyDetailModal';
import { TenancyFormModal } from '../components/monthly-tenants/TenancyFormModal';
import { ManageAssignedUnitsModal } from '../components/monthly-tenants/ManageAssignedUnitsModal';
import { PlaceHotelGuestWizard } from '../components/monthly-tenants/PlaceHotelGuestWizard';
import { PaymentFormModal } from '../components/payments/PaymentFormModal';
import { PageHeader } from '../components/PageHeader';
import { SummaryCard } from '../components/dashboard/SummaryCard';
import { FormModal } from '../components/ui/FormModal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { DataTable, type DataTableColumn } from '../components/ui/DataTable';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { FilterBar } from '../components/ui/FilterBar';
import { LoadingState } from '../components/ui/LoadingState';
import { MoneyDisplay } from '../components/ui/MoneyDisplay';
import { OccupancyBadge } from '../components/ui/OccupancyBadge';
import { PaymentStatusBadge } from '../components/ui/PaymentStatusBadge';
import { RowMoreMenu } from '../components/ui/RowMoreMenu';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Toast } from '../components/ui/Toast';
import { useAuth } from '../context/AuthContext';
import { useApiErrorHandler } from '../hooks/useApiErrorHandler';
import { formatDate, formatPkr } from '../lib/format';
import { sortByUnitNumber } from '../lib/natural-unit-sort';
import { invalidateEligibleUnitsQueries } from '../lib/query-cache';
import {
  buildAssignmentFinance,
  money,
  readingByUnitId,
} from '../lib/tenant-assignment-finance';
import type { ElectricityReading } from '../types/expense';
import type { DashboardUnitNavState } from '../types/dashboard';
import type { MonthlyTenant, MonthlyTenantInput } from '../types/monthly-tenant';
import type {
  MonthlyOccupancyState,
  MonthlyTenancy,
  MonthlyTenancyInput,
  MonthlyTenancyStatus,
  MonthlyTenancySummary,
} from '../types/monthly-tenancy';
import type { Property } from '../types/property';
import type { Unit } from '../types/unit';
import '../styles/forms.css';
import './MonthlyTenantsPage.css';

const now = new Date();

type TabKey =
  | 'directory'
  | 'agreements'
  | 'assignments'
  | 'bills'
  | 'history';

function isDashboardNavState(value: unknown): value is DashboardUnitNavState & {
  tenancyId?: string;
} {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    v.source === 'dashboard' &&
    typeof v.propertyId === 'string' &&
    typeof v.unitId === 'string'
  );
}

export function MonthlyTenantsPage() {
  const { token, user } = useAuth();
  const handleApiError = useApiErrorHandler();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const consumedDashboardNav = useRef(false);

  const role = user?.role;
  const isSuperAdmin = role === 'SUPER_ADMIN';
  const isAdmin = role === 'ADMIN';
  const canCreate = isSuperAdmin || isAdmin;
  const canViewFinancials = role !== 'RECEPTIONIST';
  const canViewRestricted = role !== 'RECEPTIONIST';
  const canMarkOccupancy =
    role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'RECEPTIONIST';
  const canEnd = isSuperAdmin;
  const canArchiveTenant = isSuperAdmin;
  const canAddPayment = Boolean(role);

  const [tab, setTab] = useState<TabKey>('assignments');

  const [tenancies, setTenancies] = useState<MonthlyTenancy[]>([]);
  const [agreements, setAgreements] = useState<MonthlyAgreement[]>([]);
  const [bills, setBills] = useState<MonthlyBill[]>([]);
  const [summary, setSummary] = useState<MonthlyTenancySummary | null>(null);
  const [tenants, setTenants] = useState<MonthlyTenant[]>([]);
  const [assignTenants, setAssignTenants] = useState<MonthlyTenant[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [assignAgreementId, setAssignAgreementId] = useState<
    string | undefined
  >();
  const [showAgreementForm, setShowAgreementForm] = useState(false);
  const [agreementTenantId, setAgreementTenantId] = useState('');
  const [agreementStart, setAgreementStart] = useState('');
  const [savingAgreement, setSavingAgreement] = useState(false);

  const [search, setSearch] = useState('');
  const [directoryActive, setDirectoryActive] = useState<'all' | 'true' | 'false'>(
    'true',
  );
  const [propertyId, setPropertyId] = useState('');
  const [unitId, setUnitId] = useState('');
  const [occupancyState, setOccupancyState] = useState<
    MonthlyOccupancyState | ''
  >('');
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [statusChip, setStatusChip] = useState<
    | 'ALL'
    | 'PAID'
    | 'PARTIAL'
    | 'RENT_OVERDUE'
    | 'ELECTRICITY_OVERDUE'
    | 'OUTSTANDING'
  >('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<{
    message: string;
    tone: 'success' | 'error';
  }>({ message: '', tone: 'success' });

  const [showTenantForm, setShowTenantForm] = useState(false);
  const [editingTenant, setEditingTenant] = useState<MonthlyTenant | null>(null);
  const [duplicateMatch, setDuplicateMatch] = useState<MonthlyTenant | null>(
    null,
  );
  const [showTenancyForm, setShowTenancyForm] = useState(false);
  const [assignTenantId, setAssignTenantId] = useState<string | undefined>();
  const [unitPreset, setUnitPreset] = useState<{
    propertyId: string;
    unitId: string;
    unitLabel?: string;
    lockSelection?: boolean;
  } | null>(null);
  const [returnToDashboard, setReturnToDashboard] = useState(false);
  const [savingTenant, setSavingTenant] = useState(false);
  const [savingTenancy, setSavingTenancy] = useState(false);

  const [selectedTenancy, setSelectedTenancy] = useState<MonthlyTenancy | null>(
    null,
  );
  const [showTenancyDetail, setShowTenancyDetail] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<MonthlyTenant | null>(
    null,
  );
  const [showTenantDetail, setShowTenantDetail] = useState(false);
  const [busyAction, setBusyAction] = useState(false);

  const [endTarget, setEndTarget] = useState<MonthlyTenancy | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<MonthlyTenant | null>(null);

  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [showReceivePayment, setShowReceivePayment] = useState(false);
  const [receiveLock, setReceiveLock] = useState<
    'RENT' | 'ELECTRICITY' | undefined
  >();
  const [showAdjust, setShowAdjust] = useState(false);
  const [showFirstReading, setShowFirstReading] = useState(false);
  const [showCurrentReading, setShowCurrentReading] = useState(false);
  const [editingAssignment, setEditingAssignment] =
    useState<MonthlyTenancy | null>(null);
  const [electricityByUnit, setElectricityByUnit] = useState<
    Map<string, ElectricityReading>
  >(new Map());
  const [paymentRefreshKey, setPaymentRefreshKey] = useState(0);
  const [showManageUnits, setShowManageUnits] = useState(false);
  const [showHotelGuestWizard, setShowHotelGuestWizard] = useState(false);
  const [hotelGuestTenancyId, setHotelGuestTenancyId] = useState<
    string | undefined
  >();

  const tenancyQuery = useMemo(
    () => ({
      search: search.trim() || undefined,
      propertyId: propertyId || undefined,
      unitId: unitId || undefined,
      occupancyState,
      tenancyStatus:
        tab === 'assignments'
          ? ('ACTIVE' as MonthlyTenancyStatus)
          : tab === 'history'
            ? undefined
            : undefined,
      month:
        tab === 'assignments' ? ('' as const) : month ? Number(month) : ('' as const),
      year:
        tab === 'assignments' ? ('' as const) : year ? Number(year) : ('' as const),
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    }),
    [
      search,
      propertyId,
      unitId,
      occupancyState,
      tab,
      month,
      year,
      startDate,
      endDate,
    ],
  );

  async function loadDirectory() {
    if (!token) return;
    const isActive =
      directoryActive === 'all'
        ? undefined
        : directoryActive === 'true';
    const rows = await fetchMonthlyTenants(token, {
      search: search.trim() || undefined,
      isActive,
    });
    setTenants(rows);
  }

  async function loadAgreements() {
    if (!token) return;
    const rows = await fetchMonthlyAgreements(token, {
      search: search.trim() || undefined,
      status: tab === 'history' ? undefined : 'ACTIVE',
    });
    setAgreements(
      tab === 'history'
        ? rows.filter((row) => row.status !== 'ACTIVE')
        : rows.filter((row) => row.status === 'ACTIVE'),
    );
  }

  async function loadBills() {
    if (!token) return;
    const nowDate = new Date();
    const rows = await fetchMonthlyBills(token, {
      billingMonth: month ? Number(month) : nowDate.getMonth() + 1,
      billingYear: year ? Number(year) : nowDate.getFullYear(),
    });
    setBills(rows);
  }

  async function loadTenancies() {
    if (!token) return;
    const query =
      tab === 'history'
        ? { ...tenancyQuery, tenancyStatus: undefined }
        : tenancyQuery;

    const [rows, stats] = await Promise.all([
      fetchMonthlyTenancies(token, query),
      fetchMonthlyTenancySummary(token, {
        ...query,
        tenancyStatus: 'ACTIVE',
      }),
    ]);

    const filtered = sortByUnitNumber(
      tab === 'history'
        ? rows.filter((row) => row.tenancyStatus !== 'ACTIVE')
        : rows,
      (row) => row.unit?.unitNumber,
    );

    setTenancies(filtered);
    setSummary(stats);

    if (canViewFinancials) {
      const viewMonth = month ? Number(month) : now.getMonth() + 1;
      const viewYear = year ? Number(year) : now.getFullYear();
      try {
        const readings = await fetchElectricityReadings(token, {
          propertyId: propertyId || undefined,
          billingMonth: viewMonth,
          billingYear: viewYear,
        });
        setElectricityByUnit(readingByUnitId(readings));
      } catch {
        setElectricityByUnit(new Map());
      }
    } else {
      setElectricityByUnit(new Map());
    }
  }

  async function loadData() {
    if (!token) return;

    setIsLoading(true);
    setError('');

    try {
      if (tab === 'directory') {
        await loadDirectory();
        const stats = await fetchMonthlyTenancySummary(token, {
          tenancyStatus: 'ACTIVE',
        });
        setSummary(stats);
      } else if (tab === 'agreements') {
        await loadAgreements();
      } else if (tab === 'bills') {
        await loadBills();
      } else {
        await loadTenancies();
      }
    } catch (err) {
      setError(handleApiError(err, 'Unable to load monthly tenants.'));
    } finally {
      setIsLoading(false);
    }
  }

  async function refreshAssignTenants() {
    if (!token) return;
    try {
      const rows = await fetchMonthlyTenants(token, { isActive: true });
      setAssignTenants(rows);
    } catch {
      // Assign modal can still search via API.
    }
  }

  useEffect(() => {
    if (!token) return;

    void Promise.all([fetchProperties(token), refreshAssignTenants()])
      .then(([propertyRows]) => {
        setProperties(propertyRows);
      })
      .catch((err) => {
        setToast({
          message: handleApiError(err, 'Unable to load reference data.'),
          tone: 'error',
        });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!token) return;

    void fetchUnits(token, {
      propertyId: propertyId || undefined,
      isActive: true,
    })
      .then(setUnits)
      .catch(() => setUnits([]));
  }, [token, propertyId]);

  useEffect(() => {
    if (consumedDashboardNav.current) return;

    const fromState = isDashboardNavState(location.state)
      ? location.state
      : null;
    const qProperty = searchParams.get('propertyId');
    const qUnit = searchParams.get('unitId');
    const fromQuery =
      searchParams.get('source') === 'dashboard' && qProperty && qUnit
        ? ({
            source: 'dashboard',
            propertyId: qProperty,
            unitId: qUnit,
            unitNumber: searchParams.get('unitNumber') ?? undefined,
            openAssign: true,
            returnToDashboard: true,
            tenancyId: searchParams.get('tenancyId') ?? undefined,
          } satisfies DashboardUnitNavState & { tenancyId?: string })
        : null;
    const nav = fromState ?? fromQuery;
    if (!nav) return;

    const openHotelGuest = Boolean(
      'tenancyId' in nav && typeof nav.tenancyId === 'string' && nav.tenancyId,
    );
    const openAssign = Boolean(nav.openAssign) || Boolean(fromQuery && !openHotelGuest);

    if (!openAssign && !openHotelGuest) return;

    consumedDashboardNav.current = true;
    setPropertyId(nav.propertyId);
    setUnitId(nav.unitId);

    if (openHotelGuest && 'tenancyId' in nav && nav.tenancyId) {
      setHotelGuestTenancyId(nav.tenancyId);
      setShowHotelGuestWizard(true);
      setTab('assignments');
    } else if (openAssign) {
      setUnitPreset({
        propertyId: nav.propertyId,
        unitId: nav.unitId,
        unitLabel: nav.unitNumber,
        lockSelection: true,
      });
      setReturnToDashboard(Boolean(nav.returnToDashboard ?? true));
      setShowTenancyForm(true);
      setTab('assignments');
    }

    navigate(location.pathname, { replace: true, state: null });
    if (searchParams.get('source') === 'dashboard') {
      const next = new URLSearchParams(searchParams);
      next.delete('source');
      next.delete('propertyId');
      next.delete('unitId');
      next.delete('unitNumber');
      next.delete('tenancyId');
      setSearchParams(next, { replace: true });
    }
  }, [location.state, location.pathname, navigate, searchParams, setSearchParams]);

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, tab, search, directoryActive, tenancyQuery]);

  async function handleCreateTenant(payload: MonthlyTenantInput) {
    if (!token) return;
    setSavingTenant(true);
    setDuplicateMatch(null);
    try {
      if (editingTenant) {
        const updatePayload: Partial<MonthlyTenantInput> = isSuperAdmin
          ? payload
          : {
              phone: payload.phone,
              ...(payload.alternatePhone
                ? { alternatePhone: payload.alternatePhone }
                : {}),
              ...(payload.emergencyContactName
                ? { emergencyContactName: payload.emergencyContactName }
                : {}),
              ...(payload.emergencyContactPhone
                ? { emergencyContactPhone: payload.emergencyContactPhone }
                : {}),
              ...(payload.notes ? { notes: payload.notes } : {}),
            };
        await updateMonthlyTenant(token, editingTenant.id, updatePayload);
        setToast({ message: 'Tenant profile updated.', tone: 'success' });
      } else {
        await createMonthlyTenant(token, payload);
        setToast({
          message: 'Tenant profile created. Assign a unit when ready.',
          tone: 'success',
        });
      }
      setShowTenantForm(false);
      setEditingTenant(null);
      setTab('directory');
      await loadDirectory();
      await refreshAssignTenants();
    } catch (err) {
      if (
        err instanceof ApiError &&
        err.status === 409 &&
        payload.cnic &&
        !editingTenant
      ) {
        try {
          const matches = await fetchMonthlyTenants(token, {
            search: payload.cnic,
          });
          const match =
            matches.find(
              (row) =>
                row.cnic?.replace(/\D/g, '') ===
                payload.cnic?.replace(/\D/g, ''),
            ) ?? matches[0] ?? null;
          setDuplicateMatch(match);
        } catch {
          setDuplicateMatch(null);
        }
        setToast({
          message: 'A tenant with this CNIC already exists.',
          tone: 'error',
        });
      } else {
        setToast({
          message: handleApiError(err, 'Unable to save tenant.'),
          tone: 'error',
        });
      }
      throw err;
    } finally {
      setSavingTenant(false);
    }
  }

  async function handleCreateTenancy(payload: MonthlyTenancyInput) {
    if (!token) return;
    setSavingTenancy(true);
    try {
      if (editingAssignment) {
        const currentRent = money(editingAssignment.monthlyRent);
        if (editingAssignment.agreementId && payload.agreementEnd) {
          await updateMonthlyAgreement(token, editingAssignment.agreementId, {
            agreementEnd: payload.agreementEnd,
            securityDeposit: payload.securityDeposit,
          });
        }
        await updateMonthlyTenancy(token, editingAssignment.id, {
          agreementEnd: payload.agreementEnd,
          securityDeposit: payload.securityDeposit,
          hotelUseAllowed: payload.hotelUseAllowed,
          occupancyState: payload.occupancyState,
          notes: payload.notes,
          propertyId: payload.propertyId,
          unitId: payload.unitId,
        });
        if (
          isSuperAdmin &&
          payload.monthlyRent > 0 &&
          payload.monthlyRent !== currentRent
        ) {
          await recordRentRevision(token, editingAssignment.id, {
            newRent: payload.monthlyRent,
            effectiveFrom: new Date().toISOString(),
            reason: 'Agreement rent update',
          });
        }
        setEditingAssignment(null);
        setShowTenancyForm(false);
        setToast({
          message: 'Agreement updated. Previous history was kept.',
          tone: 'success',
        });
        await loadTenancies();
        return;
      }

      await createMonthlyTenancy(token, payload);
      invalidateEligibleUnitsQueries();
      setShowTenancyForm(false);
      setAssignTenantId(undefined);
      setAssignAgreementId(undefined);
      const shouldReturn = returnToDashboard;
      setUnitPreset(null);
      setReturnToDashboard(false);
      if (shouldReturn) {
        setToast({
          message: 'Tenant assigned. Returning to dashboard.',
          tone: 'success',
        });
        navigate('/dashboard');
        return;
      }
      setToast({ message: 'Tenant assigned to unit.', tone: 'success' });
      setTab('assignments');
      await refreshAssignTenants();
      await loadDirectory();
      // Tab switch triggers Assigned Units reload via effect.
    } catch (err) {
      setToast({
        message: handleApiError(err, 'Unable to assign tenant.'),
        tone: 'error',
      });
      throw err;
    } finally {
      setSavingTenancy(false);
    }
  }

  async function handleCreateAgreement() {
    if (!token || !agreementTenantId || !agreementStart) return;
    setSavingAgreement(true);
    try {
      const created = await createMonthlyAgreement(token, {
        tenantId: agreementTenantId,
        agreementStart,
        activate: true,
      });
      setShowAgreementForm(false);
      setToast({
        message: `Agreement ${created.agreementNumber} created.`,
        tone: 'success',
      });
      setAssignTenantId(agreementTenantId);
      setAssignAgreementId(created.id);
      setTab('agreements');
      setShowTenancyForm(true);
    } catch (err) {
      setToast({
        message: handleApiError(err, 'Unable to create agreement.'),
        tone: 'error',
      });
    } finally {
      setSavingAgreement(false);
    }
  }

  async function openTenantDetail(tenantId: string) {
    if (!token) return;
    setBusyAction(true);
    try {
      const detail = await fetchMonthlyTenant(token, tenantId);
      setSelectedTenant(detail);
      setShowTenantDetail(true);
    } catch (err) {
      setToast({
        message: handleApiError(err, 'Unable to load tenant profile.'),
        tone: 'error',
      });
    } finally {
      setBusyAction(false);
    }
  }

  async function runOccupancy(
    tenancy: MonthlyTenancy,
    next: 'empty' | 'occupied',
  ) {
    if (!token) return;
    setBusyAction(true);
    try {
      const updated =
        next === 'empty'
          ? await markTenancyEmpty(token, tenancy.id)
          : await markTenancyOccupied(token, tenancy.id);
      invalidateEligibleUnitsQueries();
      setSelectedTenancy(updated);
      setToast({
        message:
          next === 'empty'
            ? 'Unit marked empty (MONTHLY_TENANT_VACANT).'
            : 'Unit marked occupied.',
        tone: 'success',
      });
      await loadTenancies();
    } catch (err) {
      setToast({
        message: handleApiError(err, 'Unable to update occupancy.'),
        tone: 'error',
      });
    } finally {
      setBusyAction(false);
    }
  }

  async function confirmEnd() {
    if (!token || !endTarget) return;
    setBusyAction(true);
    try {
      await endMonthlyTenancy(token, endTarget.id);
      invalidateEligibleUnitsQueries();
      setEndTarget(null);
      setShowTenancyDetail(false);
      setToast({
        message: 'Tenancy ended. Unit set to CLEANING_REQUIRED.',
        tone: 'success',
      });
      await loadTenancies();
      await loadDirectory();
    } catch (err) {
      setToast({
        message: handleApiError(err, 'Unable to end tenancy.'),
        tone: 'error',
      });
    } finally {
      setBusyAction(false);
    }
  }

  async function confirmArchive() {
    if (!token || !archiveTarget) return;
    setBusyAction(true);
    try {
      await archiveMonthlyTenant(token, archiveTarget.id);
      setArchiveTarget(null);
      setShowTenantDetail(false);
      setToast({ message: 'Tenant archived.', tone: 'success' });
      await loadDirectory();
      await refreshAssignTenants();
    } catch (err) {
      setToast({
        message: handleApiError(err, 'Unable to archive tenant.'),
        tone: 'error',
      });
    } finally {
      setBusyAction(false);
    }
  }

  const viewMonth = month ? Number(month) : now.getMonth() + 1;
  const viewYear = year ? Number(year) : now.getFullYear();
  const periodLabel = new Date(viewYear, viewMonth - 1, 1).toLocaleString(
    undefined,
    { month: 'long', year: 'numeric' },
  );
  const selectedPropertyName =
    properties.find((property) => property.id === propertyId)?.name ?? 'All';

  function financeFor(row: MonthlyTenancy) {
    return buildAssignmentFinance(
      row,
      electricityByUnit.get(row.unitId),
      viewYear,
      viewMonth,
    );
  }

  function openEnterReading(row: MonthlyTenancy) {
    setSelectedTenancy(row);
    const reading = electricityByUnit.get(row.unitId);
    if (reading && reading.currentUnits == null) {
      setShowCurrentReading(true);
      return;
    }
    setShowFirstReading(true);
  }

  const assignmentRows = tenancies.filter((row) => {
    if (statusChip === 'ALL') return true;
    const finance = financeFor(row);
    if (statusChip === 'PAID') return finance.paidRow;
    if (statusChip === 'PARTIAL')
      return finance.status === 'PARTIAL' && !finance.overdueRow;
    if (statusChip === 'RENT_OVERDUE') return finance.rentOverdue;
    if (statusChip === 'ELECTRICITY_OVERDUE') return finance.electricityOverdue;
    return finance.totalOutstanding > 0;
  });

  function openView(row: MonthlyTenancy) {
    const finance = financeFor(row);
    setSelectedTenancy({
      ...row,
      electricityReadingRequired: finance.readingRequired,
      electricityBillAmount:
        finance.electricityBill == null ? undefined : String(finance.electricityBill),
      electricityPaidAmount:
        finance.electricityPaid == null ? undefined : String(finance.electricityPaid),
      electricityRemainingAmount:
        finance.electricityRemaining == null
          ? undefined
          : String(finance.electricityRemaining),
      totalOutstanding: String(finance.totalOutstanding),
    });
    setShowTenancyDetail(true);
  }

  function openReceive(
    row: MonthlyTenancy,
    lock?: 'RENT' | 'ELECTRICITY',
  ) {
    setSelectedTenancy(row);
    setReceiveLock(lock);
    setShowReceivePayment(true);
  }

  async function tryDeleteAssignment(row: MonthlyTenancy) {
    if (!token || !isSuperAdmin) return;
    try {
      const history = await fetchPaymentsByTenancy(token, row.id);
      if (history.length > 0) {
        setToast({
          message:
            'This assignment has payment history. Use End Tenancy instead of delete so records are kept.',
          tone: 'error',
        });
        return;
      }
    } catch {
      setToast({
        message:
          'Could not verify payment history. Use End Tenancy to preserve records.',
        tone: 'error',
      });
      return;
    }
    setToast({
      message:
        'Destructive assignment delete is blocked. Use End Tenancy to archive this room assignment.',
      tone: 'error',
    });
  }

  const tenancyColumns: Array<DataTableColumn<MonthlyTenancy>> = [
    {
      key: 'room',
      header: 'ROOM',
      title: 'Room / unit number',
      render: (row) => row.unit?.unitNumber ?? '—',
    },
    {
      key: 'tenant',
      header: 'TENANT',
      title: 'Tenant name',
      render: (row) => row.tenant?.fullName ?? '—',
    },
  ];

  if (canViewFinancials) {
    tenancyColumns.push(
      {
        key: 'rent',
        header: 'RENT',
        title: 'Monthly rent',
        render: (row) => <MoneyDisplay value={financeFor(row).monthlyRent} />,
      },
      {
        key: 'prevDue',
        header: 'PREV. DUE',
        title: 'Previous rent arrears',
        render: (row) => <MoneyDisplay value={financeFor(row).previousDue} />,
      },
      {
        key: 'rentPaid',
        header: 'RENT PAID',
        title: 'Rent received',
        render: (row) => <MoneyDisplay value={financeFor(row).rentPaid} />,
      },
      {
        key: 'rentDue',
        header: 'RENT DUE',
        title: 'Rent remaining',
        render: (row) => <MoneyDisplay value={financeFor(row).rentRemaining} />,
      },
      {
        key: 'elecBill',
        header: 'ELECTRICITY',
        title: 'Electricity bill for the viewing month',
        render: (row) => {
          const finance = financeFor(row);
          if (finance.readingRequired) {
            return (
              <button
                type="button"
                className="mt-reading-link"
                onClick={() => openEnterReading(row)}
              >
                READING REQUIRED
              </button>
            );
          }
          return <MoneyDisplay value={finance.electricityBill} />;
        },
      },
      {
        key: 'elecPaid',
        header: 'ELEC. PAID',
        title: 'Electricity paid',
        render: (row) => {
          const finance = financeFor(row);
          if (finance.readingRequired) return '—';
          return <MoneyDisplay value={finance.electricityPaid} />;
        },
      },
      {
        key: 'elecDue',
        header: 'ELEC. DUE',
        title: 'Electricity remaining',
        render: (row) => {
          const finance = financeFor(row);
          if (finance.readingRequired) return '—';
          return <MoneyDisplay value={finance.electricityRemaining} />;
        },
      },
      {
        key: 'totalDue',
        header: 'TOTAL DUE',
        title: 'Rent remaining + electricity remaining',
        render: (row) => (
          <strong>
            <MoneyDisplay value={financeFor(row).totalOutstanding} />
          </strong>
        ),
      },
    );
  }

  tenancyColumns.push(
    {
      key: 'status',
      header: 'STATUS',
      render: (row) => {
        const finance = financeFor(row);
        const occupancy =
          row.occupancyState === 'EMPTY' ? 'TENANT UNIT EMPTY' : 'OCCUPIED';
        const badgeState = finance.overdueRow
          ? finance.status
          : finance.paidRow
            ? 'PAID'
            : finance.status;
        return (
          <div className="mt-status-cell">
            {canViewFinancials ? (
              <PaymentStatusBadge state={badgeState} />
            ) : (
              <OccupancyBadge state={row.occupancyState} />
            )}
            <span className="mt-status-cell__occ">{occupancy}</span>
          </div>
        );
      },
    },
    {
      key: 'actions',
      header: 'ACTIONS',
      className: 'data-table__col--actions',
      render: (row) => {
        const finance = financeFor(row);
        return (
          <div className="data-table__actions">
            <button
              type="button"
              className="data-table__action"
              onClick={() => openView(row)}
            >
              View
            </button>
            {canAddPayment && row.tenancyStatus === 'ACTIVE' ? (
              <button
                type="button"
                className="data-table__action"
                onClick={() => openReceive(row)}
              >
                Receive Payment
              </button>
            ) : null}
            <RowMoreMenu
              items={[
                {
                  id: 'edit',
                  label: 'Edit Agreement',
                  hidden: !isSuperAdmin || row.tenancyStatus !== 'ACTIVE',
                  onClick: () => {
                    setEditingAssignment(row);
                    setAssignTenantId(row.tenantId);
                    setAssignAgreementId(row.agreementId);
                    setShowTenancyForm(true);
                  },
                },
                {
                  id: 'bill',
                  label: 'View Bill',
                  hidden: !canViewFinancials,
                  onClick: () => {
                    setMonth(String(viewMonth));
                    setYear(String(viewYear));
                    setTab('bills');
                  },
                },
                {
                  id: 'profile',
                  label: 'Tenant Profile',
                  hidden: !row.tenantId,
                  onClick: () => void openTenantDetail(row.tenantId),
                },
                {
                  id: 'history',
                  label: 'Payment History',
                  hidden: !canViewFinancials,
                  onClick: () => openView(row),
                },
                {
                  id: 'rentPay',
                  label: 'Record Rent Payment',
                  hidden: !canAddPayment || row.tenancyStatus !== 'ACTIVE',
                  onClick: () => openReceive(row, 'RENT'),
                },
                {
                  id: 'elecPay',
                  label: 'Record Electricity Payment',
                  hidden:
                    !canAddPayment ||
                    !finance.electricityReadingId ||
                    finance.readingRequired,
                  onClick: () => openReceive(row, 'ELECTRICITY'),
                },
                {
                  id: 'reading',
                  label: 'Enter Electricity Reading',
                  hidden: !canViewFinancials || !finance.readingRequired,
                  onClick: () => openEnterReading(row),
                },
                {
                  id: 'adjust',
                  label: 'Adjust / Waive',
                  hidden: !isSuperAdmin,
                  onClick: () => {
                    setSelectedTenancy(row);
                    setShowAdjust(true);
                  },
                },
                {
                  id: 'empty',
                  label: 'Mark Empty',
                  hidden:
                    !canMarkOccupancy ||
                    row.tenancyStatus !== 'ACTIVE' ||
                    row.occupancyState !== 'OCCUPIED',
                  onClick: () => void runOccupancy(row, 'empty'),
                },
                {
                  id: 'occupied',
                  label: 'Mark Occupied',
                  hidden:
                    !canMarkOccupancy ||
                    row.tenancyStatus !== 'ACTIVE' ||
                    row.occupancyState !== 'EMPTY',
                  onClick: () => void runOccupancy(row, 'occupied'),
                },
                {
                  id: 'end',
                  label: 'End Tenancy',
                  danger: true,
                  hidden: !canEnd || row.tenancyStatus !== 'ACTIVE',
                  onClick: () => setEndTarget(row),
                },
                {
                  id: 'delete',
                  label: 'Delete Assignment',
                  danger: true,
                  hidden: !isSuperAdmin,
                  onClick: () => void tryDeleteAssignment(row),
                },
              ]}
            />
          </div>
        );
      },
    },
  );

  const directoryColumns: Array<DataTableColumn<MonthlyTenant>> = [
    {
      key: 'name',
      header: 'Tenant Name',
      render: (row) => row.fullName,
    },
    {
      key: 'phone',
      header: 'Phone',
      render: (row) => row.phone,
    },
  ];

  if (canViewRestricted) {
    directoryColumns.push({
      key: 'cnic',
      header: 'CNIC',
      render: (row) => row.cnic || '—',
    });
  }

  directoryColumns.push(
    {
      key: 'unit',
      header: 'Current Unit',
      render: (row) => {
        const current = row.currentTenancy;
        if (!current || current.tenancyStatus !== 'ACTIVE') return '—';
        return `${current.unit?.property?.name ?? ''} ${
          current.unit?.unitNumber ?? ''
        }`.trim() || '—';
      },
    },
    {
      key: 'agreement',
      header: 'Current Agreement',
      render: (row) =>
        row.activeAgreement
          ? `${row.activeAgreement.agreementNumber} · ${formatDate(
              row.activeAgreement.agreementStart,
            )}${row.activeAgreement.agreementEnd
              ? ` → ${formatDate(row.activeAgreement.agreementEnd)}`
              : ''}`
          : '—',
    },
    {
      key: 'count',
      header: 'Tenancies',
      render: (row) => String(row.tenancyCount ?? 0),
    },
  );

  if (canViewFinancials) {
    directoryColumns.push({
      key: 'monthlyRent',
      header: 'Total Current Monthly Rent',
      render: (row) => (
        <MoneyDisplay value={row.currentMonthlyRentTotal ?? '0'} />
      ),
    });
  }

  directoryColumns.push(
    {
      key: 'status',
      header: 'Profile',
      render: (row) => (
        <StatusBadge status={row.isActive ? 'ACTIVE' : 'INACTIVE'} />
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
            onClick={() => void openTenantDetail(row.id)}
          >
            View / History
          </button>
          {canCreate ? (
            <button
              type="button"
              className="data-table__action"
              onClick={() => {
                setEditingTenant(row);
                setDuplicateMatch(null);
                setShowTenantForm(true);
              }}
            >
              Edit Profile
            </button>
          ) : null}
          {canCreate && row.isActive ? (
            <button
              type="button"
              className="data-table__action"
              onClick={() => {
                setAgreementTenantId(row.id);
                setAgreementStart(new Date().toISOString().slice(0, 10));
                setShowAgreementForm(true);
              }}
            >
              Create Agreement
            </button>
          ) : null}
          {canCreate && row.isActive ? (
            <button
              type="button"
              className="data-table__action"
              onClick={() => {
                setAssignTenantId(row.id);
                setAssignAgreementId(undefined);
                setShowTenancyForm(true);
              }}
            >
              Assign Unit
            </button>
          ) : null}
          {canArchiveTenant && row.isActive ? (
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
  );

  const years = Array.from({ length: 6 }, (_, index) => now.getFullYear() - index);

  return (
    <section className="entity-page monthly-tenants-page">
      <PageHeader
        title="Monthly Tenants"
        breadcrumb={['Home', 'Monthly Tenants']}
      />

      {canCreate ? (
        <div className="entity-page__toolbar monthly-tenants-page__toolbar">
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => {
              setEditingTenant(null);
              setDuplicateMatch(null);
              setShowTenantForm(true);
            }}
          >
            Add Tenant
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => {
              setAssignTenantId(undefined);
              setShowTenancyForm(true);
            }}
          >
            Assign Tenant to Unit
          </button>
        </div>
      ) : null}

      <div className="monthly-tenants-page__tabs" role="tablist">
        {(
          [
            ['directory', 'Tenant Directory'],
            ['agreements', 'Active Agreements'],
            ['assignments', 'Assigned Units'],
            ['bills', 'Monthly Bills'],
            ['history', 'History'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            className={`monthly-tenants-page__tab${
              tab === id ? ' is-active' : ''
            }`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {summary ? (
        <div className="monthly-tenants-page__summary">
          <SummaryCard
            label="Active Monthly Tenants"
            value={summary.activeMonthlyTenants}
            tone="gold"
          />
          <SummaryCard
            label="Occupied Monthly Units"
            value={summary.occupiedMonthlyUnits}
            tone="info"
          />
          <SummaryCard
            label="Empty Monthly Units"
            value={summary.emptyMonthlyUnits}
            tone="default"
          />
          {canViewFinancials ? (
            <>
              <SummaryCard
                label="Monthly Rent Total"
                value={formatPkr(summary.monthlyRentTotal)}
                tone="success"
              />
              <SummaryCard
                label="Total Received"
                value={formatPkr(summary.totalReceived)}
                tone="info"
              />
              <SummaryCard
                label="Remaining Balance"
                value={formatPkr(summary.remainingBalance)}
                tone="warn"
              />
            </>
          ) : null}
        </div>
      ) : null}

      <FilterBar>
        <label>
          <span>Search</span>
          <input
            type="search"
            value={search}
            placeholder={
              tab === 'directory'
                ? 'Name, phone, CNIC'
                : 'Name, phone, CNIC, unit'
            }
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>

        {tab === 'directory' ? (
          <label>
            <span>Profile Status</span>
            <select
              value={directoryActive}
              onChange={(event) =>
                setDirectoryActive(
                  event.target.value as 'all' | 'true' | 'false',
                )
              }
            >
              <option value="true">Active profiles</option>
              <option value="false">Archived</option>
              <option value="all">All</option>
            </select>
          </label>
        ) : (
          <>
            <label>
              <span>Property</span>
              <select
                value={propertyId}
                onChange={(event) => {
                  setPropertyId(event.target.value);
                  setUnitId('');
                }}
              >
                <option value="">All</option>
                {properties.map((property) => (
                  <option key={property.id} value={property.id}>
                    {property.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Unit</span>
              <select
                value={unitId}
                onChange={(event) => setUnitId(event.target.value)}
              >
                <option value="">All</option>
                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.unitNumber}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Occupancy</span>
              <select
                value={occupancyState}
                onChange={(event) =>
                  setOccupancyState(
                    event.target.value as MonthlyOccupancyState | '',
                  )
                }
              >
                <option value="">All</option>
                <option value="OCCUPIED">Occupied</option>
                <option value="EMPTY">Empty</option>
              </select>
            </label>
            <label>
              <span>Month</span>
              <select
                value={month}
                onChange={(event) => {
                  const nextMonth = event.target.value;
                  setMonth(nextMonth);
                  if (nextMonth && !year) {
                    setYear(String(now.getFullYear()));
                  }
                }}
              >
                <option value="">All</option>
                {Array.from({ length: 12 }, (_, index) => (
                  <option key={index + 1} value={String(index + 1)}>
                    {new Date(2000, index, 1).toLocaleString(undefined, {
                      month: 'long',
                    })}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Year</span>
              <select
                value={year}
                onChange={(event) => setYear(event.target.value)}
              >
                <option value="">All</option>
                {years.map((value) => (
                  <option key={value} value={String(value)}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Start Date</span>
              <input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </label>
            <label>
              <span>End Date</span>
              <input
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </label>
          </>
        )}
      </FilterBar>

      {(tab === 'assignments' || tab === 'history') && (
        <div className="mt-period-bar">
          <div className="mt-period-bar__meta">
            <span>
              Viewing: <strong>{periodLabel.toUpperCase()}</strong>
            </span>
            <span>
              Property: <strong>{selectedPropertyName.toUpperCase()}</strong>
            </span>
          </div>
          {tab === 'assignments' && canViewFinancials ? (
            <div className="mt-period-bar__chips" role="tablist">
              {(
                [
                  ['ALL', 'ALL'],
                  ['PAID', 'PAID'],
                  ['PARTIAL', 'PARTIAL'],
                  ['RENT_OVERDUE', 'RENT OVERDUE'],
                  ['ELECTRICITY_OVERDUE', 'ELECTRICITY OVERDUE'],
                  ['OUTSTANDING', 'ANY OUTSTANDING'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`mt-period-bar__chip${
                    statusChip === id ? ' is-active' : ''
                  }`}
                  onClick={() => setStatusChip(id)}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      )}

      {isLoading ? <LoadingState message="Loading monthly tenants…" /> : null}
      {!isLoading && error ? (
        <ErrorState message={error} onRetry={() => void loadData()} />
      ) : null}

      {!isLoading && !error && tab === 'directory' && tenants.length === 0 ? (
        <EmptyState
          title="No tenant profiles found"
          description="Use Add Tenant to create a profile. Then Create Agreement and Assign Unit."
        />
      ) : null}
      {!isLoading && !error && tab === 'directory' && tenants.length > 0 ? (
        <DataTable
          columns={directoryColumns}
          rows={tenants}
          rowKey={(row) => row.id}
        />
      ) : null}

      {!isLoading && !error && tab === 'agreements' && agreements.length === 0 ? (
        <EmptyState
          title="No active agreements"
          description="Create an agreement from Tenant Directory, then assign one or more units."
        />
      ) : null}
      {!isLoading && !error && tab === 'agreements' && agreements.length > 0 ? (
        <DataTable
          columns={[
            {
              key: 'number',
              header: 'Agreement',
              render: (row: MonthlyAgreement) => row.agreementNumber,
            },
            {
              key: 'tenant',
              header: 'Tenant',
              render: (row: MonthlyAgreement) => row.tenant?.fullName ?? '—',
            },
            {
              key: 'dates',
              header: 'Start / End',
              render: (row: MonthlyAgreement) =>
                `${formatDate(row.agreementStart)}${
                  row.agreementEnd ? ` → ${formatDate(row.agreementEnd)}` : ''
                }`,
            },
            {
              key: 'units',
              header: 'Units',
              render: (row: MonthlyAgreement) =>
                String(row.activeAssignmentCount ?? row.assignmentCount ?? 0),
            },
            ...(canViewFinancials
              ? [
                  {
                    key: 'rent',
                    header: 'Monthly Rent',
                    render: (row: MonthlyAgreement) => (
                      <MoneyDisplay value={row.monthlyRentTotal} />
                    ),
                  },
                  {
                    key: 'bill',
                    header: 'Current Bill Due',
                    render: (row: MonthlyAgreement) => (
                      <MoneyDisplay
                        value={row.currentBill?.remainingBalance}
                      />
                    ),
                  },
                ]
              : []),
            {
              key: 'status',
              header: 'Status',
              render: (row: MonthlyAgreement) => (
                <StatusBadge
                  status={row.status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE'}
                />
              ),
            },
            {
              key: 'actions',
              header: 'Actions',
              render: (row: MonthlyAgreement) => (
                <div className="data-table__actions">
                  {canCreate ? (
                    <button
                      type="button"
                      className="data-table__action"
                      onClick={() => {
                        setAssignTenantId(row.tenantId);
                        setAssignAgreementId(row.id);
                        setShowTenancyForm(true);
                      }}
                    >
                      Assign Unit
                    </button>
                  ) : null}
                  {canViewFinancials ? (
                    <button
                      type="button"
                      className="data-table__action"
                      onClick={() => {
                        const d = new Date();
                        void generateMonthlyBill(token ?? '', {
                          agreementId: row.id,
                          billingMonth: d.getMonth() + 1,
                          billingYear: d.getFullYear(),
                        })
                          .then(() => {
                            setToast({
                              message: 'Current-month bill generated.',
                              tone: 'success',
                            });
                            setTab('bills');
                          })
                          .catch((err) =>
                            setToast({
                              message: handleApiError(
                                err,
                                'Unable to generate bill.',
                              ),
                              tone: 'error',
                            }),
                          );
                      }}
                    >
                      Generate Bill
                    </button>
                  ) : null}
                  {canEnd ? (
                    <button
                      type="button"
                      className="data-table__action data-table__action--danger"
                      onClick={() => {
                        void endMonthlyAgreement(token ?? '', row.id)
                          .then(() => {
                            setToast({
                              message: 'Agreement ended.',
                              tone: 'success',
                            });
                            void loadAgreements();
                          })
                          .catch((err) =>
                            setToast({
                              message: handleApiError(
                                err,
                                'Unable to end agreement.',
                              ),
                              tone: 'error',
                            }),
                          );
                      }}
                    >
                      End
                    </button>
                  ) : null}
                </div>
              ),
            },
          ]}
          rows={agreements}
          rowKey={(row) => row.id}
        />
      ) : null}

      {!isLoading && !error && tab === 'bills' && bills.length === 0 ? (
        <EmptyState
          title="No monthly bills"
          description="Generate a bill from an active agreement for the selected month/year."
        />
      ) : null}
      {!isLoading && !error && tab === 'bills' && bills.length > 0 ? (
        <DataTable
          columns={[
            {
              key: 'tenant',
              header: 'Tenant',
              render: (row: MonthlyBill) =>
                row.agreement?.tenant.fullName ?? '—',
            },
            {
              key: 'period',
              header: 'Month / Year',
              render: (row: MonthlyBill) =>
                `${row.billingMonth}/${row.billingYear}`,
            },
            ...(canViewFinancials
              ? [
                  {
                    key: 'base',
                    header: 'Base Rent',
                    render: (row: MonthlyBill) => (
                      <MoneyDisplay value={row.baseRent} />
                    ),
                  },
                  {
                    key: 'credits',
                    header: 'Credits',
                    render: (row: MonthlyBill) => (
                      <MoneyDisplay value={row.credits} />
                    ),
                  },
                  {
                    key: 'payable',
                    header: 'Payable',
                    render: (row: MonthlyBill) => (
                      <MoneyDisplay value={row.totalPayable} />
                    ),
                  },
                  {
                    key: 'received',
                    header: 'Received',
                    render: (row: MonthlyBill) => (
                      <MoneyDisplay value={row.totalReceived} />
                    ),
                  },
                  {
                    key: 'remaining',
                    header: 'Remaining',
                    render: (row: MonthlyBill) => (
                      <MoneyDisplay value={row.remainingBalance} />
                    ),
                  },
                ]
              : []),
            {
              key: 'due',
              header: 'Due Date',
              render: (row: MonthlyBill) => formatDate(row.dueDate),
            },
            {
              key: 'status',
              header: 'Status',
              render: (row: MonthlyBill) => (
                <PaymentStatusBadge state={row.paymentStatus as never} />
              ),
            },
          ]}
          rows={bills}
          rowKey={(row) => row.id}
        />
      ) : null}

      {!isLoading &&
      !error &&
      (tab === 'assignments' || tab === 'history') &&
      assignmentRows.length === 0 ? (
        <EmptyState
          title={
            tab === 'assignments'
              ? 'No assigned units found'
              : 'No history found'
          }
          description={
            tab === 'assignments'
              ? 'Create an agreement, then assign one or more units to the tenant.'
              : 'Ended agreements, assignments and prior records appear here.'
          }
        />
      ) : null}
      {!isLoading &&
      !error &&
      (tab === 'assignments' || tab === 'history') &&
      assignmentRows.length > 0 ? (
        <DataTable
          columns={tenancyColumns}
          rows={assignmentRows}
          rowKey={(row) => row.id}
          freezeLeft={2}
          wrapClassName="data-table-wrap--tenant-freeze"
          rowClassName={(row) => {
            const finance = financeFor(row);
            if (finance.overdueRow) return 'is-overdue';
            if (finance.paidRow) return 'is-paid';
            return undefined;
          }}
        />
      ) : null}

      <TenantFormModal
        open={showTenantForm}
        saving={savingTenant}
        initial={editingTenant}
        duplicateMatch={duplicateMatch}
        onClose={() => {
          setShowTenantForm(false);
          setEditingTenant(null);
          setDuplicateMatch(null);
        }}
        onSubmit={handleCreateTenant}
        onUseExisting={(tenant) => {
          setShowTenantForm(false);
          setEditingTenant(null);
          setDuplicateMatch(null);
          setAssignTenantId(tenant.id);
          setShowTenancyForm(true);
          setTab('directory');
          void openTenantDetail(tenant.id);
        }}
      />

      <TenancyFormModal
        open={showTenancyForm}
        saving={savingTenancy}
        token={token ?? ''}
        tenants={assignTenants}
        properties={properties}
        isSuperAdmin={isSuperAdmin}
        canViewRestricted={canViewRestricted}
        canViewFinancials={canViewFinancials}
        preselectedTenantId={assignTenantId}
        preselectedAgreementId={assignAgreementId}
        unitPreset={unitPreset}
        returnToDashboard={returnToDashboard}
        initial={editingAssignment}
        onClose={() => {
          setShowTenancyForm(false);
          setAssignTenantId(undefined);
          setAssignAgreementId(undefined);
          setUnitPreset(null);
          setReturnToDashboard(false);
          setEditingAssignment(null);
        }}
        onError={(message) => setToast({ message, tone: 'error' })}
        onAgreementCreated={(agreement) => {
          setAssignAgreementId(agreement.id);
          setToast({
            message: `Agreement ${agreement.agreementNumber} created. Select property and unit.`,
            tone: 'success',
          });
          void loadAgreements();
        }}
        onSubmit={handleCreateTenancy}
      />

      <TenantDetailModal
        open={showTenantDetail}
        tenant={selectedTenant}
        canViewRestricted={canViewRestricted}
        canViewFinancials={canViewFinancials}
        canEdit={canCreate}
        canAssign={canCreate}
        canArchive={canArchiveTenant}
        canManageUnits={Boolean(role)}
        busy={busyAction}
        onClose={() => setShowTenantDetail(false)}
        onEdit={() => {
          if (!selectedTenant) return;
          setEditingTenant(selectedTenant);
          setShowTenantDetail(false);
          setShowTenantForm(true);
        }}
        onAssign={() => {
          if (!selectedTenant) return;
          setAssignTenantId(selectedTenant.id);
          setShowTenantDetail(false);
          setShowTenancyForm(true);
        }}
        onManageUnits={() => {
          setShowTenantDetail(false);
          setShowManageUnits(true);
        }}
        onArchive={() => selectedTenant && setArchiveTarget(selectedTenant)}
      />

      {selectedTenant && token ? (
        <ManageAssignedUnitsModal
          open={showManageUnits}
          token={token}
          tenant={selectedTenant}
          role={role}
          canViewFinancials={canViewFinancials}
          onClose={() => setShowManageUnits(false)}
          onAssignMore={() => {
            setAssignTenantId(selectedTenant.id);
            setShowManageUnits(false);
            setShowTenancyForm(true);
          }}
          onPlaceHotelGuest={(tenancyId) => {
            setHotelGuestTenancyId(tenancyId);
            setShowManageUnits(false);
            setShowHotelGuestWizard(true);
          }}
          onChanged={() => {
            void loadDirectory();
            if (tab !== 'directory') void loadTenancies();
            if (selectedTenant && token) {
              void fetchMonthlyTenant(token, selectedTenant.id)
                .then(setSelectedTenant)
                .catch(() => undefined);
            }
          }}
          onError={(message) => setToast({ message, tone: 'error' })}
          onSuccess={(message) => setToast({ message, tone: 'success' })}
        />
      ) : null}

      {token ? (
        <PlaceHotelGuestWizard
          open={showHotelGuestWizard}
          token={token}
          tenantId={selectedTenant?.id}
          preselectedTenancyId={hotelGuestTenancyId}
          role={role}
          onClose={() => {
            setShowHotelGuestWizard(false);
            setHotelGuestTenancyId(undefined);
          }}
          onComplete={() => {
            setShowHotelGuestWizard(false);
            setHotelGuestTenancyId(undefined);
            setToast({
              message: 'Hotel guest booking created on tenant unit.',
              tone: 'success',
            });
            if (tab !== 'directory') void loadTenancies();
          }}
          onError={(message) => setToast({ message, tone: 'error' })}
        />
      ) : null}

      <TenancyDetailModal
        open={showTenancyDetail}
        tenancy={selectedTenancy}
        canViewFinancials={canViewFinancials}
        canMarkOccupancy={canMarkOccupancy}
        canEnd={canEnd}
        canArchiveTenant={canArchiveTenant}
        busy={busyAction}
        token={token ?? undefined}
        canAddPayment={canAddPayment}
        paymentRefreshKey={paymentRefreshKey}
        onAddPayment={() => setShowPaymentForm(true)}
        onClose={() => setShowTenancyDetail(false)}
        onMarkEmpty={() =>
          selectedTenancy && void runOccupancy(selectedTenancy, 'empty')
        }
        onMarkOccupied={() =>
          selectedTenancy && void runOccupancy(selectedTenancy, 'occupied')
        }
        onEnd={() => selectedTenancy && setEndTarget(selectedTenancy)}
        onArchiveTenant={() => {
          if (!selectedTenancy?.tenantId || !selectedTenancy.tenant) return;
          setArchiveTarget({
            id: selectedTenancy.tenantId,
            fullName: selectedTenancy.tenant.fullName,
            phone: selectedTenancy.tenant.phone,
            isActive: selectedTenancy.tenant.isActive ?? true,
            createdAt: selectedTenancy.createdAt,
            updatedAt: selectedTenancy.updatedAt,
          });
        }}
      />

      <PaymentFormModal
        open={showPaymentForm}
        token={token ?? ''}
        isSuperAdmin={isSuperAdmin}
        preset={
          selectedTenancy
            ? {
                paymentForType: 'MONTHLY_TENANCY',
                monthlyTenancyId: selectedTenancy.id,
              }
            : undefined
        }
        onClose={() => setShowPaymentForm(false)}
        onSaved={() => {
          setPaymentRefreshKey((value) => value + 1);
          setToast({ message: 'Payment recorded.', tone: 'success' });
          void loadTenancies();
        }}
        onError={(message) => setToast({ message, tone: 'error' })}
      />

      <ReceiveTenantPaymentModal
        open={showReceivePayment}
        token={token ?? ''}
        tenancy={selectedTenancy}
        periodLabel={periodLabel}
        rentOutstanding={
          selectedTenancy ? financeFor(selectedTenancy).rentRemaining : 0
        }
        electricityOutstanding={
          selectedTenancy
            ? financeFor(selectedTenancy).electricityRemaining ?? 0
            : 0
        }
        electricityReadingId={
          selectedTenancy
            ? financeFor(selectedTenancy).electricityReadingId
            : undefined
        }
        lockApply={receiveLock}
        onClose={() => {
          setShowReceivePayment(false);
          setReceiveLock(undefined);
        }}
        onSaved={() => {
          setPaymentRefreshKey((value) => value + 1);
          setToast({ message: 'Payment recorded.', tone: 'success' });
          void loadTenancies();
        }}
        onError={(message) => setToast({ message, tone: 'error' })}
      />

      <ElectricityReadingFormModal
        open={showFirstReading}
        token={token ?? ''}
        isSuperAdmin={isSuperAdmin}
        preset={
          selectedTenancy
            ? {
                propertyId: selectedTenancy.unit?.property?.id,
                unitId: selectedTenancy.unitId,
                billingMonth: viewMonth,
                billingYear: viewYear,
                lockSelection: Boolean(selectedTenancy.unit?.property?.id),
              }
            : undefined
        }
        onClose={() => setShowFirstReading(false)}
        onSaved={() => {
          setShowFirstReading(false);
          setToast({ message: 'Electricity reading saved.', tone: 'success' });
          void loadTenancies();
        }}
        onError={(message) => setToast({ message, tone: 'error' })}
      />

      <EnterCurrentReadingModal
        open={showCurrentReading}
        token={token ?? ''}
        reading={
          selectedTenancy
            ? electricityByUnit.get(selectedTenancy.unitId) ?? null
            : null
        }
        onClose={() => setShowCurrentReading(false)}
        onSaved={() => {
          setShowCurrentReading(false);
          setToast({ message: 'Electricity reading saved.', tone: 'success' });
          void loadTenancies();
        }}
        onError={(message) => setToast({ message, tone: 'error' })}
      />

      <AdjustTenancyModal
        open={showAdjust}
        token={token ?? ''}
        tenancy={selectedTenancy}
        onClose={() => setShowAdjust(false)}
        onSaved={() => {
          setPaymentRefreshKey((value) => value + 1);
          setToast({ message: 'Adjustment recorded.', tone: 'success' });
          void loadTenancies();
        }}
        onError={(message) => setToast({ message, tone: 'error' })}
      />

      <FormModal
        open={showAgreementForm}
        title="Create Monthly Agreement"
        onClose={() => {
          if (savingAgreement) return;
          setShowAgreementForm(false);
        }}
      >
        <div className="form-grid">
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Creates an ACTIVE agreement. Assign units afterward. Returning
            tenants reuse their profile.
          </p>
          <label className="form-field">
            <span>Agreement start *</span>
            <input
              type="date"
              value={agreementStart}
              onChange={(e) => setAgreementStart(e.target.value)}
            />
          </label>
          <div className="form-actions">
            <button
              type="button"
              className="btn btn--ghost"
              disabled={savingAgreement}
              onClick={() => setShowAgreementForm(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn--primary"
              disabled={savingAgreement || !agreementStart || !agreementTenantId}
              onClick={() => void handleCreateAgreement()}
            >
              {savingAgreement ? 'Creating…' : 'Create Agreement'}
            </button>
          </div>
        </div>
      </FormModal>

      <ConfirmDialog
        open={Boolean(endTarget)}
        title="End assignment?"
        message="This marks the unit assignment as ENDED and sets the unit to CLEANING_REQUIRED. The agreement remains unless separately ended."
        confirmLabel="End Assignment"
        busy={busyAction}
        onCancel={() => setEndTarget(null)}
        onConfirm={() => void confirmEnd()}
      />

      <ConfirmDialog
        open={Boolean(archiveTarget)}
        title="Archive tenant?"
        message="The tenant profile will be soft-archived (isActive = false). Tenancy history is kept."
        confirmLabel="Archive"
        busy={busyAction}
        onCancel={() => setArchiveTarget(null)}
        onConfirm={() => void confirmArchive()}
      />

      <Toast
        message={toast.message}
        tone={toast.tone}
        onClose={() => setToast({ message: '', tone: 'success' })}
      />
    </section>
  );
}
