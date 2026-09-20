import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  BookingStatus,
  BookingType,
  MonthlyOccupancyState,
  MonthlyTenancyStatus,
  NotificationPriority,
  NotificationType,
  OnlinePaymentStatus,
  OnlinePaymentSelection,
  PaymentForType,
  PaymentMethod,
  PaymentState,
  Prisma,
  Role,
  Status,
  UnitStatus,
  UnitType,
} from '../../generated/prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { CHECKOUT_AFTER_CHECKIN_MESSAGE } from '../bookings/booking.duration';
import {
  calculateBookingTotals,
  serializeMoney,
} from '../bookings/booking.finance';
import { GuestsService } from '../guests/guests.service';
import {
  NotificationsService,
  ROLE_SETS,
} from '../notifications/notifications.service';
import { PaymentsService } from '../payments/payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { OnlineBookingCheckoutDto } from './dto/online-booking-checkout.dto';
import type { OnlinePaymentSelectionDto } from './dto/online-booking-checkout.dto';
import {
  RejectBankTransferDto,
  SubmitBankTransferDto,
  VerifyBankTransferDto,
} from './dto/bank-transfer.dto';
import { OnlineBookingQuoteDto } from './dto/online-booking-quote.dto';
import { PublicAvailabilityDto } from './dto/public-availability.dto';
import { QueryOnlineBookingsDto } from './dto/query-online-bookings.dto';
import { MailService } from './mail.service';
import { OnlinePaymentGatewayService } from './online-payment-gateway.service';
import { SafepayService } from './safepay.service';
import type { AuthUser } from '../common/types/auth-user.type';

const ONLINE_SOURCE = 'ONLINE';

const ACTIVE_BOOKING_STATUSES: BookingStatus[] = [
  BookingStatus.PENDING,
  BookingStatus.CONFIRMED,
  BookingStatus.CHECKED_IN,
];

const bookingInclude = {
  guest: true,
  unit: {
    include: {
      property: { select: { id: true, name: true } },
    },
  },
  onlinePayment: true,
} satisfies Prisma.BookingInclude;

@Injectable()
export class OnlineBookingsService {
  private readonly logger = new Logger(OnlineBookingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly guestsService: GuestsService,
    private readonly safepay: SafepayService,
    private readonly paymentGateway: OnlinePaymentGatewayService,
    private readonly mail: MailService,
    private readonly notifications: NotificationsService,
    private readonly payments: PaymentsService,
    private readonly auditLogs: AuditLogsService,
    private readonly settings: SettingsService,
  ) {}

  private holdMinutes(): number {
    const raw = Number(process.env.ONLINE_BOOKING_HOLD_MINUTES ?? 15);
    return Number.isFinite(raw) && raw > 0 ? raw : 15;
  }

  // ─── Public catalogue ───────────────────────────────────────────────────────

  /**
   * List rooms/apartments for the public website.
   * Listing = room existence (isActive only).
   * Booking availability is computed separately (does not hide the room).
   */
  async listPublicUnits(
    unitType?: UnitType,
    checkInDateTime?: string,
    checkOutDateTime?: string,
  ) {
    const units = await this.prisma.unit.findMany({
      where: {
        // Include every non-archived unit. Booking/occupancy must NOT hide listings.
        // isActive=false is the POS "archived" flag (same as admin Soft-delete/archive).
        isActive: true,
        ...(unitType ? { unitType } : {}),
      },
      include: {
        property: { select: { id: true, name: true, isActive: true } },
      },
      orderBy: [{ property: { name: 'asc' } }, { unitNumber: 'asc' }],
    });

    this.logger.log(
      `Public catalogue: ${units.length} unit(s) from database` +
        (unitType ? ` (type=${unitType})` : ''),
    );

    const range = this.resolveAvailabilityRange(
      checkInDateTime,
      checkOutDateTime,
    );

    const bookedUnitIds = await this.findBookedUnitIds(
      units.map((u) => u.id),
      range.checkIn,
      range.checkOut,
    );

    return units.map((unit) =>
      this.mapPublicUnit(unit, {
        booked: bookedUnitIds.has(unit.id),
      }),
    );
  }

  async getPublicUnit(
    id: string,
    checkInDateTime?: string,
    checkOutDateTime?: string,
  ) {
    const unit = await this.prisma.unit.findFirst({
      where: {
        id,
        isActive: true,
      },
      include: {
        property: { select: { id: true, name: true, isActive: true } },
      },
    });

    if (!unit) {
      throw new NotFoundException(`Unit with id "${id}" not found`);
    }

    const range = this.resolveAvailabilityRange(
      checkInDateTime,
      checkOutDateTime,
    );
    const bookedUnitIds = await this.findBookedUnitIds(
      [unit.id],
      range.checkIn,
      range.checkOut,
    );

    return this.mapPublicUnit(unit, { booked: bookedUnitIds.has(unit.id) });
  }

  private resolveAvailabilityRange(
    checkInDateTime?: string,
    checkOutDateTime?: string,
  ) {
    if (checkInDateTime && checkOutDateTime) {
      const checkIn = new Date(checkInDateTime);
      const checkOut = new Date(checkOutDateTime);
      if (!(checkIn < checkOut)) {
        throw new BadRequestException('Check-out must be after check-in');
      }
      return { checkIn, checkOut };
    }
    // No dates selected: use "now → +1 day" to reflect current occupancy only.
    const checkIn = new Date();
    const checkOut = new Date(checkIn.getTime() + 24 * 60 * 60 * 1000);
    return { checkIn, checkOut };
  }

  private async findBookedUnitIds(
    unitIds: string[],
    checkIn: Date,
    checkOut: Date,
  ) {
    if (unitIds.length === 0) return new Set<string>();

    const overlaps = await this.prisma.booking.findMany({
      where: {
        unitId: { in: unitIds },
        bookingStatus: {
          in: [
            BookingStatus.PENDING,
            BookingStatus.CONFIRMED,
            BookingStatus.CHECKED_IN,
          ],
        },
        checkInDateTime: { lt: checkOut },
        checkOutDateTime: { gt: checkIn },
      },
      select: { unitId: true },
    });

    return new Set(overlaps.map((row) => row.unitId));
  }

  async checkAvailability(dto: PublicAvailabilityDto) {
    this.assertDateRange(dto.checkInDateTime, dto.checkOutDateTime);
    const checkIn = new Date(dto.checkInDateTime);
    const checkOut = new Date(dto.checkOutDateTime);

    try {
      await this.getAssignableUnit(dto.unitId);
      await this.assertNoOverlap(dto.unitId, checkIn, checkOut);
      await this.assertMonthlyTenancyAllowsHotelUse(dto.unitId);
      return { available: true as const };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unit is not available';
      return { available: false as const, message };
    }
  }

