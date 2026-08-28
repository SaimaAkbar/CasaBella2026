import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BookingStatus,
  MonthlyTenancyStatus,
  Prisma,
  Role,
  UnitStatus,
} from '../../generated/prisma/client';
import { BookingsService } from '../bookings/bookings.service';
import type { AuthUser } from '../common/types/auth-user.type';
import { ElectricityReadingsService } from '../electricity-readings/electricity-readings.service';
import { EmployeesService } from '../employees/employees.service';
import { ExpensesService } from '../expenses/expenses.service';
import { InventoryItemsService } from '../inventory-items/inventory-items.service';
import { InventoryMovementsService } from '../inventory-movements/inventory-movements.service';
import { MonthlyTenanciesService } from '../monthly-tenancies/monthly-tenancies.service';
import { PaymentsService } from '../payments/payments.service';
import { sumNetReceived } from '../payments/payment-balance';
import { PrismaService } from '../prisma/prisma.service';
import { ProfitLossService } from '../profit-loss/profit-loss.service';
import { RoomAssetsService } from '../room-assets/room-assets.service';
import { SalaryRecordsService } from '../salary-records/salary-records.service';
import { QueryReportDto } from './dto/query-report.dto';
import {
  assertReportAccess,
  listReportCatalog,
  type ReportAccessContext,
} from './report-permissions';
import { buildReport, money } from './report-response';
import type { ReportPayload, ReportType } from './report.types';

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bookingsService: BookingsService,
    private readonly paymentsService: PaymentsService,
    private readonly expensesService: ExpensesService,
    private readonly electricityService: ElectricityReadingsService,
    private readonly monthlyTenanciesService: MonthlyTenanciesService,
    private readonly employeesService: EmployeesService,
    private readonly salaryRecordsService: SalaryRecordsService,
    private readonly inventoryItemsService: InventoryItemsService,
    private readonly inventoryMovementsService: InventoryMovementsService,
    private readonly roomAssetsService: RoomAssetsService,
    private readonly profitLossService: ProfitLossService,
  ) {}

  private ctx(user: AuthUser): ReportAccessContext {
    return {
      role: user.role,
      canAccessSalary: user.canAccessSalary ?? false,
      canAccessProfitLoss: user.canAccessProfitLoss ?? false,
    };
  }

  catalog(user: AuthUser) {
    return listReportCatalog(this.ctx(user));
  }

  async generate(
    reportType: ReportType,
    query: QueryReportDto,
    user: AuthUser,
    options?: { allRows?: boolean },
  ): Promise<ReportPayload> {
    assertReportAccess(reportType, this.ctx(user));
    await this.assertPropertyUnit(query.propertyId, query.unitId);

    switch (reportType) {
      case 'occupancy':
        return this.occupancy(query, user, options);
      case 'daily-bookings':
        return this.dailyBookings(query, user, options);
      case 'monthly-tenants':
        return this.monthlyTenants(query, user, options);
      case 'payments':
        return this.payments(query, user, options);
      case 'outstanding-balances':
        return this.outstanding(query, user, options);
      case 'expenses':
        return this.expenses(query, user, options);
      case 'electricity':
        return this.electricity(query, user, options);
      case 'property-income':
        return this.propertyIncome(query, user, options);
      case 'profit-loss':
        return this.profitLoss(query, user, options);
      case 'owners':
        return this.ownersDirectory(query, user, options);
      case 'owner-payments':
        return this.ownerPayments(query, user, options);
      case 'employees':
        return this.employees(query, user, options);
      case 'salaries':
        return this.salaries(query, user, options);
      case 'inventory-stock':
        return this.inventoryStock(query, user, options);
      case 'inventory-movements':
        return this.inventoryMovements(query, user, options);
      case 'room-assets':
        return this.roomAssets(query, user, options);
      case 'audit-logs':
        return this.auditLogs(query, user, options);
      default:
        throw new BadRequestException('Unsupported report type');
    }
  }

  private async assertPropertyUnit(propertyId?: string, unitId?: string) {
    if (propertyId) {
      const property = await this.prisma.property.findUnique({
        where: { id: propertyId },
        select: { id: true },
      });
      if (!property) throw new NotFoundException('Property not found');
    }
    if (unitId) {
      const unit = await this.prisma.unit.findUnique({
        where: { id: unitId },
        select: { id: true, propertyId: true },
      });
      if (!unit) throw new NotFoundException('Unit not found');
      if (propertyId && unit.propertyId !== propertyId) {
        throw new BadRequestException(
          'Unit does not belong to the selected property',
        );
      }
    }
  }

  private filterSnapshot(query: QueryReportDto) {
    const { page: _p, limit: _l, ...rest } = query;
    return rest as Record<string, unknown>;
  }

  private notImplemented(
    reportType: ReportType,
    query: QueryReportDto,
    user: AuthUser,
    options: { allRows?: boolean } | undefined,
    meta: { notice: string },
  ) {
    return buildReport({
      reportType,
      user,
      filters: this.filterSnapshot(query),
      columns: [],
      rows: [],
      summary: { total: 0 },
      page: query.page,
      limit: query.limit,
      allRows: options?.allRows,
      metadata: {
        availability: 'NOT_IMPLEMENTED',
        notice: meta.notice,
        confidential: true,
      },
    });
  }

  private async occupancy(
    query: QueryReportDto,
    user: AuthUser,
    options?: { allRows?: boolean },
  ) {
    const units = await this.prisma.unit.findMany({
      where: {
        isActive: true,
        ...(query.propertyId ? { propertyId: query.propertyId } : {}),
        ...(query.unitId ? { id: query.unitId } : {}),
      },
      orderBy: [{ property: { name: 'asc' } }, { unitNumber: 'asc' }],
      include: {
        property: { select: { id: true, name: true } },
        bookings: {
          where: { bookingStatus: BookingStatus.CHECKED_IN },
          take: 1,
          orderBy: { actualCheckInAt: 'desc' },
          include: { guest: { select: { fullName: true } } },
        },
        tenancies: {
          where: { tenancyStatus: MonthlyTenancyStatus.ACTIVE },
          take: 1,
          include: { tenant: { select: { fullName: true } } },
        },
      },
    });

    const hideFinance = user.role === Role.RECEPTIONIST;
    const rows = units.map((unit) => {
      const booking = unit.bookings[0];
      const tenancy = unit.tenancies[0];
      const occupant =
        booking?.guest.fullName ?? tenancy?.tenant.fullName ?? null;
      const occupancyType = booking
        ? 'BOOKING'
        : tenancy
          ? 'MONTHLY_TENANCY'
          : null;
      return {
        property: unit.property.name,
        unitNumber: unit.unitNumber,
        unitType: unit.unitType,
        status: unit.status,
        occupant,
        occupancyType,
        startDate:
          booking?.checkInDateTime?.toISOString() ??
          tenancy?.agreementStart?.toISOString() ??
          null,
        endDate:
          booking?.checkOutDateTime?.toISOString() ??
          tenancy?.agreementEnd?.toISOString() ??
          null,
        cleaningStatus:
          unit.status === UnitStatus.CLEANING_REQUIRED ? 'REQUIRED' : 'OK',
        accountsClear: hideFinance
          ? null
          : booking
            ? Number(booking.remainingAmount) <= 0
            : tenancy
              ? Number(tenancy.remainingBalance) <= 0
              : null,
        paymentState: hideFinance ? null : (booking?.paymentState ?? null),
      };
    });

    const counts = {
      totalUnits: units.length,
      occupied: units.filter((u) => u.status === UnitStatus.OCCUPIED).length,
      available: units.filter((u) => u.status === UnitStatus.AVAILABLE).length,
      cleaningRequired: units.filter(
        (u) => u.status === UnitStatus.CLEANING_REQUIRED,
      ).length,
      monthlyTenantEmpty: units.filter(
        (u) => u.status === UnitStatus.MONTHLY_TENANT_VACANT,
      ).length,
      maintenance: units.filter((u) => u.status === UnitStatus.MAINTENANCE)
        .length,
      blocked: units.filter((u) => u.status === UnitStatus.BLOCKED).length,
    };
    const occupancyPct =
      counts.totalUnits === 0
        ? 0
        : Number(((counts.occupied / counts.totalUnits) * 100).toFixed(2));

    return buildReport({
      reportType: 'occupancy',
      user,
      filters: this.filterSnapshot(query),
      summary: { ...counts, occupancyPercentage: occupancyPct },
      columns: [
        { key: 'property', header: 'Property' },
        { key: 'unitNumber', header: 'Unit' },
        { key: 'unitType', header: 'Type' },
        { key: 'status', header: 'Status' },
        { key: 'occupant', header: 'Guest / Tenant' },
        { key: 'occupancyType', header: 'Occupancy Type' },
        { key: 'startDate', header: 'Start' },
        { key: 'endDate', header: 'End' },
        { key: 'cleaningStatus', header: 'Cleaning' },
        {
          key: 'paymentState',
          header: 'Payment Status',
          sensitive: true,
        },
      ].filter((c) => !(hideFinance && c.sensitive)),
      rows: hideFinance
        ? rows.map(({ paymentState: _p, accountsClear: _a, ...rest }) => rest)
        : rows,
      page: query.page,
      limit: query.limit,
      allRows: options?.allRows,
    });
  }

  private async dailyBookings(
    query: QueryReportDto,
    user: AuthUser,
    options?: { allRows?: boolean },
  ) {
    const bookings = await this.bookingsService.findAll(
      {
        propertyId: query.propertyId,
        unitId: query.unitId,
        guestId: query.guestId,
        bookingType: query.bookingType as never,
        bookingStatus: query.bookingStatus as never,
        month: query.month,
        year: query.year,
        startDate: query.startDate,
        endDate: query.endDate,
        search: query.search,
      },
      user.role,
    );
    const hideFinance = user.role === Role.RECEPTIONIST;
    const rows = bookings.map((b) => {
      const row: Record<string, unknown> = {
        bookingNumber: b.bookingNumber,
        guestName: b.guest?.fullName ?? null,
        phone: b.guest?.phone ?? null,
        property: b.unit?.property?.name ?? null,
        unit: b.unit?.unitNumber ?? null,
        bookingType: b.bookingType,
        checkIn: b.checkInDateTime,
        checkOut: b.checkOutDateTime,
        bookingStatus: b.bookingStatus,
        bookingSource: b.bookingSource ?? null,
      };
      if (!hideFinance) {
        row.totalAmount = money(b.totalAmount);
        row.receivedAmount = money(b.receivedAmount);
        row.remainingAmount = money(b.remainingAmount);
        row.paymentState = b.paymentState;
      }
      return row;
    });

    const checkedIn = bookings.filter(
      (b) => b.bookingStatus === 'CHECKED_IN',
    ).length;
    const checkedOut = bookings.filter(
      (b) => b.bookingStatus === 'CHECKED_OUT',
    ).length;
    const cancelled = bookings.filter(
      (b) => b.bookingStatus === 'CANCELLED',
    ).length;
    const totalBookingValue = bookings.reduce(
      (sum, b) => sum.plus(new Prisma.Decimal(money(b.totalAmount))),
      new Prisma.Decimal(0),
    );
    const totalReceived = bookings.reduce(
      (sum, b) => sum.plus(new Prisma.Decimal(money(b.receivedAmount))),
      new Prisma.Decimal(0),
    );
    const remainingBalance = bookings.reduce(
      (sum, b) => sum.plus(new Prisma.Decimal(money(b.remainingAmount))),
      new Prisma.Decimal(0),
    );

    return buildReport({
      reportType: 'daily-bookings',
      user,
      filters: this.filterSnapshot(query),
      summary: hideFinance
        ? {
            totalBookings: bookings.length,
            checkedIn,
            checkedOut,
            cancelled,
          }
        : {
            totalBookings: bookings.length,
            checkedIn,
            checkedOut,
            cancelled,
            totalBookingValue: money(totalBookingValue),
            totalReceived: money(totalReceived),
            remainingBalance: money(remainingBalance),
          },
      columns: [
        { key: 'bookingNumber', header: 'Booking #' },
        { key: 'guestName', header: 'Guest' },
        { key: 'phone', header: 'Phone' },
        { key: 'property', header: 'Property' },
        { key: 'unit', header: 'Unit' },
        { key: 'bookingType', header: 'Type' },
        { key: 'checkIn', header: 'Check-in' },
        { key: 'checkOut', header: 'Check-out' },
        { key: 'totalAmount', header: 'Total', sensitive: true },
        { key: 'receivedAmount', header: 'Received', sensitive: true },
        { key: 'remainingAmount', header: 'Remaining', sensitive: true },
        { key: 'paymentState', header: 'Payment', sensitive: true },
        { key: 'bookingStatus', header: 'Status' },
        { key: 'bookingSource', header: 'Source' },
      ].filter((c) => !(hideFinance && c.sensitive)),
      rows,
      page: query.page,
      limit: query.limit,
      allRows: options?.allRows,
    });
  }

  private async monthlyTenants(
    query: QueryReportDto,
    user: AuthUser,
    options?: { allRows?: boolean },
  ) {
    const tenancies = await this.monthlyTenanciesService.findAll(
      {
        propertyId: query.propertyId,
        unitId: query.unitId,
        tenantId: query.tenantId,
        month: query.month,
        year: query.year,
        startDate: query.startDate,
        endDate: query.endDate,
        search: query.search,
      },
      user.role,
    );

    const hideFinance = user.role === Role.RECEPTIONIST;
    const rows = tenancies.map((t) => {
      const record = t as Record<string, unknown> & {
        tenant?: { fullName?: string; phone?: string };
        unit?: { unitNumber?: string; property?: { name?: string } };
      };
      const row: Record<string, unknown> = {
        tenantName: record.tenant?.fullName ?? null,
        phone: record.tenant?.phone ?? null,
        property: record.unit?.property?.name ?? null,
        unit: record.unit?.unitNumber ?? null,
        agreementStart: record.agreementStart,
        agreementEnd: record.agreementEnd,
        occupancyState: record.occupancyState,
        tenancyStatus: record.tenancyStatus,
      };
      if (!hideFinance) {
        row.securityDeposit = money(record.securityDeposit);
        row.monthlyRent = money(record.monthlyRent);
        row.totalPayable = money(record.totalPayable);
        row.totalReceived = money(record.totalReceived);
        row.remainingBalance = money(record.remainingBalance);
      }
      return row;
    });

    return buildReport({
      reportType: 'monthly-tenants',
      user,
      filters: this.filterSnapshot(query),
      summary: { totalTenancies: tenancies.length },
      columns: [
        { key: 'tenantName', header: 'Tenant' },
        { key: 'phone', header: 'Phone' },
        { key: 'property', header: 'Property' },
        { key: 'unit', header: 'Unit' },
        { key: 'agreementStart', header: 'Start' },
        { key: 'agreementEnd', header: 'End' },
        { key: 'securityDeposit', header: 'Deposit', sensitive: true },
        { key: 'monthlyRent', header: 'Rent', sensitive: true },
        { key: 'totalPayable', header: 'Payable', sensitive: true },
        { key: 'totalReceived', header: 'Received', sensitive: true },
        { key: 'remainingBalance', header: 'Remaining', sensitive: true },
        { key: 'occupancyState', header: 'Occupancy' },
        { key: 'tenancyStatus', header: 'Status' },
      ].filter((c) => !(hideFinance && c.sensitive)),
      rows,
      page: query.page,
      limit: query.limit,
      allRows: options?.allRows,
    });
  }

  private async payments(
    query: QueryReportDto,
    user: AuthUser,
    options?: { allRows?: boolean },
  ) {
    if (user.role === Role.RECEPTIONIST) {
      throw new BadRequestException('Payment report is not available');
    }
    const payments = await this.paymentsService.findAll(
      {
        paymentMethod: query.paymentMethod as never,
        status: query.paymentStatus as never,
        date: query.date,
        month: query.month,
        year: query.year,
        startDate: query.startDate,
        endDate: query.endDate,
        search: query.search,
      },
      user.role,
    );

    const net = sumNetReceived(
      payments.map((p) => ({
        transactionType: p.transactionType as never,
        amount: new Prisma.Decimal(money(p.amount)),
        status: String(p.status),
        notes: p.notes,
      })),
    );

    let refunds = new Prisma.Decimal(0);
    let reversals = new Prisma.Decimal(0);
    let adjustments = new Prisma.Decimal(0);
    let bookingPayments = new Prisma.Decimal(0);
    let monthlyPayments = new Prisma.Decimal(0);

    for (const p of payments) {
      const amt = new Prisma.Decimal(money(p.amount));
      if (p.transactionType === 'REFUND' && p.status === 'COMPLETED') {
        refunds = refunds.plus(amt);
      }
      if (p.transactionType === 'REVERSAL' && p.status === 'COMPLETED') {
        reversals = reversals.plus(amt);
      }
      if (p.transactionType === 'ADJUSTMENT' && p.status === 'COMPLETED') {
        adjustments = adjustments.plus(amt);
      }
      if (p.paymentForType === 'BOOKING' && p.transactionType === 'PAYMENT') {
        bookingPayments = bookingPayments.plus(amt);
      }
      if (
        p.paymentForType === 'MONTHLY_TENANCY' &&
        p.transactionType === 'PAYMENT'
      ) {
        monthlyPayments = monthlyPayments.plus(amt);
      }
    }

    const rows = payments.map((p) => ({
      paymentNumber: p.paymentNumber,
      paymentDate: p.paymentDate,
      sourceType: p.paymentForType,
      guestOrTenant:
        p.booking?.guest?.fullName ?? p.monthlyTenancy?.tenant?.fullName ?? null,
      property:
        p.booking?.unit?.property?.name ??
        p.monthlyTenancy?.unit?.property?.name ??
        null,
      unit:
        p.booking?.unit?.unitNumber ??
        p.monthlyTenancy?.unit?.unitNumber ??
        null,
      transactionType: p.transactionType,
      amount: money(p.amount),
      paymentMethod: p.paymentMethod,
      status: p.status,
      reference: p.transactionReference ?? null,
      createdBy: p.createdBy?.fullName ?? null,
    }));

    return buildReport({
      reportType: 'payments',
      user,
      filters: this.filterSnapshot(query),
      summary: {
        totalPayments: payments.length,
        totalRefunded: money(refunds),
        totalReversals: money(reversals),
        totalAdjustments: money(adjustments),
        netReceived: money(net),
        bookingPayments: money(bookingPayments),
        monthlyTenantPayments: money(monthlyPayments),
      },
      columns: [
        { key: 'paymentNumber', header: 'Payment #' },
        { key: 'paymentDate', header: 'Date' },
        { key: 'sourceType', header: 'Source' },
        { key: 'guestOrTenant', header: 'Guest / Tenant' },
        { key: 'property', header: 'Property' },
        { key: 'unit', header: 'Unit' },
        { key: 'transactionType', header: 'Type' },
        { key: 'amount', header: 'Amount' },
        { key: 'paymentMethod', header: 'Method' },
        { key: 'status', header: 'Status' },
        { key: 'reference', header: 'Reference' },
        { key: 'createdBy', header: 'Created By' },
      ],
      rows,
      totals: { netReceived: money(net) },
      page: query.page,
      limit: query.limit,
      allRows: options?.allRows,
    });
  }

  private async outstanding(
    query: QueryReportDto,
    user: AuthUser,
    options?: { allRows?: boolean },
  ) {
    const [bookings, tenancies] = await Promise.all([
      this.prisma.booking.findMany({
        where: {
          remainingAmount: { gt: 0 },
          bookingStatus: {
            notIn: [BookingStatus.CANCELLED, BookingStatus.NO_SHOW],
          },
          ...(query.propertyId
            ? { unit: { propertyId: query.propertyId } }
            : {}),
          ...(query.unitId ? { unitId: query.unitId } : {}),
        },
        include: {
          guest: { select: { fullName: true } },
          unit: {
            select: {
              unitNumber: true,
              property: { select: { name: true } },
            },
          },
        },
      }),
      this.prisma.monthlyTenancy.findMany({
        where: {
          remainingBalance: { gt: 0 },
          ...(query.propertyId
            ? { unit: { propertyId: query.propertyId } }
            : {}),
          ...(query.unitId ? { unitId: query.unitId } : {}),
        },
        include: {
          tenant: { select: { fullName: true } },
          unit: {
            select: {
              unitNumber: true,
              property: { select: { name: true } },
            },
          },
        },
      }),
    ]);

    const now = Date.now();
    const bookingRows = bookings.map((b) => {
      const due = b.checkOutDateTime?.getTime() ?? now;
      const overdueDays = Math.max(
        0,
        Math.floor((now - due) / (1000 * 60 * 60 * 24)),
      );
      return {
        recordType: 'BOOKING',
        party: b.guest.fullName,
        property: b.unit.property.name,
        unit: b.unit.unitNumber,
        totalPayable: money(b.totalAmount),
        receivedOrPaid: money(b.receivedAmount),
        remaining: money(b.remainingAmount),
        dueDate: b.checkOutDateTime?.toISOString() ?? null,
        status: b.paymentState,
        overdueDays,
      };
    });

    const tenancyRows = tenancies.map((t) => ({
      recordType: 'MONTHLY_TENANCY',
      party: t.tenant.fullName,
      property: t.unit.property.name,
      unit: t.unit.unitNumber,
      totalPayable: money(t.totalPayable),
      receivedOrPaid: money(t.totalReceived),
      remaining: money(t.remainingBalance),
      dueDate: t.agreementEnd?.toISOString() ?? null,
      status: Number(t.remainingBalance) <= 0 ? 'PAID' : 'OUTSTANDING',
      overdueDays: t.agreementEnd
        ? Math.max(
            0,
            Math.floor(
              (now - t.agreementEnd.getTime()) / (1000 * 60 * 60 * 24),
            ),
          )
        : 0,
    }));

    let rows = [...bookingRows, ...tenancyRows];
    if (user.role === Role.RECEPTIONIST) {
      rows = bookings
        .filter((b) => b.bookingStatus === BookingStatus.CHECKED_IN)
        .map((b) => {
          const due = b.checkOutDateTime?.getTime() ?? now;
          return {
            recordType: 'BOOKING',
            party: b.guest.fullName,
            property: b.unit.property.name,
            unit: b.unit.unitNumber,
            totalPayable: money(b.totalAmount),
            receivedOrPaid: money(b.receivedAmount),
            remaining: money(b.remainingAmount),
            dueDate: b.checkOutDateTime?.toISOString() ?? null,
            status: b.paymentState,
            overdueDays: Math.max(
              0,
              Math.floor((now - due) / (1000 * 60 * 60 * 24)),
            ),
          };
        });
    }

    const totalOutstanding = rows.reduce(
      (sum, r) => sum.plus(new Prisma.Decimal(String(r.remaining))),
      new Prisma.Decimal(0),
    );
    const overdueOutstanding = rows
      .filter((r) => Number(r.overdueDays) > 0)
      .reduce(
        (sum, r) => sum.plus(new Prisma.Decimal(String(r.remaining))),
        new Prisma.Decimal(0),
      );
    const guestOutstanding = rows
      .filter((r) => r.recordType === 'BOOKING')
      .reduce(
        (sum, r) => sum.plus(new Prisma.Decimal(String(r.remaining))),
        new Prisma.Decimal(0),
      );
    const tenantOutstanding = rows
      .filter((r) => r.recordType === 'MONTHLY_TENANCY')
      .reduce(
        (sum, r) => sum.plus(new Prisma.Decimal(String(r.remaining))),
        new Prisma.Decimal(0),
      );

    return buildReport({
      reportType: 'outstanding-balances',
      user,
      filters: this.filterSnapshot(query),
      summary: {
        totalOutstanding: money(totalOutstanding),
        overdueOutstanding: money(overdueOutstanding),
        guestOutstanding: money(guestOutstanding),
        tenantOutstanding: money(tenantOutstanding),
        ownerOutstanding: '0',
      },
      columns: [
        { key: 'recordType', header: 'Record Type' },
        { key: 'party', header: 'Person / Party' },
        { key: 'property', header: 'Property' },
        { key: 'unit', header: 'Unit' },
        { key: 'totalPayable', header: 'Payable' },
        { key: 'receivedOrPaid', header: 'Received / Paid' },
        { key: 'remaining', header: 'Remaining' },
        { key: 'dueDate', header: 'Due Date' },
        { key: 'status', header: 'Status' },
        { key: 'overdueDays', header: 'Overdue Days' },
      ],
      rows,
      page: query.page,
      limit: query.limit,
      allRows: options?.allRows,
      metadata: {
        notice:
          'Owner outstanding is unavailable until the Owner module is implemented.',
      },
    });
  }

  private async expenses(
    query: QueryReportDto,
    user: AuthUser,
    options?: { allRows?: boolean },
  ) {
    if (user.role === Role.RECEPTIONIST) {
      throw new BadRequestException('Expense report is not available');
    }
    const expenses = await this.expensesService.findAll(
      {
        propertyId: query.propertyId,
        unitId: query.unitId,
        categoryId: query.categoryId,
        paymentStatus: query.paymentStatus as never,
        date: query.date,
        month: query.month,
        year: query.year,
        startDate: query.startDate,
        endDate: query.endDate,
        search: query.search,
      },
      user.role,
    );

    const rows = expenses.map((e) => ({
      expenseNumber: e.expenseNumber,
      expenseDate: e.expenseDate,
      category: e.category?.name ?? null,
      scope: e.expenseScope,
      property: e.property?.name ?? null,
      unit: e.unit?.unitNumber ?? null,
      vendor: e.vendorName ?? null,
      amount: money(e.amount),
      paid: money(e.paidAmount),
      remaining: money(e.remainingAmount),
      paymentStatus: e.paymentStatus,
      finalized: e.isFinalized,
      createdBy: e.createdBy?.fullName ?? null,
    }));

    const totalExpense = expenses.reduce(
      (sum, e) => sum.plus(new Prisma.Decimal(money(e.amount))),
      new Prisma.Decimal(0),
    );
    const paidExpense = expenses.reduce(
      (sum, e) => sum.plus(new Prisma.Decimal(money(e.paidAmount))),
      new Prisma.Decimal(0),
    );
    const unpaidExpense = expenses.reduce(
      (sum, e) => sum.plus(new Prisma.Decimal(money(e.remainingAmount))),
      new Prisma.Decimal(0),
    );

    return buildReport({
      reportType: 'expenses',
      user,
      filters: this.filterSnapshot(query),
      summary: {
        totalExpense: money(totalExpense),
        paidExpense: money(paidExpense),
        unpaidExpense: money(unpaidExpense),
      },
      columns: [
        { key: 'expenseNumber', header: 'Expense #' },
        { key: 'expenseDate', header: 'Date' },
        { key: 'category', header: 'Category' },
        { key: 'scope', header: 'Scope' },
        { key: 'property', header: 'Property' },
        { key: 'unit', header: 'Unit' },
        { key: 'vendor', header: 'Vendor' },
        { key: 'amount', header: 'Amount' },
        { key: 'paid', header: 'Paid' },
        { key: 'remaining', header: 'Remaining' },
        { key: 'paymentStatus', header: 'Payment Status' },
        { key: 'finalized', header: 'Finalized' },
        { key: 'createdBy', header: 'Created By' },
      ],
      rows,
      page: query.page,
      limit: query.limit,
      allRows: options?.allRows,
    });
  }

  private async electricity(
    query: QueryReportDto,
    user: AuthUser,
    options?: { allRows?: boolean },
  ) {
    if (user.role === Role.RECEPTIONIST) {
      throw new BadRequestException('Electricity report is not available');
    }
    const readings = await this.electricityService.findAll(
      {
        propertyId: query.propertyId,
        unitId: query.unitId,
        billingMonth: query.month,
        billingYear: query.year,
      },
      user.role,
    );

    let totalUnits = new Prisma.Decimal(0);
    let totalAmount = new Prisma.Decimal(0);
    const rows = readings.map((r) => {
      const consumed = money(r.consumedUnits ?? '0');
      const amount = money(r.calculatedAmount);
      totalUnits = totalUnits.plus(new Prisma.Decimal(consumed));
      totalAmount = totalAmount.plus(new Prisma.Decimal(amount));
      return {
        property: r.property?.name ?? null,
        unit: r.unit?.unitNumber ?? null,
        previousUnits: money(r.previousUnits),
        currentUnits: money(r.currentUnits ?? '0'),
        consumedUnits: consumed,
        ratePerUnit: money(r.ratePerUnit),
        calculatedAmount: amount,
        billingMonth: r.billingMonth,
        billingYear: r.billingYear,
        readingDate: r.readingDate,
        linkedExpense: r.expense?.expenseNumber ?? null,
      };
    });

    return buildReport({
      reportType: 'electricity',
      user,
      filters: this.filterSnapshot(query),
      summary: {
        totalConsumedUnits: money(totalUnits),
        totalElectricityAmount: money(totalAmount),
        readings: readings.length,
      },
      columns: [
        { key: 'property', header: 'Property' },
        { key: 'unit', header: 'Unit' },
        { key: 'previousUnits', header: 'Previous' },
        { key: 'currentUnits', header: 'Current' },
        { key: 'consumedUnits', header: 'Consumed' },
        { key: 'ratePerUnit', header: 'Rate' },
        { key: 'calculatedAmount', header: 'Amount' },
        { key: 'billingMonth', header: 'Month' },
        { key: 'billingYear', header: 'Year' },
        { key: 'readingDate', header: 'Reading Date' },
        { key: 'linkedExpense', header: 'Expense' },
      ],
      rows,
      page: query.page,
      limit: query.limit,
      allRows: options?.allRows,
    });
  }

  private async propertyIncome(
    query: QueryReportDto,
    user: AuthUser,
    options?: { allRows?: boolean },
  ) {
    const ctx = this.ctx(user);
    assertReportAccess('property-income', ctx);

    if (query.propertyId) {
      const units = await this.profitLossService.getByUnit(
        {
          propertyId: query.propertyId,
          date: query.date,
          month: query.month,
          year: query.year,
          startDate: query.startDate,
          endDate: query.endDate,
          accountingView: query.accountingView,
        },
        user.role,
        ctx.canAccessProfitLoss,
      );
      const rows = units.map((u) => ({
        property: u.propertyName,
        unit: u.unitNumber,
        unitType: u.unitType,
        totalIncome: u.income,
        directExpenses: u.expenses,
        netAmount: u.netAmount,
        resultType: u.resultType,
      }));
      return buildReport({
        reportType: 'property-income',
        user,
        filters: this.filterSnapshot(query),
        summary: { units: rows.length },
        columns: [
          { key: 'property', header: 'Property' },
          { key: 'unit', header: 'Unit' },
          { key: 'unitType', header: 'Type' },
          { key: 'totalIncome', header: 'Income' },
          { key: 'directExpenses', header: 'Expenses' },
          { key: 'netAmount', header: 'Net' },
          { key: 'resultType', header: 'Result' },
        ],
        rows,
        page: query.page,
        limit: query.limit,
        allRows: options?.allRows,
        metadata: {
          notice: 'Calculated via ProfitLossService (no duplicate formulas).',
          confidential: true,
        },
      });
    }

    const properties = await this.profitLossService.getByProperty(
      {
        date: query.date,
        month: query.month,
        year: query.year,
        startDate: query.startDate,
        endDate: query.endDate,
        accountingView: query.accountingView,
      },
      user.role,
      ctx.canAccessProfitLoss,
    );

    const rows = properties.map((p) => ({
      property: p.propertyName,
      units: p.unitCount,
      totalIncome: p.income,
      directExpenses: p.expenses,
      netAmount: p.netAmount,
      resultType: p.resultType,
    }));

    return buildReport({
      reportType: 'property-income',
      user,
      filters: this.filterSnapshot(query),
      summary: { properties: rows.length },
      columns: [
        { key: 'property', header: 'Property' },
        { key: 'units', header: 'Units' },
        { key: 'totalIncome', header: 'Income' },
        { key: 'directExpenses', header: 'Expenses' },
        { key: 'netAmount', header: 'Net' },
        { key: 'resultType', header: 'Result' },
      ],
      rows,
      page: query.page,
      limit: query.limit,
      allRows: options?.allRows,
      metadata: {
        notice: 'Calculated via ProfitLossService (no duplicate formulas).',
        confidential: true,
      },
    });
  }

  private async profitLoss(
    query: QueryReportDto,
    user: AuthUser,
    options?: { allRows?: boolean },
  ) {
    const ctx = this.ctx(user);
    const filter = {
      date: query.date,
      month: query.month,
      year: query.year,
      startDate: query.startDate,
      endDate: query.endDate,
      propertyId: query.propertyId,
      unitId: query.unitId,
      accountingView: query.accountingView,
    };

    const [summary, incomeSources, expenseCategories, trend] =
      await Promise.all([
        this.profitLossService.getSummary(
          filter,
          user.role,
          ctx.canAccessProfitLoss,
        ),
        this.profitLossService.getIncomeSourceBreakdown(
          filter,
          user.role,
          ctx.canAccessProfitLoss,
        ),
        this.profitLossService.getExpenseCategoryBreakdown(
          filter,
          user.role,
          ctx.canAccessProfitLoss,
        ),
        this.profitLossService.getTrend(
          {
            year: query.year ?? new Date().getFullYear(),
            propertyId: query.propertyId,
            unitId: query.unitId,
            accountingView: query.accountingView,
          },
          user.role,
          ctx.canAccessProfitLoss,
        ),
      ]);

    const rows = [
      ...incomeSources.map((r) => ({
        section: 'INCOME',
        label: r.source,
        amount: r.amount,
      })),
      ...expenseCategories.map((r) => ({
        section: 'EXPENSE',
        label: r.category,
        amount: r.amount,
      })),
      {
        section: 'RESULT',
        label: summary.result.resultType,
        amount: summary.result.netAmount,
      },
      ...trend.map((t) => ({
        section: 'TREND',
        label: `Month ${t.month}`,
        amount: t.netAmount,
        income: t.income,
        expenses: t.expenses,
        resultType: t.resultType,
      })),
    ];

    return buildReport({
      reportType: 'profit-loss',
      user,
      filters: {
        ...this.filterSnapshot(query),
        resolvedPeriod: summary.period,
      },
      summary: {
        totalIncome: summary.income.totalIncome,
        totalExpenses: summary.expenses.totalExpenses,
        netAmount: summary.result.netAmount,
        resultType: summary.result.resultType,
        accountingView: summary.period.accountingView,
      },
      columns: [
        { key: 'section', header: 'Section' },
        { key: 'label', header: 'Label' },
        { key: 'amount', header: 'Amount' },
        { key: 'income', header: 'Income' },
        { key: 'expenses', header: 'Expenses' },
        { key: 'resultType', header: 'Result' },
      ],
      rows,
      totals: {
        netAmount: summary.result.netAmount,
      },
      page: query.page,
      limit: query.limit,
      allRows: options?.allRows,
      metadata: {
        confidential: true,
        notice: 'Generated from ProfitLossService — totals match P&L API.',
      },
    });
  }

  private async ownersDirectory(
    query: QueryReportDto,
    user: AuthUser,
    options?: { allRows?: boolean },
  ) {
    const assignments = await this.prisma.ownerUnitAssignment.findMany({
      where: {
        status: 'ACTIVE',
        ...(query.propertyId ? { propertyId: query.propertyId } : {}),
        ...(query.unitId ? { unitId: query.unitId } : {}),
      },
      include: {
        owner: true,
        property: { select: { name: true } },
        unit: { select: { unitNumber: true, floor: true } },
      },
      orderBy: [
        { property: { name: 'asc' } },
        { unit: { unitNumber: 'asc' } },
        { owner: { fullName: 'asc' } },
      ],
    });

    const rows = assignments
      .filter((a) => {
        if (!query.search?.trim()) return true;
        const term = query.search.trim().toLowerCase();
        return `${a.owner.fullName} ${a.property.name} ${a.unit.unitNumber}`
          .toLowerCase()
          .includes(term);
      })
      .map((a) => ({
        owner: a.owner.fullName,
        phone: a.owner.phone,
        property: a.property.name,
        unit: a.unit.unitNumber,
        floor: a.unit.floor,
        ownershipPercentage: money(a.ownershipPercentage.toString()),
        fixedMonthlyAmount: money(a.fixedMonthlyAmount.toString()),
        accountDirection: a.accountDirection,
        status: a.status,
      }));

    return buildReport({
      reportType: 'owners',
      user,
      filters: this.filterSnapshot(query),
      summary: { totalAssignments: rows.length },
      columns: [
        { key: 'owner', header: 'Owner' },
        { key: 'phone', header: 'Phone' },
        { key: 'property', header: 'Property' },
        { key: 'unit', header: 'Apartment/Room' },
        { key: 'floor', header: 'Floor' },
        { key: 'ownershipPercentage', header: 'Share %' },
        { key: 'fixedMonthlyAmount', header: 'Monthly Expected' },
        { key: 'accountDirection', header: 'Direction' },
        { key: 'status', header: 'Status' },
      ],
      rows,
      page: query.page,
      limit: query.limit,
      allRows: options?.allRows,
      metadata: { availability: 'READY', confidential: true },
    });
  }

  private async ownerPayments(
    query: QueryReportDto,
    user: AuthUser,
    options?: { allRows?: boolean },
  ) {
    const month = query.month ?? new Date().getUTCMonth() + 1;
    const year = query.year ?? new Date().getUTCFullYear();

    const statements = await this.prisma.ownerMonthlyStatement.findMany({
      where: {
        statementMonth: month,
        statementYear: year,
        ...(query.propertyId ? { propertyId: query.propertyId } : {}),
        ...(query.unitId ? { unitId: query.unitId } : {}),
        ...(query.paymentStatus
          ? {
              paymentStatus: query.paymentStatus as
                | 'UNPAID'
                | 'PARTIAL'
                | 'PAID'
                | 'OVERDUE'
                | 'OVERPAID',
            }
          : {}),
      },
      include: {
        owner: { select: { fullName: true } },
        property: { select: { name: true } },
        unit: { select: { unitNumber: true } },
        payments: {
          where: { status: 'COMPLETED', transactionType: 'PAYMENT' },
          orderBy: { paymentDate: 'desc' },
          take: 1,
        },
      },
      orderBy: [
        { property: { name: 'asc' } },
        { unit: { unitNumber: 'asc' } },
        { owner: { fullName: 'asc' } },
      ],
    });

    const rows = statements.map((s) => {
      const latest = s.payments[0];
      return {
        apartment: `${s.property.name} — ${s.unit.unitNumber}`,
        owner: s.owner.fullName,
        expected: money(s.totalPayableOrReceivable.toString()),
        dueDate: s.dueDate.toISOString().slice(0, 10),
        paid: money(s.totalPaid.toString()),
        remaining: money(s.remainingAmount.toString()),
        status: s.paymentStatus,
        method: latest?.paymentMethod ?? null,
        bank: latest?.bankName ?? null,
        paymentDate: latest?.paymentDate.toISOString().slice(0, 10) ?? null,
        accountDirection: s.accountDirection,
      };
    });

    const totalExpected = statements.reduce(
      (sum, s) => sum + Number(s.totalPayableOrReceivable.toString()),
      0,
    );
    const totalPaid = statements.reduce(
      (sum, s) => sum + Number(s.totalPaid.toString()),
      0,
    );
    const totalRemaining = statements.reduce(
      (sum, s) => sum + Number(s.remainingAmount.toString()),
      0,
    );

    return buildReport({
      reportType: 'owner-payments',
      user,
      filters: this.filterSnapshot(query),
      summary: {
        month,
        year,
        totalExpected: money(String(totalExpected)),
        totalPaid: money(String(totalPaid)),
        totalRemaining: money(String(totalRemaining)),
        count: rows.length,
      },
      columns: [
        { key: 'apartment', header: 'Apartment' },
        { key: 'owner', header: 'Owner' },
        { key: 'expected', header: 'Expected' },
        { key: 'dueDate', header: 'Due Date' },
        { key: 'paid', header: 'Paid' },
        { key: 'remaining', header: 'Remaining' },
        { key: 'status', header: 'Status' },
        { key: 'method', header: 'Method' },
        { key: 'bank', header: 'Bank' },
        { key: 'paymentDate', header: 'Payment Date' },
        { key: 'accountDirection', header: 'Direction' },
      ],
      rows,
      totals: {
        expected: money(String(totalExpected)),
        paid: money(String(totalPaid)),
        remaining: money(String(totalRemaining)),
      },
      page: query.page,
      limit: query.limit,
      allRows: options?.allRows,
      metadata: { availability: 'READY', confidential: true },
    });
  }

  private async employees(
    query: QueryReportDto,
    user: AuthUser,
    options?: { allRows?: boolean },
  ) {
    const employees = await this.employeesService.findAll(
      {
        search: query.search,
        isActive: true,
      },
      user.role,
    );

    const rows = employees.map((e) => ({
      employeeCode: e.employeeCode,
      fullName: e.fullName,
      position: e.position,
      department: e.department ?? null,
      joiningDate: e.joiningDate,
      status: e.status,
      phone: e.phone,
    }));

    return buildReport({
      reportType: 'employees',
      user,
      filters: this.filterSnapshot(query),
      summary: { totalEmployees: rows.length },
      columns: [
        { key: 'employeeCode', header: 'Code' },
        { key: 'fullName', header: 'Name' },
        { key: 'position', header: 'Position' },
        { key: 'department', header: 'Department' },
        { key: 'joiningDate', header: 'Joining Date' },
        { key: 'status', header: 'Status' },
        { key: 'phone', header: 'Phone' },
      ],
      rows,
      page: query.page,
      limit: query.limit,
      allRows: options?.allRows,
    });
  }

  private async salaries(
    query: QueryReportDto,
    user: AuthUser,
    options?: { allRows?: boolean },
  ) {
    const records = await this.salaryRecordsService.findAll(
      {
        employeeId: query.employeeId,
        salaryMonth: query.month,
        salaryYear: query.year,
      },
      user.role,
    );

    const rows = records.map((r) => ({
      employee: r.employee?.fullName ?? null,
      employeeCode: r.employee?.employeeCode ?? null,
      salaryMonth: r.salaryMonth,
      salaryYear: r.salaryYear,
      baseSalary: money(r.baseSalary),
      advance: money(r.totalAdvance),
      bonus: money(r.totalBonus),
      deduction: money(r.totalDeductions),
      netPayable: money(r.netPayable),
      paid: money(r.totalPaid),
      remaining: money(r.remainingBalance),
      paymentStatus: r.paymentStatus,
      finalized: r.finalized,
    }));

    return buildReport({
      reportType: 'salaries',
      user,
      filters: this.filterSnapshot(query),
      summary: { totalRecords: rows.length },
      columns: [
        { key: 'employeeCode', header: 'Code' },
        { key: 'employee', header: 'Employee' },
        { key: 'salaryMonth', header: 'Month' },
        { key: 'salaryYear', header: 'Year' },
        { key: 'baseSalary', header: 'Base' },
        { key: 'advance', header: 'Advance' },
        { key: 'bonus', header: 'Bonus' },
        { key: 'deduction', header: 'Deduction' },
        { key: 'netPayable', header: 'Net Payable' },
        { key: 'paid', header: 'Paid' },
        { key: 'remaining', header: 'Remaining' },
        { key: 'paymentStatus', header: 'Status' },
        { key: 'finalized', header: 'Finalized' },
      ],
      rows,
      page: query.page,
      limit: query.limit,
      allRows: options?.allRows,
      metadata: { confidential: true },
    });
  }

  private async inventoryStock(
    query: QueryReportDto,
    user: AuthUser,
    options?: { allRows?: boolean },
  ) {
    const items = await this.inventoryItemsService.findAll(
      {
        categoryId: query.categoryId,
        search: query.search,
        isActive: true,
      },
      user.role,
    );
    const hideCost = user.role === Role.RECEPTIONIST;
    const rows = items.map((item) => {
      const qty = Number(item.currentQuantity ?? 0);
      const cost = Number(item.averageUnitCost ?? 0);
      return {
        itemCode: item.itemCode,
        itemName: item.name,
        category: item.category?.name ?? null,
        currentQuantity: money(item.currentQuantity),
        reorderLevel: money(item.reorderLevel),
        unitCost: hideCost ? null : money(item.averageUnitCost),
        totalValuation: hideCost ? null : money(qty * cost),
        lowStock: item.isLowStock ?? qty <= Number(item.reorderLevel ?? 0),
      };
    });

    return buildReport({
      reportType: 'inventory-stock',
      user,
      filters: this.filterSnapshot(query),
      summary: {
        totalItems: rows.length,
        lowStockItems: rows.filter((r) => r.lowStock).length,
      },
      columns: [
        { key: 'itemCode', header: 'Item Code' },
        { key: 'itemName', header: 'Item' },
        { key: 'category', header: 'Category' },
        { key: 'currentQuantity', header: 'Qty' },
        { key: 'reorderLevel', header: 'Reorder' },
        { key: 'unitCost', header: 'Unit Cost', sensitive: true },
        { key: 'totalValuation', header: 'Valuation', sensitive: true },
        { key: 'lowStock', header: 'Low Stock' },
      ].filter((c) => !(hideCost && c.sensitive)),
      rows: hideCost
        ? rows.map(({ unitCost: _u, totalValuation: _t, ...rest }) => rest)
        : rows,
      page: query.page,
      limit: query.limit,
      allRows: options?.allRows,
    });
  }

  private async inventoryMovements(
    query: QueryReportDto,
    user: AuthUser,
    options?: { allRows?: boolean },
  ) {
    const movements = await this.inventoryMovementsService.findAll(
      {
        movementType: query.movementType,
        propertyId: query.propertyId,
        unitId: query.unitId,
        date: query.date,
        month: query.month,
        year: query.year,
        startDate: query.startDate,
        endDate: query.endDate,
        search: query.search,
      },
      user.role,
    );
    const hideCost = user.role === Role.RECEPTIONIST;
    const rows = movements.map((m) => ({
      movementNumber: m.movementNumber,
      movementDate: m.movementDate,
      item: m.item ? `${m.item.itemCode} — ${m.item.name}` : null,
      movementType: m.movementType,
      quantity: money(m.quantity),
      unitCost: hideCost ? null : money(m.unitCost),
      totalCost: hideCost ? null : money(m.totalCost),
      property:
        m.destinationProperty?.name ?? m.sourceProperty?.name ?? null,
      unit: m.destinationUnit?.unitNumber ?? m.sourceUnit?.unitNumber ?? null,
      reference: m.referenceNumber ?? null,
      createdBy: m.createdBy?.fullName ?? null,
    }));

    return buildReport({
      reportType: 'inventory-movements',
      user,
      filters: this.filterSnapshot(query),
      summary: { totalMovements: rows.length },
      columns: [
        { key: 'movementNumber', header: 'Movement #' },
        { key: 'movementDate', header: 'Date' },
        { key: 'item', header: 'Item' },
        { key: 'movementType', header: 'Type' },
        { key: 'quantity', header: 'Qty' },
        { key: 'unitCost', header: 'Unit Cost', sensitive: true },
        { key: 'totalCost', header: 'Total Cost', sensitive: true },
        { key: 'property', header: 'Property' },
        { key: 'unit', header: 'Unit' },
        { key: 'reference', header: 'Reference' },
        { key: 'createdBy', header: 'Created By' },
      ].filter((c) => !(hideCost && c.sensitive)),
      rows: hideCost
        ? rows.map(({ unitCost: _u, totalCost: _t, ...rest }) => rest)
        : rows,
      page: query.page,
      limit: query.limit,
      allRows: options?.allRows,
    });
  }

  private async roomAssets(
    query: QueryReportDto,
    user: AuthUser,
    options?: { allRows?: boolean },
  ) {
    const assets = await this.roomAssetsService.findAll(
      {
        propertyId: query.propertyId,
        unitId: query.unitId,
        condition: query.condition as never,
        search: query.search,
        isActive: true,
      },
      user.role,
    );
    const hideCost = user.role === Role.RECEPTIONIST;
    const rows = assets.map((a) => ({
      assetCode: a.assetCode,
      property: a.property?.name ?? null,
      unit: a.unit?.unitNumber ?? null,
      itemName: a.itemName,
      quantity: money(a.quantity),
      purchaseCost: hideCost ? null : money(a.purchaseCost),
      condition: a.condition,
      serialNumber: a.serialNumber ?? null,
      assignedDate: a.assignedDate,
      status: a.isActive ? 'ACTIVE' : 'ARCHIVED',
    }));

    return buildReport({
      reportType: 'room-assets',
      user,
      filters: this.filterSnapshot(query),
      summary: { totalAssets: rows.length },
      columns: [
        { key: 'assetCode', header: 'Asset Code' },
        { key: 'property', header: 'Property' },
        { key: 'unit', header: 'Unit' },
        { key: 'itemName', header: 'Item' },
        { key: 'quantity', header: 'Qty' },
        { key: 'purchaseCost', header: 'Cost', sensitive: true },
        { key: 'condition', header: 'Condition' },
        { key: 'serialNumber', header: 'Serial' },
        { key: 'assignedDate', header: 'Assigned' },
        { key: 'status', header: 'Status' },
      ].filter((c) => !(hideCost && c.sensitive)),
      rows: hideCost
        ? rows.map(({ purchaseCost: _c, ...rest }) => rest)
        : rows,
      page: query.page,
      limit: query.limit,
      allRows: options?.allRows,
    });
  }

  private async auditLogs(
    query: QueryReportDto,
    user: AuthUser,
    options?: { allRows?: boolean },
  ) {
    const where: Prisma.AuditLogWhereInput = {};

    if (query.startDate || query.endDate || query.date) {
      where.createdAt = {};
      if (query.date) {
        const start = new Date(query.date);
        start.setHours(0, 0, 0, 0);
        const end = new Date(query.date);
        end.setHours(23, 59, 59, 999);
        where.createdAt.gte = start;
        where.createdAt.lte = end;
      } else {
        if (query.startDate) {
          where.createdAt.gte = new Date(query.startDate);
        }
        if (query.endDate) {
          const end = new Date(query.endDate);
          end.setHours(23, 59, 59, 999);
          where.createdAt.lte = end;
        }
      }
    }

    if (query.search?.trim()) {
      const term = query.search.trim();
      where.OR = [
        { module: { contains: term, mode: 'insensitive' } },
        { action: { contains: term, mode: 'insensitive' } },
        { recordId: { contains: term, mode: 'insensitive' } },
        { user: { fullName: { contains: term, mode: 'insensitive' } } },
      ];
    }

    const logs = await this.prisma.auditLog.findMany({
      where,
      include: {
        user: { select: { fullName: true, email: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: options?.allRows ? 5000 : 500,
    });

    const rows = logs.map((row) => ({
      createdAt: row.createdAt.toISOString(),
      user: row.user?.fullName ?? null,
      role: row.role ?? row.user?.role ?? null,
      module: row.module,
      action: row.action,
      recordId: row.recordId,
      ipAddress: row.ipAddress,
      device: row.device,
      browser: row.browser,
      os: row.os,
    }));

    return buildReport({
      reportType: 'audit-logs',
      user,
      filters: this.filterSnapshot(query),
      summary: { totalEntries: rows.length },
      columns: [
        { key: 'createdAt', header: 'Date' },
        { key: 'user', header: 'User' },
        { key: 'role', header: 'Role' },
        { key: 'module', header: 'Module' },
        { key: 'action', header: 'Action' },
        { key: 'recordId', header: 'Record' },
        { key: 'ipAddress', header: 'IP' },
        { key: 'device', header: 'Device' },
        { key: 'browser', header: 'Browser' },
        { key: 'os', header: 'OS' },
      ],
      rows,
      page: query.page,
      limit: query.limit,
      allRows: options?.allRows,
      metadata: {
        availability: 'READY',
        confidential: true,
      },
    });
  }
}
