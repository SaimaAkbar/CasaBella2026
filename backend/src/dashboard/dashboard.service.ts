import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BookingStatus,
  BookingType,
  MonthlyOccupancyState,
  MonthlyTenancyStatus,
  OccupancySource,
  Prisma,
  Role,
  UnitStatus,
  UnitType,
} from '../../generated/prisma/client';
import { ApprovalsService } from '../approvals/approvals.service';
import { canAccessProfitLossData } from '../common/utils/profit-loss-access';
import { canAccessSalaryData } from '../common/utils/salary-access';
import { FinancialSummaryService } from '../profit-loss/financial-summary.service';
import type { ProfitLossFilterInput } from '../profit-loss/profit-loss.types';
import { PrismaService } from '../prisma/prisma.service';
import { DashboardRoomGridQueryDto } from './dto/dashboard-room-grid-query.dto';
import {
  DashboardSummaryQueryDto,
  type DashboardBookingTypeFilter,
} from './dto/dashboard-summary-query.dto';
import {
  resolveAllowedActions,
  resolveUnitStatus,
  type StatusTone,
  type UnitGridAllowedActions,
} from './unit-status.resolver';

export type DashboardSummaryResponse = {
  totalProperties: number;
  totalApartments: number;
  totalRooms: number;
  occupied: number;
  available: number;
  cleaning: number;
  monthlyEmpty: number;
  maintenance: number;
  blocked: number;
  todayCheckin: number;
  todayCheckout: number;
  income?: number;
  expenses?: number;
  unpaidExpenses?: number;
  expenseBreakdown?: Array<{ category: string; amount: number }>;
  incomeBreakdown?: Array<{ source: string; amount: number }>;
  profit?: number;
  /** CASH dashboard → Net Cash Flow; ACCRUAL → Net Profit */
  netLabel?: 'Net Cash Flow' | 'Net Profit';
  accountingView?: 'CASH' | 'ACCRUAL';
  outstanding?: number;
  ownerReceivable?: number;
  ownerPayable?: number;
  ownerReceivedThisMonth?: number;
  ownerPaidThisMonth?: number;
  ownerOutstandingReceivable?: number;
  ownerOutstandingPayable?: number;
  ownerPaymentsDueToday?: number;
  ownerOverdueStatements?: number;
  employeeCount?: number;
  salaryPayable?: number;
  salaryPaid?: number;
  salaryOutstanding?: number;
  salaryAdvances?: number;
  lowStockItems?: number;
  inventoryExpense?: number;
  damagedRoomAssets?: number;
  pendingApprovals?: number;
  todaysActivity?: number;
  criticalRequests?: number;
  rejectedToday?: number;
};

export type DashboardRoomGridItem = {
  id: string;
  propertyId: string;
  propertyName: string;
  roomNumber: string;
  unitNumber: string;
  apartmentName: string | null;
  unitType: UnitType;
  status: UnitStatus;
  statusLabel: string;
  statusTone: StatusTone;
  hotelUseAllowed: boolean;
  hasOutstanding: boolean;
  bookingType: 'HOURLY' | 'DAILY' | 'MONTHLY' | null;
  guestName: string | null;
  monthlyTenant: string | null;
  occupancySource: 'NORMAL_HOTEL_UNIT' | 'HOTEL_GUEST_ON_TENANT_UNIT' | null;
  settlementType: string | null;
  bookingId: string | null;
  tenancyId: string | null;
  checkInDate: string | null;
  checkoutDate: string | null;
  rent: string | null;
  paid: string | null;
  remaining: string | null;
  cleaningCleared: boolean | null;
  accountsCleared: boolean | null;
  assetWarning: boolean;
  damagedAssetCount: number;
  canCheckOut: boolean;
  bookingStatus: BookingStatus | null;
};

export type DashboardUnitGridDetail = DashboardRoomGridItem & {
  floor: number | null;
  bedrooms: number | null;
  notes: string | null;
  monthlyRent: string | null;
  dailyRate: string | null;
  hourlyRate: string | null;
  allowedActions: UnitGridAllowedActions;
  confirmedBookingId: string | null;
  pendingClearanceBookingId: string | null;
};