  /**
   * Calendar helper: nights already held by PENDING/CONFIRMED/CHECKED_IN bookings.
   * A night date D is booked when checkIn <= D < checkOut (checkout day is free).
   */
  async getPublicOccupiedDates(unitId: string, from?: string, to?: string) {
    await this.getAssignableUnit(unitId);

    const start = from
      ? new Date(`${from.slice(0, 10)}T00:00:00.000Z`)
      : new Date();
    start.setUTCHours(0, 0, 0, 0);
    if (Number.isNaN(start.getTime())) {
      throw new BadRequestException('Invalid from date');
    }

    const end = to
      ? new Date(`${to.slice(0, 10)}T00:00:00.000Z`)
      : new Date(start);
    if (!to) {
      end.setUTCMonth(end.getUTCMonth() + 6);
    }
    end.setUTCHours(23, 59, 59, 999);
    if (Number.isNaN(end.getTime()) || end <= start) {
      throw new BadRequestException('Invalid to date');
    }

    const bookings = await this.prisma.booking.findMany({
      where: {
        unitId,
        bookingStatus: { in: ACTIVE_BOOKING_STATUSES },
        checkInDateTime: { lt: end },
        checkOutDateTime: { gt: start },
      },
      select: {
        checkInDateTime: true,
        checkOutDateTime: true,
        bookingStatus: true,
      },
      orderBy: { checkInDateTime: 'asc' },
    });

    const bookedSet = new Set<string>();
    const ranges: Array<{
      checkIn: string;
      checkOut: string;
      status: BookingStatus;
    }> = [];

    for (const booking of bookings) {
      const rangeStart = this.toUtcDateOnly(booking.checkInDateTime);
      const rangeEndExclusive = this.toUtcDateOnly(booking.checkOutDateTime);
      ranges.push({
        checkIn: this.formatDateOnly(rangeStart),
        checkOut: this.formatDateOnly(rangeEndExclusive),
        status: booking.bookingStatus,
      });

      for (
        let cursor = new Date(rangeStart);
        cursor < rangeEndExclusive;
        cursor.setUTCDate(cursor.getUTCDate() + 1)
      ) {
        if (cursor < start || cursor > end) continue;
        bookedSet.add(this.formatDateOnly(cursor));
      }
    }

    return {
      unitId,
      from: this.formatDateOnly(start),
      to: this.formatDateOnly(end),
      bookedDates: [...bookedSet].sort(),
      ranges,
    };
  }

  private toUtcDateOnly(value: Date): Date {
    return new Date(
      Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
    );
  }

