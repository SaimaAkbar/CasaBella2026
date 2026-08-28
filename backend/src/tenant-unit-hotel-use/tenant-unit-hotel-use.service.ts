import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BookingStatus,
  BookingType,
  NotificationPriority,
  NotificationType,
  OccupancySource,
  PaymentForType,
  PaymentMethod,
  PaymentStatus,
  PaymentTransactionType,
  Prisma,
  Role,
  SettlementStatus,
  SettlementType,
} from '../../generated/prisma/client';
import { UnitAvailabilityService } from '../availability/unit-availability.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import type { AuditContext } from '../common/types/audit-context.type';
import type { AuthUser } from '../common/types/auth-user.type';
import { GuestsService } from '../guests/guests.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  buildAdjustmentNotes,
} from '../payments/payment-balance';
import { PaymentsService } from '../payments/payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import {
  assertDiscountAllowed,
  calculateBookingTotals,
} from '../bookings/booking.finance';
import { mapBookingForRole } from '../bookings/bookings.mapper';
import { CreateTenantUnitHotelUseDto } from './dto/create-tenant-unit-hotel-use.dto';
import { LinkHotelUseBookingDto } from './dto/link-hotel-use-booking.dto';
import { QueryTenantUnitHotelUseDto } from './dto/query-tenant-unit-hotel-use.dto';
import { SettleHotelUseDto } from './dto/settle-hotel-use.dto';
import { calculateSettlementShares } from './settlement-calculation';
import { mapHotelUseForRole } from './tenant-unit-hotel-use.mapper';

const MODULE = 'TENANT_UNIT_HOTEL_USE';

const hotelUseInclude = {
  createdBy: { select: { id: true, fullName: true, role: true } },
  approvedBy: { select: { id: true, fullName: true, role: true } },
  monthlyTenancy: {
    include: {
      tenant: { select: { id: true, fullName: true, phone: true } },
      unit: {
        include: {
          property: { select: { id: true, name: true } },
        },
      },
    },
  },
  booking: {
    include: {
      guest: { select: { id: true, fullName: true, phone: true } },
    },
  },
  rentCredits: true,
} satisfies Prisma.TenantUnitHotelUseInclude;

const bookingInclude = {
  guest: true,
  unit: { include: { property: { select: { id: true, name: true } } } },
  createdBy: { select: { id: true, fullName: true } },
  checkedOutBy: { select: { id: true, fullName: true } },
} satisfies Prisma.BookingInclude;

