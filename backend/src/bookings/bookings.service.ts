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
  MonthlyOccupancyState,
  MonthlyTenancyStatus,
  PaymentState,
  Prisma,
  Role,
  UnitStatus,
} from '../../generated/prisma/client';
import { GuestsService } from '../guests/guests.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  assertDiscountAllowed,
  calculateBookingTotals,
  serializeMoney,
} from './booking.finance';
import { calculateCheckoutQuote } from './booking.early-checkout';
import { CHECKOUT_AFTER_CHECKIN_MESSAGE } from './booking.duration';
import { mapBookingForRole } from './bookings.mapper';
import { CheckoutBookingDto } from './dto/checkout-booking.dto';
import { CreateBookingDto } from './dto/create-booking.dto';
import { QueryBookingsDto } from './dto/query-bookings.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';

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
  createdBy: { select: { id: true, fullName: true } },
  checkedOutBy: { select: { id: true, fullName: true } },
} satisfies Prisma.BookingInclude;

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly guestsService: GuestsService,
  ) {}

  async create(dto: CreateBookingDto, role: Role, userId: string) {
    this.assertCanMutateBookings(role);

    const guestId = await this.resolveGuestId(dto, role);
    await this.guestsService.ensureActive(guestId);

    const unit = await this.getAssignableUnit(dto.unitId);
    if (unit.propertyId !== dto.propertyId) {
      throw new BadRequestException(
        'Selected unit does not belong to the selected property',
      );
    }
    this.assertDateRange(dto.checkInDateTime, dto.checkOutDateTime);
    await this.assertNoOverlap(
      dto.unitId,
      new Date(dto.checkInDateTime),
      new Date(dto.checkOutDateTime),
    );
    await this.assertMonthlyTenancyAllowsHotelUse(dto.unitId);

    const rates = this.resolveRates(dto, unit);
    const totals = this.buildTotals(dto, rates, role);

    const booking = await this.prisma.$transaction(async (tx) => {
      const bookingNumber = await this.nextBookingNumber(tx);

      return tx.booking.create({
        data: {
          bookingNumber,
          guestId,
          unitId: dto.unitId,
          bookingType: dto.bookingType,
          checkInDateTime: new Date(dto.checkInDateTime),
          checkOutDateTime: new Date(dto.checkOutDateTime),
          ...totals,
          otherChargesDescription: dto.otherChargesDescription?.trim() || null,
          bookingStatus: BookingStatus.PENDING,
          numberOfGuests: dto.numberOfGuests ?? 1,
          adults: dto.adults,
          children: dto.children,
          bookingSource: dto.bookingSource,
          notes: dto.notes,
          createdByUserId: userId,
        },
        include: bookingInclude,
      });
    });

    return mapBookingForRole(booking, role);
  }

  async findAll(query: QueryBookingsDto, role: Role) {
    const where = this.buildWhere(query);
    const bookings = await this.prisma.booking.findMany({
      where,
      include: bookingInclude,
      orderBy: { checkInDateTime: 'desc' },
    });
    return bookings.map((booking) => mapBookingForRole(booking, role));
  }

  async getSummary(query: QueryBookingsDto, role: Role) {
    const where = this.buildWhere(query);
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    const propertyFilter = query.propertyId
      ? { unit: { propertyId: query.propertyId } }
      : {};

    const [
      todayCheckIns,
      todayCheckOuts,
      currentlyCheckedIn,
      upcomingBookings,
      outstandingAgg,
      roomsRequiringCleaning,
    ] = await Promise.all([
      this.prisma.booking.count({
        where: {
          ...propertyFilter,
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
          ...propertyFilter,
          checkOutDateTime: { gte: startOfDay, lte: endOfDay },
          bookingStatus: {
            in: [BookingStatus.CHECKED_IN, BookingStatus.CONFIRMED],
          },
        },
      }),
      this.prisma.booking.count({
        where: {
          ...propertyFilter,
          bookingStatus: BookingStatus.CHECKED_IN,
        },
      }),
      this.prisma.booking.count({
        where: {
          ...propertyFilter,
          bookingStatus: {
            in: [BookingStatus.PENDING, BookingStatus.CONFIRMED],
          },
          checkInDateTime: { gt: now },
        },
      }),
      this.prisma.booking.aggregate({
        where: {
          ...where,
          remainingAmount: { gt: 0 },
          bookingStatus: {
            notIn: [BookingStatus.CANCELLED, BookingStatus.NO_SHOW],
          },
        },
        _sum: { remainingAmount: true },
      }),
      this.prisma.unit.count({
        where: {
          isActive: true,
          status: UnitStatus.CLEANING_REQUIRED,
          ...(query.propertyId ? { propertyId: query.propertyId } : {}),
        },
      }),
    ]);

    return {
      todayCheckIns,
      todayCheckOuts,
      currentlyCheckedIn,
      upcomingBookings,
      unpaidOutstanding: serializeMoney(outstandingAgg._sum.remainingAmount),
      roomsRequiringCleaning,
      // role retained for future privacy tweaks
      role,
    };
  }

  async findOne(id: string, role: Role) {
    const booking = await this.getBookingOrThrow(id);
    return mapBookingForRole(booking, role);
  }

  async update(id: string, dto: UpdateBookingDto, role: Role) {
    this.assertCanMutateBookings(role);
    const existing = await this.getBookingOrThrow(id);

    if (
      existing.bookingStatus === BookingStatus.CHECKED_OUT ||
      existing.bookingStatus === BookingStatus.CANCELLED ||
      existing.bookingStatus === BookingStatus.NO_SHOW
    ) {
      throw new BadRequestException(
        'Cannot edit a completed, cancelled, or no-show booking',
      );
    }

    if (role === Role.ADMIN || role === Role.RECEPTIONIST) {
      const financialKeys: Array<keyof UpdateBookingDto> = [
        'hourlyRate',
        'dailyRate',
        'electricityCharges',
        'cleaningCharges',
        'laundryCharges',
        'maintenanceCharges',
        'otherCharges',
        'discountAmount',
        'receivedAmount',
      ];

      if (
        existing.bookingStatus === BookingStatus.CHECKED_IN &&
        financialKeys.some((key) => dto[key] !== undefined)
      ) {
        // Receptionist may still update receivedAmount during stay
        const onlyReceived =
          dto.receivedAmount !== undefined &&
          financialKeys
            .filter((key) => key !== 'receivedAmount')
            .every((key) => dto[key] === undefined);

        if (!(role === Role.RECEPTIONIST && onlyReceived)) {
          throw new ForbiddenException(
            'Historical/finalized financial edits require Super Admin or a future approval workflow',
          );
        }
      }
    }

    const checkIn = dto.checkInDateTime ?? existing.checkInDateTime.toISOString();
    const checkOut =
      dto.checkOutDateTime ?? existing.checkOutDateTime.toISOString();
    this.assertDateRange(checkIn, checkOut);

    const unitId = dto.unitId ?? existing.unitId;
    if (
      dto.unitId ||
      dto.checkInDateTime ||
      dto.checkOutDateTime
    ) {
      await this.assertNoOverlap(
        unitId,
        new Date(checkIn),
        new Date(checkOut),
        id,
      );
      await this.assertMonthlyTenancyAllowsHotelUse(unitId);
      if (dto.unitId) {
        await this.getAssignableUnit(dto.unitId);
      }
    }

    const unit = await this.prisma.unit.findUniqueOrThrow({
      where: { id: unitId },
    });

    const bookingType = dto.bookingType ?? existing.bookingType;
    const chargeInput = {
      bookingType,
      hourlyRate:
        dto.hourlyRate ??
        (existing.hourlyRate ? Number(existing.hourlyRate.toString()) : null),
      dailyRate:
        dto.dailyRate ??
        (existing.dailyRate ? Number(existing.dailyRate.toString()) : null),
      numberOfHours: dto.numberOfHours ?? existing.numberOfHours,
      numberOfDays: dto.numberOfDays ?? existing.numberOfDays,
      electricityCharges: Number(
        dto.electricityCharges ?? existing.electricityCharges.toString(),
      ),
      cleaningCharges: Number(
        dto.cleaningCharges ?? existing.cleaningCharges.toString(),
      ),
      laundryCharges: Number(
        dto.laundryCharges ?? existing.laundryCharges.toString(),
      ),
      maintenanceCharges: Number(
        dto.maintenanceCharges ?? existing.maintenanceCharges.toString(),
      ),
      otherCharges: Number(
        dto.otherCharges ?? existing.otherCharges.toString(),
      ),
      discountAmount: Number(
        dto.discountAmount ?? existing.discountAmount.toString(),
      ),
      receivedAmount: Number(
        dto.receivedAmount ?? existing.receivedAmount.toString(),
      ),
      checkInDateTime: checkIn,
      checkOutDateTime: checkOut,
    };

    if (bookingType === BookingType.HOURLY && !chargeInput.hourlyRate) {
      chargeInput.hourlyRate = unit.hourlyRate
        ? Number(unit.hourlyRate.toString())
        : null;
    }
    if (bookingType === BookingType.DAILY && !chargeInput.dailyRate) {
      chargeInput.dailyRate = unit.dailyRate
        ? Number(unit.dailyRate.toString())
        : null;
    }

    const allowAdvance =
      role === Role.SUPER_ADMIN && Boolean(dto.allowAdvance);
    const { paymentState, ...totals } = calculateBookingTotals(chargeInput, {
      allowAdvance,
    });

    assertDiscountAllowed(
      role,
      Number(totals.discountAmount.toString()),
      totals.roomCharges
        .plus(totals.electricityCharges)
        .plus(totals.cleaningCharges)
        .plus(totals.laundryCharges)
        .plus(totals.maintenanceCharges)
        .plus(totals.otherCharges),
    );

    const booking = await this.prisma.booking.update({
      where: { id },
      data: {
        unitId,
        bookingType,
        checkInDateTime: new Date(checkIn),
        checkOutDateTime: new Date(checkOut),
        ...totals,
        paymentState,
        numberOfGuests: dto.numberOfGuests ?? existing.numberOfGuests,
        adults: dto.adults ?? existing.adults,
        children: dto.children ?? existing.children,
        bookingSource: dto.bookingSource ?? existing.bookingSource,
        notes: dto.notes ?? existing.notes,
        otherChargesDescription:
          dto.otherChargesDescription !== undefined
            ? dto.otherChargesDescription.trim() || null
            : existing.otherChargesDescription,
      },
      include: bookingInclude,
    });

    return mapBookingForRole(booking, role);
  }

  async confirm(id: string, role: Role) {
    this.assertCanMutateBookings(role);
    const existing = await this.getBookingOrThrow(id);

    if (existing.bookingStatus !== BookingStatus.PENDING) {
      throw new BadRequestException('Only PENDING bookings can be confirmed');
    }

    await this.assertNoOverlap(
      existing.unitId,
      existing.checkInDateTime,
      existing.checkOutDateTime,
      id,
    );
    await this.assertMonthlyTenancyAllowsHotelUse(existing.unitId);

    const booking = await this.prisma.booking.update({
      where: { id },
      data: { bookingStatus: BookingStatus.CONFIRMED },
      include: bookingInclude,
    });

    return mapBookingForRole(booking, role);
  }

  async checkIn(id: string, role: Role) {
    this.assertCanMutateBookings(role);
    const existing = await this.getBookingOrThrow(id);

    if (existing.bookingStatus !== BookingStatus.CONFIRMED) {
      throw new BadRequestException('Only CONFIRMED bookings can be checked in');
    }

    if (!existing.guest.fullName?.trim() || !existing.guest.phone?.trim()) {
      throw new BadRequestException(
        'Guest full name and phone are required for check-in',
      );
    }

    if (!existing.guest.cnicOrPassport?.trim()) {
      throw new BadRequestException(
        'Guest CNIC/passport is required for check-in',
      );
    }

    const now = new Date();
    const earliest = new Date(existing.checkInDateTime);
    earliest.setHours(earliest.getHours() - 12);

    if (now < earliest) {
      throw new BadRequestException(
        'Check-in is only allowed from 12 hours before the scheduled check-in time',
      );
    }

    if (now > existing.checkOutDateTime) {
      throw new BadRequestException(
        'Cannot check in after the scheduled check-out time',
      );
    }

    await this.assertNoOverlap(
      existing.unitId,
      existing.checkInDateTime,
      existing.checkOutDateTime,
      id,
    );

    const checkedInOther = await this.prisma.booking.findFirst({
      where: {
        unitId: existing.unitId,
        bookingStatus: BookingStatus.CHECKED_IN,
        id: { not: id },
      },
    });

    if (checkedInOther) {
      throw new ConflictException(
        'Unit is already booked or occupied for the selected date and time.',
      );
    }

    const unit = await this.prisma.unit.findUnique({
      where: { id: existing.unitId },
    });

    if (
      !unit ||
      !unit.isActive ||
      unit.status === UnitStatus.MAINTENANCE ||
      unit.status === UnitStatus.BLOCKED
    ) {
      throw new BadRequestException('Unit is not available for check-in');
    }

    const booking = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.booking.update({
        where: { id },
        data: {
          bookingStatus: BookingStatus.CHECKED_IN,
          actualCheckInAt: now,
        },
        include: bookingInclude,
      });

      await tx.unit.update({
        where: { id: existing.unitId },
        data: { status: UnitStatus.OCCUPIED },
      });

      return updated;
    });

    return mapBookingForRole(booking, role);
  }

  async checkOut(
    id: string,
    dto: CheckoutBookingDto,
    role: Role,
    userId: string,
  ) {
    this.assertCanMutateBookings(role);
    const existing = await this.getBookingOrThrow(id);

    if (existing.bookingStatus !== BookingStatus.CHECKED_IN) {
      throw new BadRequestException(
        'Only CHECKED_IN bookings can be checked out',
      );
    }

    const now = dto.actualCheckOutAt
      ? new Date(dto.actualCheckOutAt)
      : new Date();
    if (Number.isNaN(now.getTime())) {
      throw new BadRequestException('Invalid check-out date/time');
    }
    const checkInMoment = existing.actualCheckInAt ?? existing.checkInDateTime;
    if (now <= checkInMoment) {
      throw new BadRequestException(CHECKOUT_AFTER_CHECKIN_MESSAGE);
    }

    const isHotelStay =
      existing.bookingType === BookingType.DAILY ||
      existing.bookingType === BookingType.HOURLY;

    const extraReceived =
      dto.receivedAmount === undefined
        ? 0
        : Number(dto.receivedAmount) -
          Number(existing.receivedAmount.toString());

    const quote = isHotelStay
      ? calculateCheckoutQuote({
          source: {
            bookingType: existing.bookingType,
            checkInDateTime: existing.checkInDateTime,
            checkOutDateTime: existing.checkOutDateTime,
            actualCheckInAt: existing.actualCheckInAt,
            hourlyRate: existing.hourlyRate,
            dailyRate: existing.dailyRate,
            numberOfHours: existing.numberOfHours,
            numberOfDays: existing.numberOfDays,
            roomCharges: existing.roomCharges,
            electricityCharges:
              dto.electricityCharges ?? existing.electricityCharges,
            cleaningCharges: dto.cleaningCharges ?? existing.cleaningCharges,
            laundryCharges: dto.laundryCharges ?? existing.laundryCharges,
            maintenanceCharges:
              dto.maintenanceCharges ?? existing.maintenanceCharges,
            otherCharges: dto.otherCharges ?? existing.otherCharges,
            discountAmount: dto.discountAmount ?? existing.discountAmount,
            totalAmount: existing.totalAmount,
            receivedAmount: existing.receivedAmount,
          },
          now,
          config: {
            policy: 'ACTUAL_STAY_ONLY',
            penaltyType: 'FLAT',
            penaltyValue: 0,
            minDailyNights: 1,
            minHourlyHours: 1,
          },
          extraReceived,
        })
      : null;

    const chargeInput = {
      bookingType: existing.bookingType,
      hourlyRate: existing.hourlyRate
        ? Number(existing.hourlyRate.toString())
        : null,
      dailyRate: existing.dailyRate
        ? Number(existing.dailyRate.toString())
        : null,
      numberOfHours: existing.numberOfHours,
      numberOfDays: existing.numberOfDays,
      electricityCharges: Number(
        dto.electricityCharges ?? existing.electricityCharges.toString(),
      ),
      cleaningCharges: Number(
        dto.cleaningCharges ?? existing.cleaningCharges.toString(),
      ),
      laundryCharges: Number(
        dto.laundryCharges ?? existing.laundryCharges.toString(),
      ),
      maintenanceCharges: Number(
        dto.maintenanceCharges ?? existing.maintenanceCharges.toString(),
      ),
      otherCharges: Number(
        dto.otherCharges ?? existing.otherCharges.toString(),
      ),
      discountAmount: Number(
        dto.discountAmount ?? existing.discountAmount.toString(),
      ),
      receivedAmount: Number(
        dto.receivedAmount ?? existing.receivedAmount.toString(),
      ),
      checkInDateTime: existing.checkInDateTime,
    };

    if (role !== Role.SUPER_ADMIN) {
      if (
        dto.discountAmount !== undefined &&
        Number(dto.discountAmount) !==
          Number(existing.discountAmount.toString())
      ) {
        const discountBase = quote
          ? quote.revisedRoomCharges
              .plus(quote.electricityCharges)
              .plus(quote.cleaningCharges)
              .plus(quote.laundryCharges)
              .plus(quote.maintenanceCharges)
              .plus(quote.otherCharges)
          : new Prisma.Decimal(chargeInput.electricityCharges)
              .plus(chargeInput.cleaningCharges)
              .plus(chargeInput.laundryCharges)
              .plus(chargeInput.maintenanceCharges)
              .plus(chargeInput.otherCharges)
              .plus(
                existing.bookingType === BookingType.HOURLY
                  ? Number(existing.hourlyRate ?? 0) *
                    (existing.numberOfHours ?? 0)
                  : Number(existing.dailyRate ?? 0) *
                    (existing.numberOfDays ?? 0),
              );
        assertDiscountAllowed(role, Number(dto.discountAmount), discountBase);
      }
    }

    const allowAdvance =
      role === Role.SUPER_ADMIN && Boolean(dto.allowAdvance);
    const monthlyTotals = quote
      ? null
      : calculateBookingTotals(chargeInput, { allowAdvance });
    const monthlyFinance = monthlyTotals
      ? (() => {
          const { paymentState, ...totals } = monthlyTotals;
          return { ...totals, paymentState };
        })()
      : {};

    const booking = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.booking.update({
        where: { id },
        data: quote
          ? {
              checkOutDateTime: now,
              actualCheckOutAt: now,
              numberOfDays: quote.numberOfDays,
              numberOfHours: quote.numberOfHours,
              roomCharges: quote.revisedRoomCharges,
              electricityCharges: quote.electricityCharges,
              cleaningCharges: quote.cleaningCharges,
              laundryCharges: quote.laundryCharges,
              maintenanceCharges: quote.maintenanceCharges,
              otherCharges: quote.otherCharges,
              discountAmount: quote.discountAmount,
              totalAmount: quote.revisedTotalAmount,
              receivedAmount: quote.paid,
              remainingAmount: quote.remaining,
              paymentState: quote.paymentState,
              checkoutFinance: quote.snapshot as Prisma.InputJsonValue,
              bookingStatus: BookingStatus.CHECKED_OUT,
              cleaningCleared: false,
              accountsCleared: false,
              checkedOutByUserId: userId,
              notes: dto.notes ?? existing.notes,
            }
          : {
              ...monthlyFinance,
              checkOutDateTime: now,
              actualCheckOutAt: now,
              bookingStatus: BookingStatus.CHECKED_OUT,
              cleaningCleared: false,
              accountsCleared: false,
              checkedOutByUserId: userId,
              notes: dto.notes ?? existing.notes,
            },
        include: bookingInclude,
      });

      await tx.unit.update({
        where: { id: existing.unitId },
        data: { status: UnitStatus.CLEANING_REQUIRED },
      });

      return updated;
    });

    return mapBookingForRole(booking, role);
  }

  async cancel(id: string, role: Role) {
    this.assertCanMutateBookings(role);

    const existing = await this.getBookingOrThrow(id);

    if (
      existing.bookingStatus !== BookingStatus.PENDING &&
      existing.bookingStatus !== BookingStatus.CONFIRMED
    ) {
      throw new BadRequestException(
        'Only PENDING or CONFIRMED bookings can be cancelled',
      );
    }

    const booking = await this.prisma.booking.update({
      where: { id },
      data: {
        bookingStatus: BookingStatus.CANCELLED,
        cancelledAt: new Date(),
        paymentHoldExpiresAt: null,
      },
      include: bookingInclude,
    });

    return mapBookingForRole(booking, role);
  }

  async markNoShow(id: string, role: Role) {
    this.assertCanMutateBookings(role);

    const existing = await this.getBookingOrThrow(id);

    if (
      existing.bookingStatus !== BookingStatus.CONFIRMED &&
      existing.bookingStatus !== BookingStatus.PENDING
    ) {
      throw new BadRequestException(
        'Only PENDING or CONFIRMED bookings can be marked as no-show',
      );
    }

    const booking = await this.prisma.booking.update({
      where: { id },
      data: {
        bookingStatus: BookingStatus.NO_SHOW,
        paymentHoldExpiresAt: null,
      },
      include: bookingInclude,
    });

    return mapBookingForRole(booking, role);
  }

  async markCleaningCleared(id: string, role: Role) {
    this.assertCanMutateBookings(role);
    return this.updateClearance(id, { cleaningCleared: true }, role);
  }

  async markAccountsCleared(id: string, role: Role) {
    this.assertCanMutateBookings(role);
    return this.updateClearance(id, { accountsCleared: true }, role);
  }

  async listEligibleUnits(propertyId?: string, bookingType?: BookingType) {
    return this.prisma.unit.findMany({
      where: {
        isActive: true,
        property: { isActive: true },
        ...(propertyId ? { propertyId } : {}),
        status: {
          notIn: [UnitStatus.MAINTENANCE, UnitStatus.BLOCKED],
        },
        // Occupied units with CHECKED_IN are excluded via overlap at create-time;
        // still hide currently occupied for UX.
        NOT: { status: UnitStatus.OCCUPIED },
        OR: [
          {
            tenancies: {
              none: { tenancyStatus: MonthlyTenancyStatus.ACTIVE },
            },
          },
          {
            tenancies: {
              some: {
                tenancyStatus: MonthlyTenancyStatus.ACTIVE,
                occupancyState: MonthlyOccupancyState.EMPTY,
              },
            },
          },
        ],
      },
      orderBy: [{ property: { name: 'asc' } }, { unitNumber: 'asc' }],
      select: {
        id: true,
        unitNumber: true,
        unitType: true,
        status: true,
        dailyRate: true,
        hourlyRate: true,
        propertyId: true,
        property: { select: { id: true, name: true } },
      },
    });
  }

  private async updateClearance(
    id: string,
    flags: { cleaningCleared?: boolean; accountsCleared?: boolean },
    role: Role,
  ) {
    const existing = await this.getBookingOrThrow(id);

    if (existing.bookingStatus !== BookingStatus.CHECKED_OUT) {
      throw new BadRequestException(
        'Clearance flags apply only to CHECKED_OUT bookings',
      );
    }

    const cleaningCleared = flags.cleaningCleared ?? existing.cleaningCleared;
    const accountsCleared = flags.accountsCleared ?? existing.accountsCleared;

    const booking = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.booking.update({
        where: { id },
        data: { cleaningCleared, accountsCleared },
        include: bookingInclude,
      });

      if (cleaningCleared && accountsCleared) {
        await tx.unit.update({
          where: { id: existing.unitId },
          data: { status: UnitStatus.AVAILABLE },
        });
      } else {
        await tx.unit.update({
          where: { id: existing.unitId },
          data: { status: UnitStatus.CLEANING_REQUIRED },
        });
      }

      return updated;
    });

    return mapBookingForRole(booking, role);
  }

  private async resolveGuestId(dto: CreateBookingDto, role: Role) {
    if (dto.guestId) {
      return dto.guestId;
    }

    if (dto.guest) {
      const created = await this.guestsService.create(dto.guest, role);
      return created.id;
    }

    throw new BadRequestException('guestId or guest payload is required');
  }

  private resolveRates(
    dto: CreateBookingDto,
    unit: {
      hourlyRate: Prisma.Decimal | null;
      dailyRate: Prisma.Decimal | null;
    },
  ) {
    return {
      hourlyRate:
        dto.hourlyRate ??
        (unit.hourlyRate ? Number(unit.hourlyRate.toString()) : null),
      dailyRate:
        dto.dailyRate ??
        (unit.dailyRate ? Number(unit.dailyRate.toString()) : null),
      numberOfHours: dto.numberOfHours,
      numberOfDays: dto.numberOfDays,
    };
  }

  private buildTotals(
    dto: CreateBookingDto,
    rates: {
      hourlyRate: number | null;
      dailyRate: number | null;
      numberOfHours?: number;
      numberOfDays?: number;
    },
    role: Role,
  ) {
    const chargeInput = {
      bookingType: dto.bookingType,
      hourlyRate: rates.hourlyRate,
      dailyRate: rates.dailyRate,
      numberOfHours: rates.numberOfHours,
      numberOfDays: rates.numberOfDays,
      electricityCharges: dto.electricityCharges,
      cleaningCharges: dto.cleaningCharges,
      laundryCharges: dto.laundryCharges,
      maintenanceCharges: dto.maintenanceCharges,
      otherCharges: dto.otherCharges,
      discountAmount: dto.discountAmount,
      receivedAmount: dto.receivedAmount,
      checkInDateTime: dto.checkInDateTime,
      checkOutDateTime: dto.checkOutDateTime,
    };

    const allowAdvance =
      role === Role.SUPER_ADMIN && Boolean(dto.allowAdvance);
    const { paymentState, ...totals } = calculateBookingTotals(chargeInput, {
      allowAdvance,
    });

    const gross = totals.roomCharges
      .plus(totals.electricityCharges)
      .plus(totals.cleaningCharges)
      .plus(totals.laundryCharges)
      .plus(totals.maintenanceCharges)
      .plus(totals.otherCharges);

    assertDiscountAllowed(
      role,
      Number(totals.discountAmount.toString()),
      gross,
    );

    return { ...totals, paymentState };
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

  private async getAssignableUnit(unitId: string) {
    const unit = await this.prisma.unit.findUnique({
      where: { id: unitId },
      include: { property: true },
    });

    if (!unit || !unit.isActive || !unit.property.isActive) {
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

  private async getBookingOrThrow(id: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: bookingInclude,
    });

    if (!booking) {
      throw new NotFoundException(`Booking with id "${id}" not found`);
    }

    return booking;
  }

  private assertCanMutateBookings(role: Role) {
    if (
      role !== Role.SUPER_ADMIN &&
      role !== Role.ADMIN &&
      role !== Role.RECEPTIONIST
    ) {
      throw new ForbiddenException('Insufficient permissions');
    }
  }

  private buildWhere(query: QueryBookingsDto): Prisma.BookingWhereInput {
    const where: Prisma.BookingWhereInput = {};

    if (query.unitId) where.unitId = query.unitId;
    if (query.guestId) where.guestId = query.guestId;
    if (query.bookingType) where.bookingType = query.bookingType;
    if (query.bookingStatus) where.bookingStatus = query.bookingStatus;
    if (query.paymentState) where.paymentState = query.paymentState;

    if (query.propertyId) {
      where.unit = { propertyId: query.propertyId };
    }

    if (query.today === 'true' || query.today === '1') {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      where.OR = [
        { checkInDateTime: { gte: start, lte: end } },
        { checkOutDateTime: { gte: start, lte: end } },
      ];
    } else if (query.startDate || query.endDate) {
      where.checkInDateTime = {};
      if (query.startDate) {
        where.checkInDateTime.gte = new Date(
          `${query.startDate}T00:00:00.000Z`,
        );
      }
      if (query.endDate) {
        where.checkInDateTime.lte = new Date(
          `${query.endDate}T23:59:59.999Z`,
        );
      }
    } else if (query.checkInDate || query.checkOutDate) {
      if (query.checkInDate) {
        where.checkInDateTime = {
          gte: new Date(`${query.checkInDate}T00:00:00.000Z`),
          lte: new Date(`${query.checkInDate}T23:59:59.999Z`),
        };
      }
      if (query.checkOutDate) {
        where.checkOutDateTime = {
          gte: new Date(`${query.checkOutDate}T00:00:00.000Z`),
          lte: new Date(`${query.checkOutDate}T23:59:59.999Z`),
        };
      }
    } else if (query.year !== undefined && query.month !== undefined) {
      const start = new Date(Date.UTC(query.year, query.month - 1, 1));
      const end = new Date(
        Date.UTC(query.year, query.month, 0, 23, 59, 59, 999),
      );
      where.checkInDateTime = { gte: start, lte: end };
    } else if (query.year !== undefined) {
      where.checkInDateTime = {
        gte: new Date(Date.UTC(query.year, 0, 1)),
        lte: new Date(Date.UTC(query.year, 11, 31, 23, 59, 59, 999)),
      };
    } else if (query.month !== undefined) {
      throw new BadRequestException('year is required when month is provided');
    }

    if (query.search?.trim()) {
      const term = query.search.trim();
      const searchOr: Prisma.BookingWhereInput[] = [
        { bookingNumber: { contains: term, mode: 'insensitive' } },
        { guest: { fullName: { contains: term, mode: 'insensitive' } } },
        { guest: { phone: { contains: term, mode: 'insensitive' } } },
        {
          guest: { cnicOrPassport: { contains: term, mode: 'insensitive' } },
        },
        { unit: { unitNumber: { contains: term, mode: 'insensitive' } } },
      ];

      if (where.OR) {
        where.AND = [{ OR: where.OR }, { OR: searchOr }];
        delete where.OR;
      } else {
        where.OR = searchOr;
      }
    }

    return where;
  }
}