  private formatDateOnly(value: Date): string {
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, '0');
    const d = String(value.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  async getPaymentConfig() {
    const bank = await this.getBankTransferDetails();
    return {
      provider: this.paymentGateway.providerName,
      mode: this.paymentGateway.isBankTransfer
        ? 'bank_transfer'
        : this.safepay.environment,
      acceptsRealCards: false,
      canStartCheckout: true,
      paymentMethod: this.paymentGateway.isBankTransfer
        ? 'BANK_TRANSFER'
        : 'SAFEPAY',
      bank,
      message: this.paymentGateway.isBankTransfer
        ? 'Transfer to the Casa Bella bank account, then submit your transaction details for staff verification. Booking is confirmed only after verification.'
        : this.safepay.getPublicConfig().message,
    };
  }

  async getBankTransferDetails() {
    const [accountName, iban, branch, instructions] = await Promise.all([
      this.settings.getValue<string>('payment.bankAccountName'),
      this.settings.getValue<string>('payment.bankIban'),
      this.settings.getValue<string>('payment.bankBranch'),
      this.settings.getValue<string>('payment.bankInstructions'),
    ]);
    return {
      accountName: accountName || 'CASA BELLA',
      iban: iban || 'PK60FAYS3203301000003409',
      branch: branch || 'IBB E-11, ISLAMABAD',
      instructions:
        instructions ||
        'Please transfer the selected amount to the Casa Bella bank account. After completing the transfer, submit your transaction details for verification.',
    };
  }

  async quote(dto: OnlineBookingQuoteDto) {
    this.assertDateRange(dto.checkInDateTime, dto.checkOutDateTime);
    const unit = await this.getAssignableUnit(dto.unitId);
    if (unit.dailyRate == null) {
      throw new BadRequestException('Unit does not have a daily rate configured');
    }

    const totals = calculateBookingTotals({
      bookingType: BookingType.DAILY,
      dailyRate: Number(unit.dailyRate),
      checkInDateTime: dto.checkInDateTime,
      checkOutDateTime: dto.checkOutDateTime,
    });

    const taxes = new Prisma.Decimal(0);
    const total = totals.totalAmount.plus(taxes);

    return {
      unitId: unit.id,
      nights: totals.numberOfDays,
      dailyRate: serializeMoney(totals.dailyRate),
      roomCharges: serializeMoney(totals.roomCharges),
      taxes: serializeMoney(taxes),
      total: serializeMoney(total),
      currency: 'PKR',
      adults: dto.adults ?? null,
      children: dto.children ?? null,
    };
  }

  async checkout(dto: OnlineBookingCheckoutDto) {
    this.assertDateRange(dto.checkInDateTime, dto.checkOutDateTime);

    if (dto.idempotencyKey?.trim()) {
      const existing = await this.prisma.onlinePayment.findUnique({
        where: { idempotencyKey: dto.idempotencyKey.trim() },
        include: {
          booking: { include: bookingInclude },
        },
      });
      if (existing) {
        return this.buildCheckoutResponse(existing.booking, existing);
      }
    }

    const guest = await this.guestsService.findOrCreateForOnline(dto.guest);
    const unit = await this.getAssignableUnit(dto.unitId);
    if (dto.propertyId && unit.propertyId !== dto.propertyId) {
      throw new BadRequestException(
        'Selected unit does not belong to the selected property',
      );
    }
    if (unit.dailyRate == null) {
      throw new BadRequestException('Unit does not have a daily rate configured');
    }

    const checkIn = new Date(dto.checkInDateTime);
    const checkOut = new Date(dto.checkOutDateTime);
    await this.assertNoOverlap(dto.unitId, checkIn, checkOut);
    await this.assertMonthlyTenancyAllowsHotelUse(dto.unitId);

    const totals = calculateBookingTotals({
      bookingType: BookingType.DAILY,
      dailyRate: Number(unit.dailyRate),
      checkInDateTime: dto.checkInDateTime,
      checkOutDateTime: dto.checkOutDateTime,
    });

    const taxes = new Prisma.Decimal(0);
    const totalAmount = totals.totalAmount.plus(taxes);
    const paymentSelection = this.toPaymentSelection(dto.paymentSelection);
    const chargeAmount = this.resolveChargeAmount(totalAmount, paymentSelection);
    const holdMs = this.holdMinutes() * 60_000;
    const expiresAt = new Date(Date.now() + holdMs);
    const idempotencyKey = dto.idempotencyKey?.trim() || randomUUID();

    const created = await this.prisma.$transaction(async (tx) => {
      const bookingNumber = await this.nextBookingNumber(tx);
      const booking = await tx.booking.create({
        data: {
          bookingNumber,
          guestId: guest.id,
          unitId: dto.unitId,
          bookingType: BookingType.DAILY,
          checkInDateTime: checkIn,
          checkOutDateTime: checkOut,
          dailyRate: totals.dailyRate,
          numberOfDays: totals.numberOfDays,
          roomCharges: totals.roomCharges,
          electricityCharges: 0,
          cleaningCharges: 0,
          laundryCharges: 0,
          maintenanceCharges: 0,
          otherCharges: 0,
          discountAmount: 0,
          totalAmount,
          receivedAmount: 0,
          remainingAmount: totalAmount,
          paymentState: PaymentState.UNPAID,
          bookingStatus: BookingStatus.PENDING,
          numberOfGuests: dto.numberOfGuests,
          adults: dto.adults,
          children: dto.children,
          bookingSource: ONLINE_SOURCE,
          notes: dto.notes?.trim() || null,
          paymentHoldExpiresAt: expiresAt,
        },
      });

      const onlinePayment = await tx.onlinePayment.create({
        data: {
          bookingId: booking.id,
          guestId: guest.id,
          gateway: this.paymentGateway.providerName.toUpperCase(),
          amount: chargeAmount,
          bookingTotalAmount: totalAmount,
          paymentSelection,
          currency: 'PKR',
          status: OnlinePaymentStatus.PENDING,
          idempotencyKey,
          expiresAt,
        },
      });

      return { booking, onlinePayment };
    });

    let checkout: Awaited<
      ReturnType<OnlinePaymentGatewayService['createCheckout']>
    >;
    try {
      checkout = await this.paymentGateway.createCheckout({
        amountPkr: chargeAmount.toString(),
        bookingNumber: created.booking.bookingNumber,
        bookingId: created.booking.id,
        customerEmail: guest.email,
        customerPhone: guest.phone,
      });
    } catch (error) {
      await this.prisma.$transaction(async (tx) => {
        await tx.onlinePayment.update({
          where: { id: created.onlinePayment.id },
          data: { status: OnlinePaymentStatus.FAILED },
        });
        await tx.booking.update({
          where: { id: created.booking.id },
          data: {
            bookingStatus: BookingStatus.CANCELLED,
            cancelledAt: new Date(),
            paymentHoldExpiresAt: null,
          },
        });
      });
      throw error;
    }

    const onlinePayment = await this.prisma.onlinePayment.update({
      where: { id: created.onlinePayment.id },
      data: {
        gateway: checkout.provider.toUpperCase(),
        tracker: checkout.tracker,
        checkoutUrl: checkout.checkoutUrl,
        gatewayReference: checkout.tracker,
        paymentResponse: checkout.raw
          ? (checkout.raw as Prisma.InputJsonValue)
          : Prisma.DbNull,
      },
      include: {
        booking: { include: bookingInclude },
      },
    });

    return this.buildCheckoutResponse(onlinePayment.booking, onlinePayment);
  }

  async getPublicStatus(bookingNumber: string) {
    const booking = await this.prisma.booking.findFirst({
      where: {
        bookingNumber,
        bookingSource: ONLINE_SOURCE,
      },
      include: {
        guest: {
          select: {
            fullName: true,
            email: true,
            phone: true,
          },
        },
        unit: {
          select: {
            id: true,
            unitNumber: true,
            displayName: true,
            property: { select: { id: true, name: true } },
          },
        },
        onlinePayment: {
          select: {
            id: true,
            status: true,
            amount: true,
            bookingTotalAmount: true,
            paymentSelection: true,
            currency: true,
            expiresAt: true,
            checkoutUrl: true,
            gateway: true,
            gatewayReference: true,
            webhookReceivedAt: true,
            rejectionReason: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!booking) {
      throw new NotFoundException(
        `Online booking "${bookingNumber}" not found`,
      );
    }

    const paymentLabel = this.publicPaymentLabel(
      booking.bookingStatus,
      booking.paymentState,
      booking.onlinePayment?.status,
    );

    const displayBookingStatus =
      booking.onlinePayment?.status === OnlinePaymentStatus.AUTHORIZED &&
      booking.bookingStatus === BookingStatus.PENDING
        ? 'PAYMENT_VERIFICATION_PENDING'
        : booking.bookingStatus;

    return {
      bookingNumber: booking.bookingNumber,
      bookingStatus: displayBookingStatus,
      rawBookingStatus: booking.bookingStatus,
      paymentState: booking.paymentState,
      paymentLabel,
      checkInDateTime: booking.checkInDateTime.toISOString(),
      checkOutDateTime: booking.checkOutDateTime.toISOString(),
      totalAmount: serializeMoney(booking.totalAmount),
      receivedAmount: serializeMoney(booking.receivedAmount),
      remainingAmount: serializeMoney(booking.remainingAmount),
      currency: booking.onlinePayment?.currency ?? 'PKR',
      guest: {
        fullName: booking.guest.fullName,
        email: booking.guest.email,
        phone: booking.guest.phone,
      },
      unit: booking.unit,
      onlinePayment: booking.onlinePayment
        ? {
            status: booking.onlinePayment.status,
            statusLabel: this.onlinePaymentStatusLabel(
              booking.onlinePayment.status,
            ),
            amount: serializeMoney(booking.onlinePayment.amount),
            bookingTotalAmount: serializeMoney(
              booking.onlinePayment.bookingTotalAmount,
            ),
            paymentSelection: booking.onlinePayment.paymentSelection,
            paymentTypeLabel: this.paymentSelectionLabel(
              booking.onlinePayment.paymentSelection,
            ),
            currency: booking.onlinePayment.currency,
            expiresAt: booking.onlinePayment.expiresAt.toISOString(),
            checkoutUrl: booking.onlinePayment.checkoutUrl,
            gateway: booking.onlinePayment.gateway,
            paidAt: booking.onlinePayment.webhookReceivedAt?.toISOString() ?? null,
            paymentReference: booking.onlinePayment.gatewayReference,
            rejectionReason:
              booking.onlinePayment.status === OnlinePaymentStatus.FAILED
                ? booking.onlinePayment.rejectionReason
                : null,
          }
        : null,
      paymentHoldExpiresAt: booking.paymentHoldExpiresAt?.toISOString() ?? null,
    };
  }

  async mockComplete(bookingNumber: string) {
    if (this.safepay.environment !== 'mock') {
      throw new ForbiddenException(
        'mock-complete is only available when SAFE_PAY_ENVIRONMENT=mock',
      );
    }

    const booking = await this.prisma.booking.findFirst({
      where: { bookingNumber, bookingSource: ONLINE_SOURCE },
      include: { onlinePayment: true },
    });
    if (!booking?.onlinePayment) {
      throw new NotFoundException(
        `Online booking "${bookingNumber}" not found`,
      );
    }

    return this.applySuccessfulPayment({
      onlinePaymentId: booking.onlinePayment.id,
      tracker: booking.onlinePayment.tracker ?? `mock_${booking.id}`,
      webhookEventId: `mock_complete_${booking.onlinePayment.id}`,
      paymentResponse: { source: 'mock-complete' },
    });
  }

  // ─── Webhook ────────────────────────────────────────────────────────────────

  async handleSafepayWebhook(
    rawBody: Buffer | string,
    headers: Record<string, string | string[] | undefined>,
  ) {
    const timestamp = this.headerValue(headers, 'x-sfpy-timestamp');
    const signature = this.headerValue(headers, 'x-sfpy-signature');

    if (!this.safepay.verifyWebhookSignature(rawBody, timestamp, signature)) {
      throw new UnauthorizedException('Invalid Safepay webhook signature');
    }

    const bodyText =
      typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(bodyText) as Record<string, unknown>;
    } catch {
      throw new BadRequestException('Invalid webhook JSON');
    }

    const eventType =
      (payload.type as string | undefined) ??
      (payload.event as string | undefined) ??
      (payload.name as string | undefined) ??
      '';
    const data =
      (payload.data as Record<string, unknown> | undefined) ?? payload;
    const tracker =
      (data.tracker as string | undefined) ??
      ((data.tracker as { token?: string } | undefined)?.token) ??
      (payload.tracker as string | undefined);
    const webhookEventId =
      (payload.id as string | undefined) ??
      (payload.event_id as string | undefined) ??
      (data.event_id as string | undefined) ??
      (tracker ? `sfpy_${tracker}_${eventType || 'event'}` : null);

    const success =
      /payment\.succeeded|tracker_ended|payment_success/i.test(eventType) ||
      data.success === true ||
      (data.tracker as { state?: string } | undefined)?.state ===
        'TRACKER_ENDED';

    if (!success) {
      this.logger.log(`Ignoring Safepay webhook event "${eventType}"`);
      return { ok: true, ignored: true };
    }

    if (!tracker) {
      throw new BadRequestException('Webhook missing tracker');
    }

    const onlinePayment = await this.prisma.onlinePayment.findFirst({
      where: {
        OR: [{ tracker }, { gatewayReference: tracker }],
      },
    });

    if (!onlinePayment) {
      throw new NotFoundException(
        `Online payment for tracker "${tracker}" not found`,
      );
    }

    if (onlinePayment.status === OnlinePaymentStatus.PAID) {
      return { ok: true, alreadyProcessed: true };
    }

    if (
      webhookEventId &&
      (await this.prisma.onlinePayment.findFirst({
        where: { webhookEventId },
      }))
    ) {
      return { ok: true, alreadyProcessed: true };
    }

    return this.applySuccessfulPayment({
      onlinePaymentId: onlinePayment.id,
      tracker,
      webhookEventId: webhookEventId ?? `sfpy_${onlinePayment.id}_${Date.now()}`,
      paymentResponse: payload,
    });
  }

  // ─── Admin ──────────────────────────────────────────────────────────────────

  async findAllAdmin(query: QueryOnlineBookingsDto) {
    const where = this.buildAdminWhere(query);
    const bookings = await this.prisma.booking.findMany({
      where,
      include: bookingInclude,
      orderBy: { createdAt: 'desc' },
    });
    return bookings.map((b) => this.mapAdminBooking(b));
  }

  async getSummaryAdmin() {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    const base = { bookingSource: ONLINE_SOURCE };

    const [
      todayCreated,
      todayConfirmed,
      todayPaid,
      pendingHolds,
      pendingVerifications,
      revenueAgg,
    ] = await Promise.all([
      this.prisma.booking.count({
        where: {
          ...base,
          createdAt: { gte: startOfDay, lte: endOfDay },
        },
      }),
      this.prisma.booking.count({
        where: {
          ...base,
          bookingStatus: BookingStatus.CONFIRMED,
          updatedAt: { gte: startOfDay, lte: endOfDay },
        },
      }),
      this.prisma.onlinePayment.count({
        where: {
          status: OnlinePaymentStatus.PAID,
          webhookReceivedAt: { gte: startOfDay, lte: endOfDay },
          booking: base,
        },
      }),
      this.prisma.booking.count({
        where: {
          ...base,
          bookingStatus: BookingStatus.PENDING,
          paymentHoldExpiresAt: { gt: now },
          onlinePayment: {
            status: { in: [OnlinePaymentStatus.PENDING] },
          },
        },
      }),
      this.prisma.onlinePayment.count({
        where: {
          status: OnlinePaymentStatus.AUTHORIZED,
          gateway: 'BANK_TRANSFER',
          booking: base,
        },
      }),
      this.prisma.onlinePayment.aggregate({
        where: {
          status: OnlinePaymentStatus.PAID,
          webhookReceivedAt: { gte: startOfDay, lte: endOfDay },
          booking: base,
        },
        _sum: { amount: true },
      }),
    ]);

    return {
      todayCreated,
      todayConfirmed,
      todayPaid,
      pendingHolds,
      pendingVerifications,
      pendingPayments: pendingVerifications,
      todayRevenue: serializeMoney(revenueAgg._sum.amount),
    };
  }

  /** Public payment page payload for bank transfer checkout. */
  async getBankTransferPaymentPage(bookingNumber: string) {
    const booking = await this.prisma.booking.findFirst({
      where: {
        bookingNumber: bookingNumber.trim(),
        bookingSource: ONLINE_SOURCE,
      },
      include: bookingInclude,
    });
    if (!booking || !booking.onlinePayment) {
      throw new NotFoundException(
        `Online booking "${bookingNumber}" not found`,
      );
    }

    const online = booking.onlinePayment;
    const bank = await this.getBankTransferDetails();
    const remainingAfterPayment = new Prisma.Decimal(
      online.bookingTotalAmount,
    ).minus(online.amount);

    return {
      bookingNumber: booking.bookingNumber,
      bookingStatus: booking.bookingStatus,
      paymentStatus: online.status,
      paymentStatusLabel: this.publicPaymentLabel(
        booking.bookingStatus,
        booking.paymentState,
        online.status,
      ),
      alreadySubmitted:
        online.status === OnlinePaymentStatus.AUTHORIZED ||
        online.status === OnlinePaymentStatus.PAID,
      guestName: booking.guest.fullName,
      unitLabel:
        booking.unit.displayName ||
        booking.unit.unitNumber ||
        booking.unit.id,
      checkInDateTime: booking.checkInDateTime.toISOString(),
      checkOutDateTime: booking.checkOutDateTime.toISOString(),
      numberOfGuests: booking.numberOfGuests,
      nights: booking.numberOfDays,
      quote: this.quoteFromBooking(booking),
      paymentSelection: online.paymentSelection,
      paymentTypeLabel: this.paymentSelectionLabel(online.paymentSelection),
      expectedAmount: serializeMoney(online.amount),
      bookingTotalAmount: serializeMoney(online.bookingTotalAmount),
      remainingAfterPayment: serializeMoney(remainingAfterPayment),
      currency: online.currency,
      bank,
      submitted: online.transactionReference
        ? {
            transactionReference: online.transactionReference,
            submittedAmount: online.submittedAmount
              ? serializeMoney(online.submittedAmount)
              : null,
            transferDate: online.transferDate?.toISOString() ?? null,
            senderName: online.senderName,
            senderBank: online.senderBank,
            rejectionReason:
              online.status === OnlinePaymentStatus.FAILED
                ? online.rejectionReason
                : null,
          }
        : null,
    };
  }

  async findOneAdmin(id: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id, bookingSource: ONLINE_SOURCE },
      include: bookingInclude,
    });
    if (!booking) {
      throw new NotFoundException(`Online booking with id "${id}" not found`);
    }
    return this.mapAdminBooking(booking);
  }

  async expireStaleHolds() {
    const now = new Date();
    const stale = await this.prisma.booking.findMany({
      where: {
        bookingSource: ONLINE_SOURCE,
        bookingStatus: BookingStatus.PENDING,
        paymentHoldExpiresAt: { lt: now },
      },
      include: { onlinePayment: true },
      take: 100,
    });

    for (const booking of stale) {
      if (
        booking.onlinePayment?.status === OnlinePaymentStatus.AUTHORIZED ||
        booking.onlinePayment?.status === OnlinePaymentStatus.PAID
      ) {
        continue;
      }
      await this.prisma.$transaction(async (tx) => {
        await tx.booking.update({
          where: { id: booking.id },
          data: {
            bookingStatus: BookingStatus.CANCELLED,
            cancelledAt: now,
            paymentHoldExpiresAt: null,
          },
        });
        if (
          booking.onlinePayment &&
          booking.onlinePayment.status === OnlinePaymentStatus.PENDING
        ) {
          await tx.onlinePayment.update({
            where: { id: booking.onlinePayment.id },
            data: { status: OnlinePaymentStatus.EXPIRED },
          });
        }
      });
    }

    return { expired: stale.length };
  }

  // ─── Manual bank transfer ───────────────────────────────────────────────────

  async submitBankTransfer(
    dto: SubmitBankTransferDto,
    receiptRelativePath?: string | null,
  ) {
    const booking = await this.prisma.booking.findFirst({
      where: {
        bookingNumber: dto.bookingNumber.trim(),
        bookingSource: ONLINE_SOURCE,
      },
      include: bookingInclude,
    });
    if (!booking || !booking.onlinePayment) {
      throw new NotFoundException(
        `Online booking "${dto.bookingNumber}" not found`,
      );
    }

    const online = booking.onlinePayment;
    if (online.status === OnlinePaymentStatus.PAID) {
      throw new ConflictException('This payment has already been verified');
    }
    if (
      online.status === OnlinePaymentStatus.AUTHORIZED &&
      online.transactionReference
    ) {
      throw new ConflictException(
        'Payment details already submitted and awaiting staff verification',
      );
    }
    if (
      online.status === OnlinePaymentStatus.EXPIRED ||
      online.status === OnlinePaymentStatus.CANCELLED ||
      booking.bookingStatus === BookingStatus.CANCELLED
    ) {
      throw new BadRequestException(
        'This booking hold has expired or been cancelled. Please start a new booking.',
      );
    }

    const selection = this.toPaymentSelection(dto.paymentSelection);
    if (selection !== online.paymentSelection) {
      throw new BadRequestException(
        'Payment type does not match the amount reserved for this booking',
      );
    }

    const expected = new Prisma.Decimal(online.amount);
    const submitted = new Prisma.Decimal(dto.submittedAmount).toDecimalPlaces(2);
    if (!submitted.equals(expected.toDecimalPlaces(2))) {
      throw new BadRequestException(
        `The submitted payment amount does not match the selected payment amount. Expected PKR ${serializeMoney(expected)}.`,
      );
    }

    const ref = dto.transactionReference.trim();
    const duplicate = await this.prisma.onlinePayment.findFirst({
      where: {
        transactionReference: { equals: ref, mode: 'insensitive' },
        id: { not: online.id },
        status: {
          in: [
            OnlinePaymentStatus.AUTHORIZED,
            OnlinePaymentStatus.PAID,
            OnlinePaymentStatus.PENDING,
          ],
        },
      },
    });
    if (duplicate) {
      throw new ConflictException(
        'This transaction reference has already been submitted',
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: booking.id },
        data: {
          // Keep hold open while staff verifies the bank transfer.
          paymentHoldExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });
      return tx.onlinePayment.update({
        where: { id: online.id },
        data: {
          status: OnlinePaymentStatus.AUTHORIZED,
          gateway: 'BANK_TRANSFER',
          submittedAmount: submitted,
          transactionReference: ref,
          transferDate: new Date(dto.transferDate),
          senderName: dto.senderName.trim(),
          senderBank: dto.senderBank.trim(),
          receiptPath: receiptRelativePath ?? online.receiptPath,
          gatewayReference: ref,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
        include: {
          booking: { include: bookingInclude },
        },
      });
    });

    const unitLabel =
      booking.unit.displayName ||
      booking.unit.unitNumber ||
      booking.unit.id;
    const message = [
      `Booking Number: ${booking.bookingNumber}`,
      `Customer: ${booking.guest.fullName}`,
      `Apartment: ${unitLabel}`,
      `Check-in: ${booking.checkInDateTime.toISOString()}`,
      `Check-out: ${booking.checkOutDateTime.toISOString()}`,
      `Payment Type: ${this.paymentSelectionLabel(selection)}`,
      `Expected Amount: PKR ${serializeMoney(expected)}`,
      `Submitted Amount: PKR ${serializeMoney(submitted)}`,
      `Transaction Reference: ${ref}`,
      `Payment Date: ${dto.transferDate}`,
      `Status: PENDING VERIFICATION`,
    ].join('\n');

    await this.notifications.notifyRoles([...ROLE_SETS.ALL], {
      type: NotificationType.WARNING,
      title: 'NEW PAYMENT VERIFICATION',
      message,
      relatedModule: 'ONLINE_BOOKING',
      relatedId: booking.id,
      priority: NotificationPriority.CRITICAL,
      actionUrl: `/online-bookings?booking=${booking.id}&verify=1`,
      dedupeKey: `BANK_TRANSFER_PENDING:${booking.id}`,
      icon: 'bell',
    });

    await this.auditLogs.write({
      module: 'ONLINE_BOOKING',
      action: 'PAYMENT_SUBMITTED',
      recordId: booking.id,
      userId: null,
      role: null,
      newData: {
        bookingNumber: booking.bookingNumber,
        transactionReference: ref,
        submittedAmount: serializeMoney(submitted),
        paymentSelection: selection,
      },
    });

    if (booking.guest.email) {
      await this.mail.send({
        to: booking.guest.email,
        subject: `Casa Bella — Payment Verification Received`,
        text: [
          `Dear ${booking.guest.fullName},`,
          '',
          `We have received your payment details for booking ${booking.bookingNumber}.`,
          '',
          'Our team is currently verifying the payment against our bank records.',
          'Your reservation will be confirmed once the payment has been successfully verified.',
          '',
          'Thank you for choosing Casa Bella Hotel & Residence.',
        ].join('\n'),
      });
    }

    return {
      ok: true,
      bookingNumber: booking.bookingNumber,
      bookingStatus: 'PAYMENT_VERIFICATION_PENDING',
      paymentStatus: 'PENDING_VERIFICATION',
      paymentTypeLabel: this.paymentSelectionLabel(selection),
      submittedAmount: serializeMoney(submitted),
      expectedAmount: serializeMoney(expected),
      remainingAfterPayment: serializeMoney(
        new Prisma.Decimal(updated.bookingTotalAmount).minus(expected),
      ),
      message:
        'Payment details received. Your reservation will be confirmed after staff verification.',
    };
  }