@Injectable()
export class TenantUnitHotelUseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly availability: UnitAvailabilityService,
    private readonly auditLogs: AuditLogsService,
    private readonly notifications: NotificationsService,
    private readonly guestsService: GuestsService,
    private readonly paymentsService: PaymentsService,
    private readonly settingsService: SettingsService,
  ) {}

  async listEligibleAssignments(
    query: { tenantId?: string; propertyId?: string; unitId?: string },
    role: Role,
  ) {
    const rows = await this.availability.listEligibleAssignments(query);
    return rows.map((row) => ({
      id: row.id,
      tenantUnitAssignmentId: row.id,
      tenantId: row.tenantId,
      unitId: row.unitId,
      hotelUseAllowed: row.hotelUseAllowed,
      occupancyState: row.occupancyState,
      tenancyStatus: row.tenancyStatus,
      agreementStart: row.agreementStart,
      agreementEnd: row.agreementEnd,
      monthlyRent:
        role === Role.RECEPTIONIST
          ? undefined
          : row.monthlyRent.toFixed(2),
      tenant: row.tenant,
      unit: {
        id: row.unit.id,
        unitNumber: row.unit.unitNumber,
        unitType: row.unit.unitType,
        floor: row.unit.floor,
        status: row.unit.status,
        property: row.unit.property,
      },
    }));
  }

  async create(
    dto: CreateTenantUnitHotelUseDto,
    user: AuthUser,
    auditContext?: AuditContext,
  ) {
    this.assertCanCreateSettlement(user.role);

    if (dto.plannedCheckInDateTime && dto.plannedCheckOutDateTime) {
      await this.availability.assertHotelUseEligible({
        monthlyTenancyId: dto.monthlyTenancyId,
        checkInDateTime: new Date(dto.plannedCheckInDateTime),
        checkOutDateTime: new Date(dto.plannedCheckOutDateTime),
      });
    } else {
      await this.availability.assertHotelUseEligible({
        monthlyTenancyId: dto.monthlyTenancyId,
      });
    }

    const shares = calculateSettlementShares({
      settlementType: dto.settlementType,
      totalGuestCharge: dto.totalGuestCharge,
      tenantShare: dto.tenantShare,
      organizationShare: dto.organizationShare,
      tenantSharePercentage: dto.tenantSharePercentage,
      organizationSharePercentage: dto.organizationSharePercentage,
      reason: dto.reason,
      role: user.role,
    });

    if (dto.settlementType === SettlementType.RENT_CREDIT) {
      if (!dto.billingMonth || !dto.billingYear) {
        throw new BadRequestException(
          'billingMonth and billingYear are required for RENT_CREDIT',
        );
      }
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const row = await tx.tenantUnitHotelUse.create({
        data: {
          monthlyTenancyId: dto.monthlyTenancyId,
          settlementType: dto.settlementType,
          totalGuestCharge: shares.totalGuestCharge,
          tenantShare: shares.tenantShare,
          organizationShare: shares.organizationShare,
          tenantSharePercentage: shares.tenantSharePercentage ?? undefined,
          organizationSharePercentage:
            shares.organizationSharePercentage ?? undefined,
          rentCreditAmount: shares.rentCreditAmount,
          status: SettlementStatus.DRAFT,
          reason: shares.reason,
          billingMonth: dto.billingMonth,
          billingYear: dto.billingYear,
          createdByUserId: user.id,
        },
        include: hotelUseInclude,
      });

      await this.auditLogs.writeInTransaction(tx, {
        module: MODULE,
        action: 'HOTEL_USE_REQUEST_CREATED',
        recordId: row.id,
        userId: user.id,
        role: user.role,
        newData: this.toAuditSnapshot(row),
        context: auditContext,
      });

      return row;
    });

    await this.notifications.notifySuperAdmins({
      type: NotificationType.INFO,
      title: 'Hotel-use settlement draft',
      message: `Draft hotel-use settlement created for tenancy ${dto.monthlyTenancyId}`,
      relatedModule: MODULE,
      relatedId: created.id,
      priority: NotificationPriority.NORMAL,
      actionUrl: `/monthly-tenants?hotelUseId=${created.id}`,
    });

    return mapHotelUseForRole(created, user.role);
  }

  async findAll(query: QueryTenantUnitHotelUseDto, role: Role) {
    const rows = await this.prisma.tenantUnitHotelUse.findMany({
      where: this.buildWhere(query),
      include: hotelUseInclude,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => mapHotelUseForRole(row, role));
  }

  async findOne(id: string, role: Role) {
    const row = await this.getOrThrow(id);
    return mapHotelUseForRole(row, role);
  }

  async getSettlementDetail(id: string, role: Role) {
    if (role === Role.RECEPTIONIST) {
      throw new ForbiddenException(
        'Receptionists cannot view settlement finance detail',
      );
    }
    const row = await this.getOrThrow(id);
    const mapped = mapHotelUseForRole(row, role);
    return {
      ...mapped,
      calculation: {
        settlementType: row.settlementType,
        totalGuestCharge: row.totalGuestCharge.toFixed(2),
        tenantShare: row.tenantShare.toFixed(2),
        organizationShare: row.organizationShare.toFixed(2),
        rentCreditAmount: row.rentCreditAmount.toFixed(2),
        tenantSharePercentage: row.tenantSharePercentage?.toFixed(2) ?? null,
        organizationSharePercentage:
          row.organizationSharePercentage?.toFixed(2) ?? null,
      },
      rentCredits: row.rentCredits.map((credit) => ({
        id: credit.id,
        amount: credit.amount.toFixed(2),
        billingMonth: credit.billingMonth,
        billingYear: credit.billingYear,
        reason: credit.reason,
        creditDate: credit.creditDate,
        paymentId: credit.paymentId,
        approvedByUserId: credit.approvedByUserId,
      })),
    };
  }

  async approve(id: string, user: AuthUser, auditContext?: AuditContext) {
    this.assertCanApproveSettlement(user.role);
    const existing = await this.getOrThrow(id);

    if (existing.status !== SettlementStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT settlements can be approved');
    }

    if (existing.createdByUserId === user.id && user.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException(
        'Admin cannot approve their own hotel-use settlement',
      );
    }

    await this.availability.assertHotelUseEligible({
      monthlyTenancyId: existing.monthlyTenancyId,
    });

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.tenantUnitHotelUse.update({
        where: { id },
        data: {
          status: SettlementStatus.APPROVED,
          approvedByUserId: user.id,
          approvedAt: new Date(),
        },
        include: hotelUseInclude,
      });

      await this.auditLogs.writeInTransaction(tx, {
        module: MODULE,
        action: 'SETTLEMENT_APPROVED',
        recordId: id,
        userId: user.id,
        role: user.role,
        oldData: this.toAuditSnapshot(existing),
        newData: this.toAuditSnapshot(row),
        context: auditContext,
      });

      return row;
    });

    await this.notifications.create({
      userId: existing.createdByUserId,
      type: NotificationType.SUCCESS,
      title: 'Hotel-use settlement approved',
      message: 'Approved hotel-use settlement is ready for booking.',
      relatedModule: MODULE,
      relatedId: id,
      priority: NotificationPriority.HIGH,
    });

    return mapHotelUseForRole(updated, user.role);
  }

  async cancel(id: string, user: AuthUser, auditContext?: AuditContext) {
    this.assertCanCreateSettlement(user.role);
    const existing = await this.getOrThrow(id);

    if (
      existing.status === SettlementStatus.SETTLED ||
      existing.status === SettlementStatus.CANCELLED
    ) {
      throw new BadRequestException(
        'Settled or already cancelled hotel-use cannot be cancelled',
      );
    }

    if (
      existing.booking &&
      (existing.booking.bookingStatus === BookingStatus.CHECKED_IN ||
        existing.booking.bookingStatus === BookingStatus.CHECKED_OUT)
    ) {
      throw new ConflictException(
        'Cannot cancel hotel-use after guest check-in or checkout',
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (
        existing.bookingId &&
        existing.booking &&
        (existing.booking.bookingStatus === BookingStatus.PENDING ||
          existing.booking.bookingStatus === BookingStatus.CONFIRMED)
      ) {
        await tx.booking.update({
          where: { id: existing.bookingId },
          data: {
            bookingStatus: BookingStatus.CANCELLED,
            cancelledAt: new Date(),
          },
        });
      }

      const row = await tx.tenantUnitHotelUse.update({
        where: { id },
        data: {
          status: SettlementStatus.CANCELLED,
          cancelledAt: new Date(),
        },
        include: hotelUseInclude,
      });

      await this.auditLogs.writeInTransaction(tx, {
        module: MODULE,
        action: 'HOTEL_USE_CANCELLED',
        recordId: id,
        userId: user.id,
        role: user.role,
        oldData: this.toAuditSnapshot(existing),
        newData: this.toAuditSnapshot(row),
        context: auditContext,
      });

      return row;
    });

    return mapHotelUseForRole(updated, user.role);
  }

  async settle(
    id: string,
    dto: SettleHotelUseDto,
    user: AuthUser,
    auditContext?: AuditContext,
  ) {
    if (user.role !== Role.SUPER_ADMIN && user.role !== Role.ADMIN) {
      throw new ForbiddenException('Insufficient permissions to settle');
    }

    const existing = await this.getOrThrow(id);

    if (existing.status !== SettlementStatus.APPROVED) {
      throw new BadRequestException('Only APPROVED settlements can be settled');
    }

    if (!existing.bookingId) {
      throw new BadRequestException(
        'Link and complete a hotel guest booking before settling',
      );
    }

    if (
      existing.booking?.bookingStatus !== BookingStatus.CHECKED_OUT &&
      existing.booking?.bookingStatus !== BookingStatus.CHECKED_IN
    ) {
      throw new BadRequestException(
        'Settlement requires an active or checked-out hotel guest booking',
      );
    }

    const billingMonth =
      dto.billingMonth ??
      existing.billingMonth ??
      new Date().getMonth() + 1;
    const billingYear =
      dto.billingYear ?? existing.billingYear ?? new Date().getFullYear();

    const updated = await this.prisma.$transaction(async (tx) => {
      let rentCreditPaymentId: string | null = null;

      if (
        existing.settlementType === SettlementType.RENT_CREDIT &&
        existing.rentCreditAmount.greaterThan(0)
      ) {
        const paymentNumber = await this.nextPaymentNumber(tx);
        const payment = await tx.payment.create({
          data: {
            paymentNumber,
            paymentForType: PaymentForType.MONTHLY_TENANCY,
            monthlyTenancyId: existing.monthlyTenancyId,
            transactionType: PaymentTransactionType.ADJUSTMENT,
            amount: existing.rentCreditAmount,
            paymentMethod: PaymentMethod.OTHER,
            paymentDate: new Date(),
            notes: buildAdjustmentNotes(
              'CREDIT',
              'HOTEL_USE_RENT_CREDIT',
              `hotelUseId=${existing.id}; ${dto.notes ?? existing.reason ?? ''}`.trim(),
            ),
            status: PaymentStatus.COMPLETED,
            createdByUserId: user.id,
            approvedByUserId: user.id,
            approvedAt: new Date(),
          },
        });
        rentCreditPaymentId = payment.id;

        await this.paymentsService.recalculateSource(
          tx,
          PaymentForType.MONTHLY_TENANCY,
          { monthlyTenancyId: existing.monthlyTenancyId },
        );

        await tx.rentCredit.create({
          data: {
            monthlyTenancyId: existing.monthlyTenancyId,
            hotelUseId: existing.id,
            amount: existing.rentCreditAmount,
            billingMonth,
            billingYear,
            reason:
              existing.reason?.trim() ||
              dto.notes?.trim() ||
              'Hotel-use rent credit',
            creditDate: new Date(),
            paymentId: payment.id,
            approvedByUserId: user.id,
          },
        });

        await this.auditLogs.writeInTransaction(tx, {
          module: MODULE,
          action: 'RENT_CREDIT_APPLIED',
          recordId: existing.id,
          userId: user.id,
          role: user.role,
          newData: {
            amount: existing.rentCreditAmount.toFixed(2),
            billingMonth,
            billingYear,
            paymentId: rentCreditPaymentId,
          },
          context: auditContext,
        });
      }

      const row = await tx.tenantUnitHotelUse.update({
        where: { id },
        data: {
          status: SettlementStatus.SETTLED,
          settledAt: new Date(),
          billingMonth,
          billingYear,
        },
        include: hotelUseInclude,
      });

      await this.auditLogs.writeInTransaction(tx, {
        module: MODULE,
        action: 'SETTLEMENT_COMPLETED',
        recordId: id,
        userId: user.id,
        role: user.role,
        oldData: this.toAuditSnapshot(existing),
        newData: this.toAuditSnapshot(row),
        context: auditContext,
      });

      return row;
    });

    return mapHotelUseForRole(updated, user.role);
  }

  /**
   * Create booking linked to an APPROVED hotel-use settlement.
   * Available to Super Admin, Admin, and Receptionist.
   */
  async createBooking(
    dto: LinkHotelUseBookingDto,
    user: AuthUser,
    auditContext?: AuditContext,
  ) {
    const hotelUse = await this.getOrThrow(dto.hotelUseId);

    if (hotelUse.status !== SettlementStatus.APPROVED) {
      throw new ConflictException(
        'Hotel guest booking requires an APPROVED hotel-use settlement',
      );
    }

    if (hotelUse.bookingId) {
      throw new ConflictException(
        'This hotel-use settlement already has a linked booking',
      );
    }

    const checkIn = new Date(dto.checkInDateTime);
    const checkOut = new Date(dto.checkOutDateTime);
    if (!(checkOut > checkIn)) {
      throw new BadRequestException(
        'checkOutDateTime must be later than checkInDateTime',
      );
    }

    const tenancy = await this.availability.assertHotelUseEligible({
      monthlyTenancyId: hotelUse.monthlyTenancyId,
      checkInDateTime: checkIn,
      checkOutDateTime: checkOut,
    });

    const guestId = await this.resolveGuestId(dto, user.role);
    await this.guestsService.ensureActive(guestId);

    const unit = tenancy.unit;
    const rates = {
      hourlyRate:
        dto.hourlyRate ??
        (unit.hourlyRate ? Number(unit.hourlyRate.toString()) : null),
      dailyRate:
        dto.dailyRate ??
        (unit.dailyRate ? Number(unit.dailyRate.toString()) : null),
    };

    const chargeInput = {
      bookingType: dto.bookingType,
      hourlyRate: rates.hourlyRate,
      dailyRate: rates.dailyRate,
      numberOfHours: dto.numberOfHours,
      numberOfDays: dto.numberOfDays,
      electricityCharges: dto.electricityCharges ?? 0,
      cleaningCharges: dto.cleaningCharges ?? 0,
      laundryCharges: dto.laundryCharges ?? 0,
      maintenanceCharges: dto.maintenanceCharges ?? 0,
      otherCharges: dto.otherCharges ?? 0,
      discountAmount: dto.discountAmount ?? 0,
      receivedAmount: 0,
      checkInDateTime: checkIn,
    };

    if (dto.discountAmount && dto.discountAmount > 0) {
      const base = new Prisma.Decimal(dto.electricityCharges ?? 0)
        .plus(dto.cleaningCharges ?? 0)
        .plus(dto.laundryCharges ?? 0)
        .plus(dto.maintenanceCharges ?? 0)
        .plus(dto.otherCharges ?? 0)
        .plus(
          dto.bookingType === BookingType.HOURLY
            ? (rates.hourlyRate ?? 0) * (dto.numberOfHours ?? 0)
            : (rates.dailyRate ?? 0) * (dto.numberOfDays ?? 0),
        );
      assertDiscountAllowed(user.role, dto.discountAmount, base);
    }

    const totals = calculateBookingTotals(chargeInput, { allowAdvance: true });
    const totalGuestCharge = new Prisma.Decimal(hotelUse.totalGuestCharge);
    if (!new Prisma.Decimal(totals.totalAmount).equals(totalGuestCharge)) {
      // Keep booking totals authoritative from rates, but warn via soft check:
      // allow mismatch only for Super Admin; otherwise require match.
      if (user.role !== Role.SUPER_ADMIN) {
        throw new BadRequestException(
          `Booking totalAmount (${totals.totalAmount}) must equal approved settlement totalGuestCharge (${totalGuestCharge.toFixed(2)})`,
        );
      }
    }

    const initialReceived = new Prisma.Decimal(dto.receivedAmount ?? 0);

    const result = await this.prisma.$transaction(async (tx) => {
      const bookingNumber = await this.nextBookingNumber(tx);
      const {
        paymentState: _ps,
        receivedAmount: _recv,
        remainingAmount: _rem,
        ...chargeTotals
      } = totals;

      const booking = await tx.booking.create({
        data: {
          bookingNumber,
          guestId,
          unitId: tenancy.unitId,
          bookingType: dto.bookingType,
          checkInDateTime: checkIn,
          checkOutDateTime: checkOut,
          ...chargeTotals,
          bookingStatus: BookingStatus.PENDING,
          occupancySource: OccupancySource.HOTEL_GUEST_ON_TENANT_UNIT,
          numberOfGuests: dto.numberOfGuests ?? 1,
          bookingSource: dto.bookingSource ?? 'HOTEL_USE_ON_TENANT_UNIT',
          notes: dto.notes,
          createdByUserId: user.id,
        },
        include: bookingInclude,
      });

      await tx.tenantUnitHotelUse.update({
        where: { id: hotelUse.id },
        data: { bookingId: booking.id },
      });

      if (initialReceived.greaterThan(0)) {
        await this.paymentsService.createInitialInstallment(tx, {
          paymentForType: PaymentForType.BOOKING,
          bookingId: booking.id,
          amount: initialReceived,
          userId: user.id,
        });
        await this.paymentsService.recalculateSource(tx, PaymentForType.BOOKING, {
          bookingId: booking.id,
        });
      }

      await this.auditLogs.writeInTransaction(tx, {
        module: MODULE,
        action: 'BOOKING_CREATED',
        recordId: hotelUse.id,
        userId: user.id,
        role: user.role,
        newData: {
          bookingId: booking.id,
          bookingNumber: booking.bookingNumber,
          occupancySource: OccupancySource.HOTEL_GUEST_ON_TENANT_UNIT,
        },
        context: auditContext,
      });

      return tx.booking.findUniqueOrThrow({
        where: { id: booking.id },
        include: bookingInclude,
      });
    });

    return mapBookingForRole(result, user.role);
  }

  private assertCanCreateSettlement(role: Role) {
    if (role !== Role.SUPER_ADMIN && role !== Role.ADMIN) {
      throw new ForbiddenException(
        'Only Super Admin and Admin may create hotel-use settlements',
      );
    }
  }

  private assertCanApproveSettlement(role: Role) {
    if (role !== Role.SUPER_ADMIN && role !== Role.ADMIN) {
      throw new ForbiddenException(
        'Only Super Admin and Admin may approve hotel-use settlements',
      );
    }
  }

  private async resolveGuestId(dto: LinkHotelUseBookingDto, role: Role) {
    if (dto.guestId) return dto.guestId;
    if (dto.guest) {
      const created = await this.guestsService.create(dto.guest, role);
      return created.id;
    }
    throw new BadRequestException('guestId or guest payload is required');
  }

  private async getOrThrow(id: string) {
    const row = await this.prisma.tenantUnitHotelUse.findUnique({
      where: { id },
      include: hotelUseInclude,
    });
    if (!row) {
      throw new NotFoundException(`Hotel-use settlement "${id}" not found`);
    }
    return row;
  }

  private buildWhere(
    query: QueryTenantUnitHotelUseDto,
  ): Prisma.TenantUnitHotelUseWhereInput {
    const where: Prisma.TenantUnitHotelUseWhereInput = {};

    if (query.status) where.status = query.status;
    if (query.monthlyTenancyId) where.monthlyTenancyId = query.monthlyTenancyId;

    const tenancyFilter: Prisma.MonthlyTenancyWhereInput = {};
    if (query.tenantId) tenancyFilter.tenantId = query.tenantId;
    if (query.unitId) tenancyFilter.unitId = query.unitId;
    if (query.propertyId) {
      tenancyFilter.unit = { propertyId: query.propertyId };
    }
    if (Object.keys(tenancyFilter).length > 0) {
      where.monthlyTenancy = tenancyFilter;
    }

    if (query.date) {
      const start = new Date(`${query.date}T00:00:00.000Z`);
      const end = new Date(`${query.date}T23:59:59.999Z`);
      where.createdAt = { gte: start, lte: end };
    } else if (query.month && query.year) {
      const start = new Date(Date.UTC(query.year, query.month - 1, 1));
      const end = new Date(Date.UTC(query.year, query.month, 0, 23, 59, 59, 999));
      where.createdAt = { gte: start, lte: end };
    } else if (query.year) {
      const start = new Date(Date.UTC(query.year, 0, 1));
      const end = new Date(Date.UTC(query.year, 11, 31, 23, 59, 59, 999));
      where.createdAt = { gte: start, lte: end };
    }

    if (query.search?.trim()) {
      const term = query.search.trim();
      where.OR = [
        {
          monthlyTenancy: {
            tenant: { fullName: { contains: term, mode: 'insensitive' } },
          },
        },
        {
          monthlyTenancy: {
            unit: { unitNumber: { contains: term, mode: 'insensitive' } },
          },
        },
        {
          booking: {
            bookingNumber: { contains: term, mode: 'insensitive' },
          },
        },
      ];
    }

    return where;
  }

  private toAuditSnapshot(row: {
    id: string;
    monthlyTenancyId: string;
    bookingId: string | null;
    settlementType: SettlementType;
    status: SettlementStatus;
    totalGuestCharge: Prisma.Decimal;
    tenantShare: Prisma.Decimal;
    organizationShare: Prisma.Decimal;
    rentCreditAmount: Prisma.Decimal;
    reason: string | null;
  }) {
    return {
      id: row.id,
      monthlyTenancyId: row.monthlyTenancyId,
      bookingId: row.bookingId,
      settlementType: row.settlementType,
      status: row.status,
      totalGuestCharge: row.totalGuestCharge.toFixed(2),
      tenantShare: row.tenantShare.toFixed(2),
      organizationShare: row.organizationShare.toFixed(2),
      rentCreditAmount: row.rentCreditAmount.toFixed(2),
      reason: row.reason,
    };
  }

  private async nextPaymentNumber(tx: Prisma.TransactionClient) {
    const now = new Date();
    const yyyy = now.getUTCFullYear();
    const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(now.getUTCDate()).padStart(2, '0');
    const dateKey = `${yyyy}${mm}${dd}`;
    const settingKey = `payment_seq_${dateKey}`;

    const numbering = await this.settingsService.getValue<{
      prefix?: string;
      separator?: string;
      sequenceLength?: number;
    }>('numbering.payment');
    const prefix = numbering?.prefix || 'PAY';
    const separator = numbering?.separator ?? '-';
    const seqLen = Number(numbering?.sequenceLength) || 4;

    const rows = await tx.$queryRaw<Array<{ value: string }>>`
      INSERT INTO "SystemSetting" (key, value, "createdAt", "updatedAt")
      VALUES (${settingKey}, '1', NOW(), NOW())
      ON CONFLICT (key)
      DO UPDATE SET
        value = (CAST("SystemSetting".value AS INTEGER) + 1)::text,
        "updatedAt" = NOW()
      RETURNING value
    `;

    const seq = String(rows[0]?.value ?? '1').padStart(seqLen, '0');
    return `${prefix}${separator}${dateKey}${separator}${seq}`;
  }

  private async nextBookingNumber(tx: Prisma.TransactionClient) {
    const now = new Date();
    const yyyy = now.getUTCFullYear();
    const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(now.getUTCDate()).padStart(2, '0');
    const dateKey = `${yyyy}${mm}${dd}`;
    const settingKey = `booking_seq_${dateKey}`;

    const numbering = await this.settingsService.getValue<{
      prefix?: string;
      separator?: string;
      sequenceLength?: number;
    }>('numbering.booking');
    const prefix = numbering?.prefix || 'BK';
    const separator = numbering?.separator ?? '-';
    const seqLen = Number(numbering?.sequenceLength) || 4;

    const rows = await tx.$queryRaw<Array<{ value: string }>>`
      INSERT INTO "SystemSetting" (key, value, "createdAt", "updatedAt")
      VALUES (${settingKey}, '1', NOW(), NOW())
      ON CONFLICT (key)
      DO UPDATE SET
        value = (CAST("SystemSetting".value AS INTEGER) + 1)::text,
        "updatedAt" = NOW()
      RETURNING value
    `;

    const seq = String(rows[0]?.value ?? '1').padStart(seqLen, '0');
    return `${prefix}${separator}${dateKey}${separator}${seq}`;
  }
}