export type DashboardFilterOptions = {
  properties: Array<{ id: string; name: string }>;
  apartments: Array<{
    id: string;
    unitNumber: string;
    propertyId: string;
    propertyName: string;
    unitType: UnitType;
  }>;
  units: Array<{
    id: string;
    unitNumber: string;
    propertyId: string;
    propertyName: string;
    unitType: UnitType;
  }>;
};

type UnitGridRow = {
  id: string;
  propertyId: string;
  unitNumber: string;
  unitType: UnitType;
  status: UnitStatus;
  floor: number | null;
  bedrooms: number | null;
  notes: string | null;
  monthlyRent: Prisma.Decimal | null;
  dailyRate: Prisma.Decimal | null;
  hourlyRate: Prisma.Decimal | null;
  property: { name: string };
  tenancies: Array<{
    id: string;
    occupancyState: MonthlyOccupancyState;
    hotelUseAllowed: boolean;
    totalReceived: Prisma.Decimal;
    remainingBalance: Prisma.Decimal;
    agreementEnd: Date | null;
    tenant: { fullName: string };
  }>;
  bookings: Array<{
    id: string;
    bookingType: BookingType;
    bookingStatus: BookingStatus;
    occupancySource: OccupancySource;
    checkInDateTime: Date;
    checkOutDateTime: Date;
    receivedAmount: Prisma.Decimal;
    remainingAmount: Prisma.Decimal;
    totalAmount: Prisma.Decimal;
    cleaningCleared: boolean;
    accountsCleared: boolean;
    guest: { fullName: string };
    hotelUse: { settlementType: string; status: string } | null;
  }>;
  _count: { roomAssets: number };
};

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly financialSummaryService: FinancialSummaryService,
    private readonly approvalsService: ApprovalsService,
  ) {}

  async getSummary(
    query: DashboardSummaryQueryDto,
    role: Role,
    canAccessSalary = false,
    canAccessProfitLoss = false,
    userId?: string,
  ): Promise<DashboardSummaryResponse> {
    const unitId = query.unitId ?? query.apartmentId;
    const financialRange = this.resolveFinancialRange(query);

    const unitWhere = this.buildLiveUnitWhere(query);
    const propertyWhere: Prisma.PropertyWhereInput = {
      isActive: true,
      ...(query.propertyId ? { id: query.propertyId } : {}),
    };

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const bookingScope: Prisma.BookingWhereInput = {
      ...(query.propertyId ? { unit: { propertyId: query.propertyId } } : {}),
      ...(unitId ? { unitId } : {}),
    };

    const [totalProperties, units, todayCheckin, todayCheckout] =
      await Promise.all([
        this.prisma.property.count({ where: propertyWhere }),
        this.loadUnitsForGrid(unitWhere),
        this.prisma.booking.count({
          where: {
            ...bookingScope,
            checkInDateTime: { gte: startOfDay, lte: endOfDay },
            bookingStatus: {
              in: [
                BookingStatus.PENDING,
                BookingStatus.CONFIRMED,
                BookingStatus.CHECKED_IN,
              ],
            },
          },
        }),
        this.prisma.booking.count({
          where: {
            ...bookingScope,
            checkOutDateTime: { gte: startOfDay, lte: endOfDay },
            bookingStatus: {
              in: [BookingStatus.CHECKED_IN, BookingStatus.CONFIRMED],
            },
          },
        }),
      ]);

    const mapped = units
      .map((unit) => this.mapUnitToGridItem(unit, role))
      .filter((item) =>
        this.matchesResolvedFilters(item, {
          ...query,
          // Operational card counts ignore displayStatus so cards stay a
          // stable filter UI under property / type / search filters.
          status: undefined,
          displayStatus: undefined,
        }),
      );

    const summary: DashboardSummaryResponse = {
      totalProperties,
      totalApartments: mapped.filter((u) => u.unitType === UnitType.APARTMENT)
        .length,
      totalRooms: mapped.filter((u) => u.unitType === UnitType.ROOM).length,
      occupied: 0,
      available: 0,
      cleaning: 0,
      monthlyEmpty: 0,
      maintenance: 0,
      blocked: 0,
      todayCheckin,
      todayCheckout,
    };

    for (const item of mapped) {
      switch (item.status) {
        case UnitStatus.OCCUPIED:
          summary.occupied += 1;
          break;
        case UnitStatus.AVAILABLE:
          summary.available += 1;
          break;
        case UnitStatus.CLEANING_REQUIRED:
          summary.cleaning += 1;
          break;
        case UnitStatus.MONTHLY_TENANT_VACANT:
          summary.monthlyEmpty += 1;
          break;
        case UnitStatus.MAINTENANCE:
          summary.maintenance += 1;
          break;
        case UnitStatus.BLOCKED:
          summary.blocked += 1;
          break;
        default:
          break;
      }
    }

    if (canAccessProfitLossData(role, canAccessProfitLoss)) {
      const financialQuery = this.buildProfitLossQuery(query, financialRange);
      const financials =
        await this.financialSummaryService.getDashboardFinancials(
          financialQuery,
          role,
          canAccessProfitLoss,
        );

      if (financials) {
        summary.income = financials.income;
        summary.expenses = financials.expenses;
        summary.unpaidExpenses = financials.unpaidExpenses;
        summary.expenseBreakdown = financials.expenseBreakdown;
        summary.incomeBreakdown = financials.incomeBreakdown;
        summary.profit = financials.profit;
        summary.netLabel = financials.netLabel;
        summary.accountingView = financials.accountingView;
        summary.outstanding = financials.outstanding;

        const inventoryExpenseAgg = await this.prisma.expense.aggregate({
          where: {
            isActive: true,
            excludeFromFinancials: false,
            category: { name: { in: ['Inventory', 'Repair'] } },
            ...(financialRange?.expenseDate
              ? { expenseDate: financialRange.expenseDate }
              : {}),
            ...(query.propertyId
              ? {
                  OR: [
                    { propertyId: query.propertyId },
                    { unit: { propertyId: query.propertyId } },
                  ],
                }
              : {}),
            ...(unitId ? { unitId } : {}),
          },
          _sum: { paidAmount: true },
        });
        summary.inventoryExpense = Number(
          inventoryExpenseAgg._sum.paidAmount?.toString() ?? '0',
        );
      }
    } else if (role === Role.RECEPTIONIST) {
      // Receptionist: operational guest outstanding for checkout context only
      // (checked-in remaining), not full P&L / expense / salary.
      const bookingOutstandingAgg = await this.prisma.booking.aggregate({
        where: {
          ...bookingScope,
          remainingAmount: { gt: 0 },
          bookingStatus: BookingStatus.CHECKED_IN,
        },
        _sum: { remainingAmount: true },
      });
      summary.outstanding = Number(
        bookingOutstandingAgg._sum.remainingAmount?.toString() ?? '0',
      );
    } else {
      // Admin without P&L grant: operational guest/tenant outstanding only.
      const outstanding =
        await this.financialSummaryService.getOutstandingReceivables(
          query.propertyId,
          unitId,
        );
      summary.outstanding = Number(outstanding.total.toString());
    }

    if (canAccessSalaryData(role)) {
      const salaryMonth = query.month ?? new Date().getMonth() + 1;
      const salaryYear = query.year ?? new Date().getFullYear();
      const salaryWhere: Prisma.SalaryRecordWhereInput = {
        salaryMonth,
        salaryYear,
      };

      const [employeeCount, salaryAgg] = await Promise.all([
        this.prisma.employee.count({
          where: { isActive: true, status: 'ACTIVE' },
        }),
        this.prisma.salaryRecord.aggregate({
          where: salaryWhere,
          _sum: {
            netPayable: true,
            totalPaid: true,
            remainingBalance: true,
            totalAdvance: true,
          },
        }),
      ]);

      summary.employeeCount = employeeCount;
      summary.salaryPayable = Number(
        salaryAgg._sum.netPayable?.toString() ?? '0',
      );
      summary.salaryPaid = Number(salaryAgg._sum.totalPaid?.toString() ?? '0');
      summary.salaryOutstanding = Number(
        salaryAgg._sum.remainingBalance?.toString() ?? '0',
      );
      summary.salaryAdvances = Number(
        salaryAgg._sum.totalAdvance?.toString() ?? '0',
      );
    }

    if (role === Role.SUPER_ADMIN || role === Role.ADMIN) {
      const ownerMonth = query.month ?? new Date().getUTCMonth() + 1;
      const ownerYear = query.year ?? new Date().getUTCFullYear();
      const todayStart = new Date();
      todayStart.setUTCHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setUTCHours(23, 59, 59, 999);

      const ownerWhere: Prisma.OwnerMonthlyStatementWhereInput = {
        statementMonth: ownerMonth,
        statementYear: ownerYear,
        ...(query.propertyId ? { propertyId: query.propertyId } : {}),
        ...(unitId ? { unitId } : {}),
      };

      const ownerStatements =
        await this.prisma.ownerMonthlyStatement.findMany({
          where: ownerWhere,
          select: {
            accountDirection: true,
            totalPayableOrReceivable: true,
            totalPaid: true,
            remainingAmount: true,
            dueDate: true,
            paymentStatus: true,
          },
        });

      let ownerReceivable = 0;
      let ownerPayable = 0;
      let ownerReceivedThisMonth = 0;
      let ownerPaidThisMonth = 0;
      let ownerOutstandingReceivable = 0;
      let ownerOutstandingPayable = 0;
      let ownerPaymentsDueToday = 0;
      let ownerOverdueStatements = 0;

      for (const row of ownerStatements) {
        const expected = Number(row.totalPayableOrReceivable.toString());
        const paid = Number(row.totalPaid.toString());
        const remaining = Number(row.remainingAmount.toString());
        if (row.accountDirection === 'RECEIVABLE_FROM_OWNER') {
          ownerReceivable += expected;
          ownerReceivedThisMonth += paid;
          ownerOutstandingReceivable += remaining;
        } else {
          ownerPayable += expected;
          ownerPaidThisMonth += paid;
          ownerOutstandingPayable += remaining;
        }
        if (
          remaining > 0 &&
          row.dueDate >= todayStart &&
          row.dueDate <= todayEnd
        ) {
          ownerPaymentsDueToday += 1;
        }
        if (row.paymentStatus === 'OVERDUE') {
          ownerOverdueStatements += 1;
        }
      }

      summary.ownerReceivable = ownerReceivable;
      summary.ownerPayable = ownerPayable;
      summary.ownerReceivedThisMonth = ownerReceivedThisMonth;
      summary.ownerPaidThisMonth = ownerPaidThisMonth;
      summary.ownerOutstandingReceivable = ownerOutstandingReceivable;
      summary.ownerOutstandingPayable = ownerOutstandingPayable;
      summary.ownerPaymentsDueToday = ownerPaymentsDueToday;
      summary.ownerOverdueStatements = ownerOverdueStatements;
    }

    const [lowStockItems, damagedRoomAssets] = await Promise.all([
      this.prisma.inventoryItem
        .findMany({
          where: { isActive: true },
          select: { currentQuantity: true, reorderLevel: true },
        })
        .then(
          (items) =>
            items.filter((item) =>
              item.currentQuantity.lessThanOrEqualTo(item.reorderLevel),
            ).length,
        ),
      this.prisma.roomAsset.count({
        where: {
          isActive: true,
          condition: { in: ['DAMAGED', 'MISSING'] },
          ...(unitId ? { unitId } : {}),
          ...(query.propertyId
            ? { unit: { propertyId: query.propertyId } }
            : {}),
        },
      }),
    ]);

    summary.lowStockItems = lowStockItems;
    summary.damagedRoomAssets = damagedRoomAssets;

    if (
      role === Role.RECEPTIONIST ||
      !canAccessProfitLossData(role, canAccessProfitLoss)
    ) {
      delete summary.income;
      delete summary.expenses;
      delete summary.unpaidExpenses;
      delete summary.expenseBreakdown;
      delete summary.incomeBreakdown;
      delete summary.profit;
      delete summary.netLabel;
      delete summary.accountingView;
      delete summary.inventoryExpense;
    }

    if (role === Role.RECEPTIONIST) {
      delete summary.employeeCount;
      delete summary.salaryPayable;
      delete summary.salaryPaid;
      delete summary.salaryOutstanding;
      delete summary.salaryAdvances;
      delete summary.ownerReceivable;
      delete summary.ownerPayable;
      delete summary.ownerReceivedThisMonth;
      delete summary.ownerPaidThisMonth;
      delete summary.ownerOutstandingReceivable;
      delete summary.ownerOutstandingPayable;
      delete summary.ownerPaymentsDueToday;
      delete summary.ownerOverdueStatements;
    }

    if (userId && role === Role.SUPER_ADMIN) {
      const approvalStats = await this.approvalsService.getDashboardStats(
        role,
        userId,
      );
      if (approvalStats) {
        summary.pendingApprovals = approvalStats.pendingApprovals;
        summary.todaysActivity = approvalStats.todaysActivity;
        summary.criticalRequests = approvalStats.criticalRequests;
        summary.rejectedToday = approvalStats.rejectedToday;
      }
    }

    return summary;
  }

  async getFinancialReconciliation(
    query: DashboardSummaryQueryDto,
    role: Role,
  ) {
    const unitId = query.unitId ?? query.apartmentId;
    const financialRange = this.resolveFinancialRange(query);
    return this.financialSummaryService.getReconciliation(
      this.buildProfitLossQuery(query, financialRange, unitId),
      role,
    );
  }

  async getRoomGrid(
    query: DashboardRoomGridQueryDto,
    role: Role,
  ): Promise<DashboardRoomGridItem[]> {
    const units = await this.loadUnitsForGrid(this.buildLiveUnitWhere(query));
    return units
      .map((unit) => this.mapUnitToGridItem(unit, role))
      .filter((item) => this.matchesResolvedFilters(item, query));
  }

  async getUnitGridDetail(
    unitId: string,
    role: Role,
  ): Promise<DashboardUnitGridDetail> {
    const units = await this.loadUnitsForGrid({
      id: unitId,
      isActive: true,
      property: { isActive: true },
    });
    const unit = units[0];
    if (!unit) {
      throw new NotFoundException('Unit not found');
    }

    const item = this.mapUnitToGridItem(unit, role);
    const checkedIn = unit.bookings.find(
      (b) => b.bookingStatus === BookingStatus.CHECKED_IN,
    );
    const pendingClearance = unit.bookings.find(
      (b) =>
        b.bookingStatus === BookingStatus.CHECKED_OUT &&
        (!b.cleaningCleared || !b.accountsCleared),
    );
    const activeTenancy = unit.tenancies[0];
    const confirmed = unit.bookings.find(
      (b) => b.bookingStatus === BookingStatus.CONFIRMED,
    );
    const pending = unit.bookings.find(
      (b) => b.bookingStatus === BookingStatus.PENDING,
    );

    return {
      ...item,
      floor: unit.floor,
      bedrooms: unit.bedrooms,
      notes: unit.notes,
      monthlyRent: unit.monthlyRent?.toString() ?? null,
      dailyRate: unit.dailyRate?.toString() ?? null,
      hourlyRate: unit.hourlyRate?.toString() ?? null,
      confirmedBookingId: confirmed?.id ?? null,
      pendingClearanceBookingId: pendingClearance?.id ?? null,
      allowedActions: resolveAllowedActions({
        role,
        resolved: {
          status: item.status,
          statusLabel: item.statusLabel,
          statusTone: item.statusTone,
          hotelUseAllowed: item.hotelUseAllowed,
          hasOutstanding: item.hasOutstanding,
          bookingType: item.bookingType,
          priority: 6,
        },
        hasCheckedInBooking: Boolean(checkedIn),
        hasConfirmedBooking: Boolean(confirmed),
        hasPendingBooking: Boolean(pending),
        hasPendingClearance: Boolean(pendingClearance),
        hasActiveTenancy: Boolean(activeTenancy),
        tenancyEmpty:
          activeTenancy?.occupancyState === MonthlyOccupancyState.EMPTY,
      }),
    };
  }

  async getFilterOptions(): Promise<DashboardFilterOptions> {
    const [properties, units] = await Promise.all([
      this.prisma.property.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
        select: { id: true, name: true },
      }),
      this.prisma.unit.findMany({
        where: {
          isActive: true,
          property: { isActive: true },
        },
        orderBy: [{ property: { name: 'asc' } }, { unitNumber: 'asc' }],
        select: {
          id: true,
          unitNumber: true,
          unitType: true,
          propertyId: true,
          property: { select: { name: true } },
        },
      }),
    ]);

    const mapped = units.map((unit) => ({
      id: unit.id,
      unitNumber: unit.unitNumber,
      propertyId: unit.propertyId,
      propertyName: unit.property.name,
      unitType: unit.unitType,
    }));

    return {
      properties,
      units: mapped,
      apartments: mapped.filter((u) => u.unitType === UnitType.APARTMENT),
    };
  }

  private async loadUnitsForGrid(
    where: Prisma.UnitWhereInput,
  ): Promise<UnitGridRow[]> {
    return this.prisma.unit.findMany({
      where,
      orderBy: [{ property: { name: 'asc' } }, { unitNumber: 'asc' }],
      select: {
        id: true,
        propertyId: true,
        unitNumber: true,
        unitType: true,
        status: true,
        floor: true,
        bedrooms: true,
        notes: true,
        monthlyRent: true,
        dailyRate: true,
        hourlyRate: true,
        property: { select: { name: true } },
        tenancies: {
          where: { tenancyStatus: MonthlyTenancyStatus.ACTIVE },
          take: 1,
          select: {
            id: true,
            occupancyState: true,
            hotelUseAllowed: true,
            totalReceived: true,
            remainingBalance: true,
            agreementEnd: true,
            tenant: { select: { fullName: true } },
          },
        },
        bookings: {
          where: {
            OR: [
              { bookingStatus: BookingStatus.CHECKED_IN },
              { bookingStatus: BookingStatus.CONFIRMED },
              { bookingStatus: BookingStatus.PENDING },
              {
                bookingStatus: BookingStatus.CHECKED_OUT,
                OR: [
                  { cleaningCleared: false },
                  { accountsCleared: false },
                ],
              },
            ],
          },
          orderBy: [{ updatedAt: 'desc' }],
          take: 8,
          select: {
            id: true,
            bookingType: true,
            bookingStatus: true,
            occupancySource: true,
            checkInDateTime: true,
            checkOutDateTime: true,
            receivedAmount: true,
            remainingAmount: true,
            totalAmount: true,
            cleaningCleared: true,
            accountsCleared: true,
            guest: { select: { fullName: true } },
            hotelUse: {
              select: { settlementType: true, status: true },
            },
          },
        },
        _count: {
          select: {
            roomAssets: {
              where: {
                isActive: true,
                condition: { in: ['DAMAGED', 'MISSING'] },
              },
            },
          },
        },
      },
    });
  }

  private mapUnitToGridItem(
    unit: UnitGridRow,
    role: Role,
  ): DashboardRoomGridItem {
    const checkedIn = unit.bookings.find(
      (b) => b.bookingStatus === BookingStatus.CHECKED_IN,
    );
    const liveBooking =
      checkedIn ??
      unit.bookings.find((b) => b.bookingStatus === BookingStatus.CONFIRMED) ??
      unit.bookings.find((b) => b.bookingStatus === BookingStatus.PENDING);
    const pendingClearance = unit.bookings.find(
      (b) =>
        b.bookingStatus === BookingStatus.CHECKED_OUT &&
        (!b.cleaningCleared || !b.accountsCleared),
    );
    const activeTenancy = unit.tenancies[0];
    const damagedAssetCount = unit._count.roomAssets;

    const resolved = resolveUnitStatus({
      unitStatus: unit.status,
      checkedInBooking: liveBooking
        ? {
            bookingType: liveBooking.bookingType,
            remainingAmount: liveBooking.remainingAmount,
            checkOutDateTime: liveBooking.checkOutDateTime,
            bookingStatus: liveBooking.bookingStatus,
          }
        : null,
      pendingClearanceBooking: pendingClearance
        ? {
            cleaningCleared: pendingClearance.cleaningCleared,
            accountsCleared: pendingClearance.accountsCleared,
          }
        : null,
      activeTenancy: activeTenancy
        ? {
            occupancyState: activeTenancy.occupancyState,
            hotelUseAllowed: activeTenancy.hotelUseAllowed,
            remainingBalance: activeTenancy.remainingBalance,
          }
        : null,
    });

    const rent =
      liveBooking?.totalAmount.toString() ??
      (activeTenancy
        ? (unit.monthlyRent?.toString() ?? null)
        : (unit.monthlyRent?.toString() ??
          unit.dailyRate?.toString() ??
          unit.hourlyRate?.toString() ??
          null));

    const paid =
      liveBooking?.receivedAmount.toString() ??
      activeTenancy?.totalReceived.toString() ??
      null;
    const remaining =
      liveBooking?.remainingAmount.toString() ??
      activeTenancy?.remainingBalance.toString() ??
      null;

    const item: DashboardRoomGridItem = {
      id: unit.id,
      propertyId: unit.propertyId,
      propertyName: unit.property.name,
      roomNumber: unit.unitNumber,
      unitNumber: unit.unitNumber,
      apartmentName:
        unit.unitType === UnitType.APARTMENT ? unit.unitNumber : null,
      unitType: unit.unitType,
      status: resolved.status,
      statusLabel: resolved.statusLabel,
      statusTone: resolved.statusTone,
      hotelUseAllowed: resolved.hotelUseAllowed,
      hasOutstanding: resolved.hasOutstanding,
      bookingType: resolved.bookingType,
      guestName: liveBooking?.guest.fullName ?? null,
      monthlyTenant: activeTenancy?.tenant.fullName ?? null,
      occupancySource: liveBooking?.occupancySource ?? null,
      settlementType:
        role === Role.RECEPTIONIST
          ? null
          : (liveBooking?.hotelUse?.settlementType ?? null),
      bookingId: liveBooking?.id ?? pendingClearance?.id ?? null,
      tenancyId: activeTenancy?.id ?? null,
      checkInDate: liveBooking?.checkInDateTime.toISOString() ?? null,
      checkoutDate:
        liveBooking?.checkOutDateTime.toISOString() ??
        pendingClearance?.checkOutDateTime.toISOString() ??
        activeTenancy?.agreementEnd?.toISOString() ??
        null,
      rent,
      paid,
      remaining,
      cleaningCleared: pendingClearance
        ? pendingClearance.cleaningCleared
        : liveBooking
          ? null
          : null,
      accountsCleared: pendingClearance
        ? pendingClearance.accountsCleared
        : null,
      assetWarning: damagedAssetCount > 0,
      damagedAssetCount,
      canCheckOut: Boolean(
        checkedIn &&
          (checkedIn.bookingType === BookingType.DAILY ||
            checkedIn.bookingType === BookingType.HOURLY),
      ),
      bookingStatus: liveBooking?.bookingStatus ?? null,
    };

    if (role === Role.RECEPTIONIST) {
      // Operational amounts for live hotel guests only;
      // hide monthly tenancy / vacant financials.
      if (!liveBooking) {
        item.rent = null;
        item.paid = null;
        item.remaining = null;
        item.hasOutstanding = false;
      }
    }

    return item;
  }

  private matchesResolvedFilters(
    item: DashboardRoomGridItem,
    query: {
      status?: UnitStatus;
      displayStatus?: UnitStatus;
      bookingType?: DashboardBookingTypeFilter;
      search?: string;
    },
  ): boolean {
    const statusFilter = query.displayStatus ?? query.status;
    if (statusFilter && item.status !== statusFilter) {
      return false;
    }

    if (query.bookingType) {
      if (item.bookingType !== query.bookingType) {
        return false;
      }
    }

    const search = query.search?.trim().toLowerCase();
    if (search) {
      const haystack = [
        item.propertyName,
        item.unitNumber,
        item.roomNumber,
        item.guestName ?? '',
        item.monthlyTenant ?? '',
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(search)) {
        return false;
      }
    }

    return true;
  }

  private buildLiveUnitWhere(
    query: {
      propertyId?: string;
      apartmentId?: string;
      unitId?: string;
      unitType?: UnitType;
      bookingType?: DashboardBookingTypeFilter;
      search?: string;
    },
  ): Prisma.UnitWhereInput {
    const unitId = query.unitId ?? query.apartmentId;
    const where: Prisma.UnitWhereInput = {
      isActive: true,
      property: { isActive: true },
    };

    if (query.propertyId) {
      where.propertyId = query.propertyId;
    }
    if (unitId) {
      where.id = unitId;
    }
    if (query.unitType) {
      where.unitType = query.unitType;
    }

    // Push booking-type / guest search into Prisma when possible to shrink result set.
    if (query.bookingType === 'HOURLY' || query.bookingType === 'DAILY') {
      where.bookings = {
        some: {
          bookingStatus: BookingStatus.CHECKED_IN,
          bookingType: query.bookingType,
        },
      };
    } else if (query.bookingType === 'MONTHLY') {
      where.tenancies = {
        some: { tenancyStatus: MonthlyTenancyStatus.ACTIVE },
      };
    }

    if (query.search?.trim()) {
      const term = query.search.trim();
      where.OR = [
        { unitNumber: { contains: term, mode: 'insensitive' } },
        { property: { name: { contains: term, mode: 'insensitive' } } },
        {
          bookings: {
            some: {
              bookingStatus: {
                in: [BookingStatus.CHECKED_IN, BookingStatus.CHECKED_OUT],
              },
              guest: {
                fullName: { contains: term, mode: 'insensitive' },
              },
            },
          },
        },
        {
          tenancies: {
            some: {
              tenancyStatus: MonthlyTenancyStatus.ACTIVE,
              tenant: {
                fullName: { contains: term, mode: 'insensitive' },
              },
            },
          },
        },
      ];
    }

    return where;
  }

  /**
   * Build P&L query without mixing month/year with start/end (period priority
   * would otherwise prefer start/end and can shift days across timezones).
   */
  private buildProfitLossQuery(
    query: DashboardSummaryQueryDto,
    financialRange:
      | {
          startDate?: string;
          endDate?: string;
          expenseDate?: Prisma.DateTimeFilter;
        }
      | undefined,
    unitIdOverride?: string,
  ): ProfitLossFilterInput {
    const unitId = unitIdOverride ?? query.unitId ?? query.apartmentId;
    const base: ProfitLossFilterInput = {
      propertyId: query.propertyId,
      unitId,
      accountingView: 'CASH',
    };

    if (query.today) {
      return { ...base, date: this.toIsoDate(new Date()) };
    }
    if (query.date) {
      return { ...base, date: query.date };
    }
    if (query.month !== undefined && query.year !== undefined) {
      return { ...base, month: query.month, year: query.year };
    }
    if (query.year !== undefined && query.month === undefined) {
      return { ...base, year: query.year };
    }
    if (financialRange?.startDate && financialRange?.endDate) {
      return {
        ...base,
        startDate: financialRange.startDate,
        endDate: financialRange.endDate,
      };
    }
    return base;
  }

  private resolveFinancialRange(query: DashboardSummaryQueryDto):
    | {
        startDate?: string;
        endDate?: string;
        expenseDate?: Prisma.DateTimeFilter;
      }
    | undefined {
    const startDate = query.startDate ?? query.dateFrom;
    const endDate = query.endDate ?? query.dateTo;

    if (query.today) {
      const iso = this.toIsoDate(new Date());
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      return {
        startDate: iso,
        endDate: iso,
        expenseDate: { gte: start, lte: end },
      };
    }

    if (startDate || endDate) {
      const expenseDate: Prisma.DateTimeFilter = {};
      if (startDate) {
        const from = new Date(`${startDate}T00:00:00`);
        if (Number.isNaN(from.getTime())) {
          throw new BadRequestException('Invalid startDate/dateFrom');
        }
        expenseDate.gte = from;
      }
      if (endDate) {
        const to = new Date(`${endDate}T23:59:59.999`);
        if (Number.isNaN(to.getTime())) {
          throw new BadRequestException('Invalid endDate/dateTo');
        }
        expenseDate.lte = to;
      }
      return { startDate, endDate, expenseDate };
    }

    if (query.date) {
      const start = new Date(`${query.date}T00:00:00`);
      const end = new Date(`${query.date}T23:59:59.999`);
      if (Number.isNaN(start.getTime())) {
        throw new BadRequestException('Invalid date filter');
      }
      return {
        startDate: query.date,
        endDate: query.date,
        expenseDate: { gte: start, lte: end },
      };
    }

    if (query.month !== undefined && query.year === undefined) {
      throw new BadRequestException('year is required when month is provided');
    }

    if (query.year !== undefined && query.month !== undefined) {
      const start = new Date(query.year, query.month - 1, 1, 0, 0, 0, 0);
      const end = new Date(query.year, query.month, 0, 23, 59, 59, 999);
      return {
        startDate: this.toIsoDate(start),
        endDate: this.toIsoDate(end),
        expenseDate: { gte: start, lte: end },
      };
    }

    if (query.year !== undefined) {
      const start = new Date(query.year, 0, 1, 0, 0, 0, 0);
      const end = new Date(query.year, 11, 31, 23, 59, 59, 999);
      return {
        startDate: this.toIsoDate(start),
        endDate: this.toIsoDate(end),
        expenseDate: { gte: start, lte: end },
      };
    }

    return undefined;
  }

  private toIsoDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}