  async verifyBankTransfer(
    onlinePaymentId: string,
    actor: AuthUser,
    dto: VerifyBankTransferDto,
  ) {
    const existing = await this.prisma.onlinePayment.findUnique({
      where: { id: onlinePaymentId },
      include: {
        booking: {
          include: {
            guest: true,
            unit: {
              include: { property: { select: { id: true, name: true } } },
            },
          },
        },
      },
    });
    if (!existing || existing.gateway !== 'BANK_TRANSFER') {
      throw new NotFoundException('Bank transfer payment not found');
    }
    if (existing.status === OnlinePaymentStatus.PAID) {
      return { ok: true, alreadyProcessed: true, bookingId: existing.bookingId };
    }
    if (existing.status !== OnlinePaymentStatus.AUTHORIZED) {
      throw new BadRequestException(
        'Only payments pending verification can be accepted',
      );
    }

    // Re-check availability excluding this booking
    const overlap = await this.prisma.booking.findFirst({
      where: {
        id: { not: existing.bookingId },
        unitId: existing.booking.unitId,
        bookingStatus: { in: ACTIVE_BOOKING_STATUSES },
        checkInDateTime: { lt: existing.booking.checkOutDateTime },
        checkOutDateTime: { gt: existing.booking.checkInDateTime },
      },
      select: { id: true, bookingNumber: true },
    });
    if (overlap) {
      throw new ConflictException(
        `ROOM AVAILABILITY HAS CHANGED. Conflicting booking ${overlap.bookingNumber}. Resolve before confirming.`,
      );
    }

    const result = await this.applySuccessfulPayment({
      onlinePaymentId: existing.id,
      tracker:
        existing.transactionReference ||
        existing.tracker ||
        `bank_${existing.id}`,
      webhookEventId: `bank_verify_${existing.id}`,
      paymentResponse: {
        method: 'BANK_TRANSFER',
        verifiedBy: actor.id,
        staffNotes: dto.staffNotes ?? null,
      },
      verifiedByUserId: actor.id,
      paymentMethod: PaymentMethod.BANK_TRANSFER,
    });

    await this.auditLogs.write({
      module: 'ONLINE_BOOKING',
      action: 'PAYMENT_ACCEPTED',
      recordId: existing.bookingId,
      userId: actor.id,
      role: actor.role,
      oldData: { status: OnlinePaymentStatus.AUTHORIZED },
      newData: {
        status: OnlinePaymentStatus.PAID,
        staffNotes: dto.staffNotes ?? null,
      },
    });

    return result;
  }

  async rejectBankTransfer(
    onlinePaymentId: string,
    actor: AuthUser,
    dto: RejectBankTransferDto,
  ) {
    const existing = await this.prisma.onlinePayment.findUnique({
      where: { id: onlinePaymentId },
      include: {
        booking: {
          include: {
            guest: true,
            unit: {
              include: { property: { select: { id: true, name: true } } },
            },
          },
        },
      },
    });
    if (!existing || existing.gateway !== 'BANK_TRANSFER') {
      throw new NotFoundException('Bank transfer payment not found');
    }
    if (existing.status === OnlinePaymentStatus.PAID) {
      throw new ConflictException('Verified payments cannot be rejected');
    }
    if (existing.status === OnlinePaymentStatus.FAILED) {
      return { ok: true, alreadyProcessed: true };
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.onlinePayment.update({
        where: { id: existing.id },
        data: {
          status: OnlinePaymentStatus.FAILED,
          rejectionReason: dto.rejectionReason.trim(),
          staffNotes: dto.staffNotes?.trim() || null,
          verifiedByUserId: actor.id,
          verifiedAt: new Date(),
        },
      });
      await tx.booking.update({
        where: { id: existing.bookingId },
        data: {
          bookingStatus: BookingStatus.CANCELLED,
          cancelledAt: new Date(),
          paymentHoldExpiresAt: null,
        },
      });
    });

    await this.auditLogs.write({
      module: 'ONLINE_BOOKING',
      action: 'PAYMENT_REJECTED',
      recordId: existing.bookingId,
      userId: actor.id,
      role: actor.role,
      oldData: { status: existing.status },
      newData: {
        status: OnlinePaymentStatus.FAILED,
        rejectionReason: dto.rejectionReason.trim(),
      },
    });

    if (existing.booking.guest.email) {
      await this.mail.send({
        to: existing.booking.guest.email,
        subject: 'Casa Bella — Payment Verification Unsuccessful',
        text: [
          `Dear ${existing.booking.guest.fullName},`,
          '',
          'We were unable to verify the payment associated with your reservation at this time.',
          '',
          `Reason: ${dto.rejectionReason.trim()}`,
          '',
          'Please review your payment details or contact Casa Bella Hotel & Residence for assistance.',
          '',
          'Thank you.',
        ].join('\n'),
      });
    }

    return {
      ok: true,
      bookingStatus: 'CANCELLED',
      paymentStatus: 'REJECTED',
    };
  }

  // ─── Payment success ────────────────────────────────────────────────────────

  private async applySuccessfulPayment(input: {
    onlinePaymentId: string;
    tracker: string;
    webhookEventId: string;
    paymentResponse: unknown;
    verifiedByUserId?: string;
    paymentMethod?: PaymentMethod;
  }) {
    const existing = await this.prisma.onlinePayment.findUnique({
      where: { id: input.onlinePaymentId },
      include: {
        booking: {
          include: {
            guest: true,
            unit: {
              include: {
                property: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException('Online payment not found');
    }

    if (existing.status === OnlinePaymentStatus.PAID) {
      return { ok: true, alreadyProcessed: true, bookingId: existing.bookingId };
    }

    const systemUser =
      (await this.prisma.user.findFirst({
        where: { status: Status.ACTIVE, role: Role.SUPER_ADMIN },
        orderBy: { createdAt: 'asc' },
      })) ??
      (await this.prisma.user.findFirst({
        where: { status: Status.ACTIVE, role: Role.ADMIN },
        orderBy: { createdAt: 'asc' },
      }));

    if (!systemUser && !input.verifiedByUserId) {
      throw new BadRequestException(
        'No active SUPER_ADMIN or ADMIN user available to record payment',
      );
    }

    const amount = Number(existing.amount.toString());
    const ledgerUserId = input.verifiedByUserId || systemUser!.id;
    const ledgerRole = input.verifiedByUserId
      ? ((await this.prisma.user.findUnique({
          where: { id: input.verifiedByUserId },
          select: { role: true },
        }))?.role ?? Role.ADMIN)
      : systemUser!.role;
    const method = input.paymentMethod ?? PaymentMethod.SAFEPAY;
    const methodLabel =
      method === PaymentMethod.BANK_TRANSFER ? 'bank transfer' : 'Safepay';

    const paymentResult = await this.payments.create(
      {
        paymentForType: PaymentForType.BOOKING,
        bookingId: existing.bookingId,
        amount,
        paymentMethod: method,
        paymentDate: (
          existing.transferDate ?? new Date()
        ).toISOString(),
        transactionReference: input.tracker,
        proofAttachmentUrl: existing.receiptPath ?? undefined,
        notes: [
          `Online ${methodLabel} ${existing.paymentSelection === OnlinePaymentSelection.ADVANCE_50 ? '50% advance' : 'full'} payment for ${existing.booking.bookingNumber}`,
          existing.senderName ? `Sender: ${existing.senderName}` : null,
          existing.senderBank ? `Bank: ${existing.senderBank}` : null,
        ]
          .filter(Boolean)
          .join('; '),
      },
      ledgerRole,
      ledgerUserId,
    );

    const ledgerPaymentId = paymentResult.id as string;

    await this.prisma.$transaction(async (tx) => {
      await tx.onlinePayment.update({
        where: { id: existing.id },
        data: {
          status: OnlinePaymentStatus.PAID,
          tracker: existing.tracker ?? input.tracker,
          gatewayReference: input.tracker,
          webhookEventId: input.webhookEventId,
          webhookReceivedAt: new Date(),
          paymentId: ledgerPaymentId,
          paymentResponse: input.paymentResponse as Prisma.InputJsonValue,
          verifiedAt: new Date(),
          verifiedByUserId: input.verifiedByUserId ?? null,
        },
      });

      await tx.booking.update({
        where: { id: existing.bookingId },
        data: {
          bookingStatus: BookingStatus.CONFIRMED,
          paymentHoldExpiresAt: null,
        },
      });
    });

    const booking = existing.booking;
    const unitLabel =
      booking.unit.displayName ||
      booking.unit.unitNumber ||
      booking.unit.id;
    const checkInLabel = booking.checkInDateTime.toISOString();
    const checkOutLabel = booking.checkOutDateTime.toISOString();
    const remaining = new Prisma.Decimal(existing.bookingTotalAmount).minus(
      existing.amount,
    );
    const paymentStatusLabel = remaining.greaterThan(0)
      ? 'PARTIALLY_PAID'
      : 'FULLY_PAID';
    const methodNote =
      method === PaymentMethod.BANK_TRANSFER
        ? 'BANK TRANSFER VERIFIED'
        : 'PAID (Safepay)';
    const message = [
      `Booking Number: ${booking.bookingNumber}`,
      `Customer: ${booking.guest.fullName}`,
      `Apartment: ${unitLabel} @ ${booking.unit.property.name}`,
      `Check-in: ${checkInLabel}`,
      `Check-out: ${checkOutLabel}`,
      `Guests: ${booking.numberOfGuests}`,
      `Payment Type: ${this.paymentSelectionLabel(existing.paymentSelection)}`,
      `Amount: PKR ${serializeMoney(existing.amount)}`,
      `Total: PKR ${serializeMoney(existing.bookingTotalAmount)}`,
      `Remaining Balance: PKR ${serializeMoney(remaining)}`,
      `Payment: ${methodNote}`,
      `Time: ${new Date().toISOString()}`,
    ].join('\n');

    await this.notifications.notifyRoles([...ROLE_SETS.ALL], {
      type: NotificationType.SUCCESS,
      title: 'BOOKING FROM WEBSITE',
      message,
      relatedModule: 'ONLINE_BOOKING',
      relatedId: booking.id,
      priority: NotificationPriority.CRITICAL,
      actionUrl: `/online-bookings?booking=${booking.id}`,
      dedupeKey: `ONLINE_BOOKING:${booking.id}`,
      icon: 'bell',
    });

    const auditUserId = input.verifiedByUserId ?? systemUser?.id ?? null;
    const auditRole = input.verifiedByUserId
      ? ledgerRole
      : (systemUser?.role ?? null);

    await this.auditLogs.write({
      module: 'ONLINE_BOOKING',
      action: 'BOOKING_CONFIRMED',
      recordId: booking.id,
      userId: auditUserId,
      role: auditRole,
      newData: {
        bookingNumber: booking.bookingNumber,
        onlinePaymentId: existing.id,
        paymentId: ledgerPaymentId,
        tracker: input.tracker,
        amount: serializeMoney(existing.amount),
        paymentMethod: method,
        paymentStatus: paymentStatusLabel,
      },
    });

    const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL?.trim();
    if (adminEmail) {
      await this.mail.send({
        to: adminEmail,
        subject: `BOOKING FROM WEBSITE — ${booking.bookingNumber}`,
        text: message,
      });
    }
    if (booking.guest.email) {
      await this.mail.send({
        to: booking.guest.email,
        subject: 'Casa Bella — Booking Confirmed',
        text: [
          `Dear ${booking.guest.fullName},`,
          '',
          'We are pleased to confirm that your payment has been verified and your reservation at Casa Bella Hotel & Residence is confirmed.',
          '',
          `Booking Number: ${booking.bookingNumber}`,
          `Room/Apartment: ${unitLabel}`,
          `Check-in: ${booking.checkInDateTime.toISOString()}`,
          `Check-out: ${booking.checkOutDateTime.toISOString()}`,
          `Payment Received: PKR ${serializeMoney(existing.amount)}`,
          `Remaining Balance: PKR ${serializeMoney(remaining)}`,
          '',
          'We look forward to welcoming you.',
        ].join('\n'),
      });
    }

    return {
      ok: true,
      bookingId: booking.id,
      bookingNumber: booking.bookingNumber,
      paymentId: ledgerPaymentId,
      paymentStatus: paymentStatusLabel,
      remainingBalance: serializeMoney(remaining),
    };
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private mapPublicUnit(
    unit: Prisma.UnitGetPayload<{
      include: {
        property: { select: { id: true; name: true; isActive: true } };
      };
    }>,
    options: { booked: boolean },
  ) {
    const operationalBlock =
      unit.status === UnitStatus.MAINTENANCE ||
      unit.status === UnitStatus.BLOCKED;

    let bookingAvailability: 'AVAILABLE' | 'BOOKED' | 'UNAVAILABLE' =
      'AVAILABLE';
    if (operationalBlock) {
      bookingAvailability = 'UNAVAILABLE';
    } else if (options.booked) {
      bookingAvailability = 'BOOKED';
    }

    const description =
      unit.description?.trim() ||
      unit.notes?.trim() ||
      null;

    const amenities = Array.isArray(unit.amenities)
      ? unit.amenities.filter((v): v is string => typeof v === 'string')
      : [];
    const imageUrls = Array.isArray(unit.imageUrls)
      ? unit.imageUrls.filter((v): v is string => typeof v === 'string')
      : [];

    return {
      id: unit.id,
      propertyId: unit.propertyId,
      propertyName: unit.property.name,
      unitNumber: unit.unitNumber,
      roomNumber: unit.unitNumber,
      unitType: unit.unitType,
      displayName: unit.displayName?.trim() || unit.unitNumber,
      description,
      maxGuests: unit.maxGuests,
      bedConfiguration: unit.bedConfiguration,
      amenities,
      imageUrls,
      bedrooms: unit.bedrooms,
      floor: unit.floor,
      dailyRate: unit.dailyRate != null ? serializeMoney(unit.dailyRate) : null,
      status: unit.status,
      bookingAvailability,
      canBook: bookingAvailability === 'AVAILABLE',
      bookingLabel:
        bookingAvailability === 'AVAILABLE'
          ? 'BOOK NOW'
          : bookingAvailability === 'BOOKED'
            ? 'ALREADY BOOKED'
            : 'UNAVAILABLE',
    };
  }

  private mapAdminBooking(
    booking: Prisma.BookingGetPayload<{ include: typeof bookingInclude }>,
  ) {
    return {
      id: booking.id,
      bookingNumber: booking.bookingNumber,
      bookingStatus: booking.bookingStatus,
      paymentState: booking.paymentState,
      bookingSource: booking.bookingSource,
      checkInDateTime: booking.checkInDateTime.toISOString(),
      checkOutDateTime: booking.checkOutDateTime.toISOString(),
      numberOfDays: booking.numberOfDays,
      numberOfGuests: booking.numberOfGuests,
      adults: booking.adults,
      children: booking.children,
      totalAmount: serializeMoney(booking.totalAmount),
      receivedAmount: serializeMoney(booking.receivedAmount),
      remainingAmount: serializeMoney(booking.remainingAmount),
      paymentHoldExpiresAt: booking.paymentHoldExpiresAt?.toISOString() ?? null,
      notes: booking.notes,
      createdAt: booking.createdAt.toISOString(),
      guest: {
        id: booking.guest.id,
        fullName: booking.guest.fullName,
        phone: booking.guest.phone,
        email: booking.guest.email,
      },
      unit: {
        id: booking.unit.id,
        unitNumber: booking.unit.unitNumber,
        displayName: booking.unit.displayName,
        property: booking.unit.property,
      },
      onlinePayment: booking.onlinePayment
        ? {
            id: booking.onlinePayment.id,
            status: booking.onlinePayment.status,
            statusLabel: this.onlinePaymentStatusLabel(
              booking.onlinePayment.status,
            ),
            gateway: booking.onlinePayment.gateway,
            amount: serializeMoney(booking.onlinePayment.amount),
            submittedAmount: booking.onlinePayment.submittedAmount
              ? serializeMoney(booking.onlinePayment.submittedAmount)
              : null,
            bookingTotalAmount: serializeMoney(
              booking.onlinePayment.bookingTotalAmount,
            ),
            paymentSelection: booking.onlinePayment.paymentSelection,
            paymentTypeLabel: this.paymentSelectionLabel(
              booking.onlinePayment.paymentSelection,
            ),
            currency: booking.onlinePayment.currency,
            tracker: booking.onlinePayment.tracker,
            gatewayReference: booking.onlinePayment.gatewayReference,
            transactionReference: booking.onlinePayment.transactionReference,
            transferDate:
              booking.onlinePayment.transferDate?.toISOString() ?? null,
            senderName: booking.onlinePayment.senderName,
            senderBank: booking.onlinePayment.senderBank,
            receiptPath: booking.onlinePayment.receiptPath,
            rejectionReason: booking.onlinePayment.rejectionReason,
            staffNotes: booking.onlinePayment.staffNotes,
            verifiedAt:
              booking.onlinePayment.verifiedAt?.toISOString() ?? null,
            verifiedByUserId: booking.onlinePayment.verifiedByUserId,
            checkoutUrl: booking.onlinePayment.checkoutUrl,
            expiresAt: booking.onlinePayment.expiresAt.toISOString(),
            paidAt:
              booking.onlinePayment.webhookReceivedAt?.toISOString() ?? null,
            paymentId: booking.onlinePayment.paymentId,
            submittedAt: booking.onlinePayment.updatedAt.toISOString(),
          }
        : null,
    };
  }

  private buildCheckoutResponse(
    booking: Prisma.BookingGetPayload<{ include: typeof bookingInclude }>,
    onlinePayment: {
      id: string;
      checkoutUrl: string | null;
      expiresAt: Date;
      amount: Prisma.Decimal;
      bookingTotalAmount: Prisma.Decimal;
      paymentSelection: OnlinePaymentSelection;
      currency: string;
    },
  ) {
    const remainingAfterPayment = new Prisma.Decimal(
      onlinePayment.bookingTotalAmount,
    ).minus(onlinePayment.amount);

    return {
      bookingId: booking.id,
      bookingNumber: booking.bookingNumber,
      checkoutUrl: onlinePayment.checkoutUrl,
      onlinePaymentId: onlinePayment.id,
      expiresAt: onlinePayment.expiresAt.toISOString(),
      paymentSelection: onlinePayment.paymentSelection,
      paymentTypeLabel: this.paymentSelectionLabel(
        onlinePayment.paymentSelection,
      ),
      paymentMode: this.paymentGateway.isBankTransfer
        ? 'bank_transfer'
        : this.safepay.environment,
      paymentMethod: this.paymentGateway.isBankTransfer
        ? 'BANK_TRANSFER'
        : 'SAFEPAY',
      acceptsRealCards: false,
      quote: {
        ...this.quoteFromBooking(booking),
        payNowAmount: serializeMoney(onlinePayment.amount),
        remainingAfterPayment: serializeMoney(remainingAfterPayment),
        paymentSelection: onlinePayment.paymentSelection,
      },
    };
  }

  private toPaymentSelection(
    value: OnlinePaymentSelectionDto,
  ): OnlinePaymentSelection {
    return value === 'ADVANCE_50'
      ? OnlinePaymentSelection.ADVANCE_50
      : OnlinePaymentSelection.FULL_100;
  }

  private resolveChargeAmount(
    totalAmount: Prisma.Decimal,
    selection: OnlinePaymentSelection,
  ): Prisma.Decimal {
    if (selection === OnlinePaymentSelection.ADVANCE_50) {
      return totalAmount.div(2).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    }
    return totalAmount;
  }

  private paymentSelectionLabel(selection: OnlinePaymentSelection): string {
    return selection === OnlinePaymentSelection.ADVANCE_50
      ? '50% Advance'
      : 'Full Payment';
  }

  private publicPaymentLabel(
    bookingStatus: BookingStatus,
    paymentState: PaymentState,
    onlineStatus?: OnlinePaymentStatus | null,
  ): string {
    if (onlineStatus === OnlinePaymentStatus.EXPIRED) {
      return 'Expired';
    }
    if (onlineStatus === OnlinePaymentStatus.FAILED) {
      return 'Payment Rejected';
    }
    if (onlineStatus === OnlinePaymentStatus.AUTHORIZED) {
      return 'Pending Verification';
    }
    if (
      bookingStatus === BookingStatus.PENDING &&
      (onlineStatus === OnlinePaymentStatus.PENDING || !onlineStatus)
    ) {
      return 'Pending Payment';
    }
    if (bookingStatus === BookingStatus.CANCELLED) {
      return 'Cancelled';
    }
    if (bookingStatus === BookingStatus.CONFIRMED) {
      if (paymentState === PaymentState.PAID) return 'Fully Paid';
      if (
        paymentState === PaymentState.ADVANCE ||
        paymentState === PaymentState.PARTIAL ||
        paymentState === PaymentState.HALF_PAID
      ) {
        return 'Partially Paid';
      }
      return 'Booking Confirmed';
    }
    if (paymentState === PaymentState.PAID) return 'Fully Paid';
    if (
      paymentState === PaymentState.ADVANCE ||
      paymentState === PaymentState.PARTIAL ||
      paymentState === PaymentState.HALF_PAID
    ) {
      return 'Partially Paid';
    }
    if (paymentState === PaymentState.UNPAID) return 'Pending Payment';
    return paymentState;
  }

  private onlinePaymentStatusLabel(status: OnlinePaymentStatus): string {
    switch (status) {
      case OnlinePaymentStatus.AUTHORIZED:
        return 'PENDING_VERIFICATION';
      case OnlinePaymentStatus.PAID:
        return 'VERIFIED';
      case OnlinePaymentStatus.FAILED:
        return 'REJECTED';
      case OnlinePaymentStatus.PENDING:
        return 'PENDING';
      case OnlinePaymentStatus.EXPIRED:
        return 'EXPIRED';
      case OnlinePaymentStatus.CANCELLED:
        return 'CANCELLED';
      default:
        return status;
    }
  }

  private quoteFromBooking(
    booking: Prisma.BookingGetPayload<{ include: typeof bookingInclude }>,
  ) {
    return {
      nights: booking.numberOfDays,
      dailyRate: serializeMoney(booking.dailyRate),
      roomCharges: serializeMoney(booking.roomCharges),
      taxes: '0',
      total: serializeMoney(booking.totalAmount),
      currency: 'PKR',
    };
  }

  private buildAdminWhere(query: QueryOnlineBookingsDto): Prisma.BookingWhereInput {
    const where: Prisma.BookingWhereInput = {
      bookingSource: ONLINE_SOURCE,
    };

    const bookingStatus = query.bookingStatus || query.status;
    if (bookingStatus) where.bookingStatus = bookingStatus;
    if (query.paymentState) where.paymentState = query.paymentState;
    if (query.propertyId) {
      where.unit = { propertyId: query.propertyId };
    }
    if (query.onlinePaymentStatus) {
      where.onlinePayment = { status: query.onlinePaymentStatus };
    }
    if (query.from || query.to) {
      where.createdAt = {};
      if (query.from) where.createdAt.gte = new Date(query.from);
      if (query.to) where.createdAt.lte = new Date(query.to);
    }
    if (query.search?.trim()) {
      const term = query.search.trim();
      where.OR = [
        { bookingNumber: { contains: term, mode: 'insensitive' } },
        { guest: { fullName: { contains: term, mode: 'insensitive' } } },
        { guest: { phone: { contains: term, mode: 'insensitive' } } },
        { guest: { email: { contains: term, mode: 'insensitive' } } },
        { unit: { unitNumber: { contains: term, mode: 'insensitive' } } },
      ];
    }

    const now = new Date();
    const startToday = new Date(now);
    startToday.setHours(0, 0, 0, 0);
    const endToday = new Date(now);
    endToday.setHours(23, 59, 59, 999);
    const startTomorrow = new Date(startToday);
    startTomorrow.setDate(startTomorrow.getDate() + 1);
    const endTomorrow = new Date(endToday);
    endTomorrow.setDate(endTomorrow.getDate() + 1);

    if (query.range === 'today') {
      where.checkInDateTime = { gte: startToday, lte: endToday };
    } else if (query.range === 'tomorrow') {
      where.checkInDateTime = { gte: startTomorrow, lte: endTomorrow };
    } else if (query.range === 'upcoming') {
      where.checkInDateTime = { gte: startToday };
      if (!bookingStatus) {
        where.bookingStatus = {
          in: [BookingStatus.PENDING, BookingStatus.CONFIRMED],
        };
      }
    }

    return where;
  }

  private async getAssignableUnit(unitId: string) {
    const unit = await this.prisma.unit.findUnique({
      where: { id: unitId },
      include: { property: true },
    });

    if (!unit || !unit.isActive) {
      throw new NotFoundException(`Unit with id "${unitId}" not found`);
    }

    if (
      unit.status === UnitStatus.MAINTENANCE ||
      unit.status === UnitStatus.BLOCKED
    ) {
      throw new BadRequestException(
        'Units in maintenance or blocked status cannot be booked',
      );
    }

    return unit;
  }

  private async assertMonthlyTenancyAllowsHotelUse(unitId: string) {
    const activeTenancy = await this.prisma.monthlyTenancy.findFirst({
      where: {
        unitId,
        tenancyStatus: MonthlyTenancyStatus.ACTIVE,
      },
    });

    if (!activeTenancy) {
      return;
    }

    if (activeTenancy.occupancyState !== MonthlyOccupancyState.EMPTY) {
      throw new ConflictException(
        'Unit has an active occupied monthly tenancy and cannot be booked',
      );
    }
  }

  private async assertNoOverlap(
    unitId: string,
    checkIn: Date,
    checkOut: Date,
    excludeId?: string,
  ) {
    const overlap = await this.prisma.booking.findFirst({
      where: {
        unitId,
        bookingStatus: { in: ACTIVE_BOOKING_STATUSES },
        ...(excludeId ? { id: { not: excludeId } } : {}),
        checkInDateTime: { lt: checkOut },
        checkOutDateTime: { gt: checkIn },
      },
    });

    if (overlap) {
      throw new ConflictException(
        'Unit is already booked or occupied for the selected date and time.',
      );
    }
  }

  private assertDateRange(checkIn: string, checkOut: string) {
    const start = new Date(checkIn);
    const end = new Date(checkOut);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException('Invalid check-in or check-out date/time');
    }

    if (end <= start) {
      throw new BadRequestException(CHECKOUT_AFTER_CHECKIN_MESSAGE);
    }
  }

  private async nextBookingNumber(tx: Prisma.TransactionClient) {
    const now = new Date();
    const yyyy = now.getUTCFullYear();
    const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(now.getUTCDate()).padStart(2, '0');
    const dateKey = `${yyyy}${mm}${dd}`;
    const settingKey = `booking_seq_${dateKey}`;

    const rows = await tx.$queryRaw<Array<{ value: string }>>`
      INSERT INTO "SystemSetting" (key, value, "createdAt", "updatedAt")
      VALUES (${settingKey}, '1', NOW(), NOW())
      ON CONFLICT (key)
      DO UPDATE SET
        value = (CAST("SystemSetting".value AS INTEGER) + 1)::text,
        "updatedAt" = NOW()
      RETURNING value
    `;

    const seq = String(rows[0]?.value ?? '1').padStart(4, '0');
    return `BK-${dateKey}-${seq}`;
  }

  private headerValue(
    headers: Record<string, string | string[] | undefined>,
    name: string,
  ): string | undefined {
    const raw = headers[name] ?? headers[name.toLowerCase()];
    if (Array.isArray(raw)) return raw[0];
    return raw;
  }
}
