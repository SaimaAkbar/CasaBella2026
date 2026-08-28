import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import {
  ApprovalActionType,
  ApprovalModuleName,
  ApprovalPriority,
  NotificationType,
  PaymentMethod,
  Prisma,
  Role,
  Status,
} from '../../generated/prisma/client';
import { ApprovalApplicatorService } from '../approvals/approval-applicator.service';
import { ApprovalsService } from '../approvals/approvals.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import type { AuthUser } from '../common/types/auth-user.type';
import {
  deriveExpensePaymentStatus,
  shiftBillingMonth,
} from '../expenses/expense.finance';
import { ExpensesService } from '../expenses/expenses.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { CreateElectricityReadingDto } from './dto/create-electricity-reading.dto';
import {
  CorrectElectricityReadingDto,
  EnterCurrentReadingDto,
  GenerateElectricityMonthDto,
  InitializeElectricityBillDto,
  RecordElectricityPaymentDto,
} from './dto/electricity-bill.dto';
import { QueryElectricityReadingsDto } from './dto/query-electricity-readings.dto';
import { UpdateElectricityRateDto } from './dto/update-electricity-rate.dto';
import {
  computeBaseBill,
  computeFinalBill,
  computeOneTimeLateFine,
  computeUnitsConsumed,
  DEFAULT_LATE_FINE_PERCENTAGE,
} from './electricity-bill.finance';
import { mapElectricityReading } from './electricity-readings.mapper';

const DEFAULT_RATE = '95';
const RATE_SETTING_KEY = 'electricity.ratePerUnit';

const readingInclude = {
  property: { select: { id: true, name: true } },
  unit: { select: { id: true, unitNumber: true, propertyId: true } },
  expense: {
    select: {
      id: true,
      expenseNumber: true,
      amount: true,
      paidAmount: true,
      remainingAmount: true,
      paymentStatus: true,
      paymentMethod: true,
      paymentDate: true,
      bankName: true,
      isFinalized: true,
      dueDate: true,
      payments: {
        where: { isReversed: false },
        orderBy: { paymentDate: 'asc' as const },
        select: {
          id: true,
          amount: true,
          paymentDate: true,
          paymentMethod: true,
          bankName: true,
          transactionReference: true,
          notes: true,
          createdBy: { select: { id: true, fullName: true } },
        },
      },
    },
  },
  createdBy: { select: { id: true, fullName: true } },
} satisfies Prisma.ElectricityReadingInclude;

type ReadingRow = Prisma.ElectricityReadingGetPayload<{
  include: typeof readingInclude;
}>;

@Injectable()
export class ElectricityReadingsService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly expensesService: ExpensesService,
    private readonly settingsService: SettingsService,
    private readonly auditLogs: AuditLogsService,
    private readonly approvalsService: ApprovalsService,
    private readonly approvalApplicator: ApprovalApplicatorService,
    private readonly notifications: NotificationsService,
  ) {}

  onModuleInit() {
    this.approvalApplicator.register(
      ApprovalModuleName.ELECTRICITY,
      async (request, actorId) => {
        if (request.actionType !== ApprovalActionType.UPDATE) {
          throw new BadRequestException(
            `Unsupported electricity approval action: ${request.actionType}`,
          );
        }
        const payload =
          request.newData && typeof request.newData === 'object'
            ? (request.newData as { ratePerUnit?: number; reason?: string })
            : {};
        if (payload.ratePerUnit == null) {
          throw new BadRequestException('ratePerUnit is required');
        }
        const actor: AuthUser = {
          id: actorId,
          fullName: 'System Approval',
          email: 'approval@system',
          phone: '',
          role: Role.SUPER_ADMIN,
          status: Status.ACTIVE,
          canAccessSalary: true,
          canAccessProfitLoss: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        return this.applyRateChange(
          payload.ratePerUnit,
          actor,
          payload.reason ?? 'Approved electricity rate change',
        );
      },
    );
  }

  async getDefaultRate() {
    const rate = await this.settingsService.getNumber(RATE_SETTING_KEY, 95);
    return {
      ratePerUnit: Number.isFinite(rate) ? rate.toFixed(2) : DEFAULT_RATE,
    };
  }

  async getRateHistory() {
    const rows = await this.prisma.electricityRateHistory.findMany({
      orderBy: { effectiveFrom: 'desc' },
      include: {
        changedBy: { select: { id: true, fullName: true } },
      },
    });
    return rows.map((row) => ({
      id: row.id,
      ratePerUnit: row.ratePerUnit.toString(),
      effectiveFrom: row.effectiveFrom,
      effectiveTo: row.effectiveTo,
      reason: row.reason,
      changedByUserId: row.changedByUserId,
      changedBy: row.changedBy,
      createdAt: row.createdAt,
    }));
  }

  async updateDefaultRate(
    dto: UpdateElectricityRateDto & { reason?: string },
    user: AuthUser,
  ) {
    if (user.role === Role.ADMIN) {
      return this.approvalsService.submit({
        moduleName: ApprovalModuleName.ELECTRICITY,
        recordId: RATE_SETTING_KEY,
        actionType: ApprovalActionType.UPDATE,
        actor: user,
        oldData: await this.getDefaultRate(),
        newData: { ratePerUnit: dto.ratePerUnit, reason: dto.reason },
        reason: dto.reason ?? 'Admin requested electricity rate change',
        priority: ApprovalPriority.HIGH,
      });
    }

    if (user.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException(
        'Only Super Admin can configure the electricity rate',
      );
    }

    return this.applyRateChange(dto.ratePerUnit, user, dto.reason);
  }

  async applyRateChange(ratePerUnit: number, user: AuthUser, reason?: string) {
    const value = new Prisma.Decimal(ratePerUnit).toFixed(2);
    const previous = await this.getDefaultRate();

    await this.prisma.$transaction(async (tx) => {
      const open = await tx.electricityRateHistory.findFirst({
        where: { effectiveTo: null },
        orderBy: { effectiveFrom: 'desc' },
      });
      if (open) {
        await tx.electricityRateHistory.update({
          where: { id: open.id },
          data: { effectiveTo: new Date() },
        });
      }
      await tx.electricityRateHistory.create({
        data: {
          ratePerUnit: new Prisma.Decimal(value),
          effectiveFrom: new Date(),
          reason: reason?.trim() || 'Electricity rate updated',
          changedByUserId: user.id,
        },
      });
    });

    await this.settingsService.updateOne(
      RATE_SETTING_KEY,
      Number(value),
      user,
      { reason: reason ?? 'Electricity rate updated from electricity module' },
    );

    await this.auditLogs.write({
      module: ApprovalModuleName.ELECTRICITY,
      action: 'RATE_CHANGED',
      recordId: RATE_SETTING_KEY,
      userId: user.id,
      role: user.role,
      oldData: previous,
      newData: { ratePerUnit: value, reason: reason ?? null },
    });

    await this.notifications.notifySuperAdmins({
      type: NotificationType.WARNING,
      title: 'Electricity rate changed',
      message: `Rate updated from Rs. ${previous.ratePerUnit} to Rs. ${value}`,
      relatedModule: 'ELECTRICITY',
      relatedId: RATE_SETTING_KEY,
      actionUrl: '/expenses',
    });

    return { ratePerUnit: value };
  }

  /** Legacy create — maps to initialize / current entry flow. */
  async create(dto: CreateElectricityReadingDto, role: Role, userId: string) {
    return this.initialize(
      {
        propertyId: dto.propertyId,
        unitId: dto.unitId ?? (() => {
          throw new BadRequestException('unitId is required');
        })(),
        previousReading: dto.previousUnits,
        currentReading: dto.currentUnits,
        ratePerUnit: dto.ratePerUnit,
        billingMonth: dto.billingMonth,
        billingYear: dto.billingYear,
        readingDate: dto.readingDate,
        notes: dto.notes,
      },
      { id: userId, role } as AuthUser,
      dto.overrideReason,
    );
  }

  async initialize(
    dto: InitializeElectricityBillDto,
    user: AuthUser,
    overrideReason?: string,
  ) {
    this.assertCanManageReadings(user.role);

    const previousUnits = new Prisma.Decimal(dto.previousReading);
    const currentUnits = new Prisma.Decimal(dto.currentReading);
    if (currentUnits.lessThan(previousUnits)) {
      throw new BadRequestException(
        'Current reading cannot be lower than previous reading',
      );
    }

    const unit = await this.requireUnit(dto.unitId, dto.propertyId);
    const ratePerUnit = await this.resolveRate(dto.ratePerUnit);
    const consumedUnits = computeUnitsConsumed(previousUnits, currentUnits);
    const baseBill = computeBaseBill(consumedUnits, ratePerUnit);
    const dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    const readingDate = dto.readingDate
      ? new Date(dto.readingDate)
      : new Date();

    const existing = await this.prisma.electricityReading.findUnique({
      where: {
        unitId_billingMonth_billingYear: {
          unitId: dto.unitId,
          billingMonth: dto.billingMonth,
          billingYear: dto.billingYear,
        },
      },
      include: readingInclude,
    });

    if (existing) {
      if (user.role !== Role.SUPER_ADMIN) {
        throw new ConflictException(
          'An electricity bill already exists for this unit, billing month and year',
        );
      }
      if (!overrideReason?.trim()) {
        throw new BadRequestException(
          'overrideReason is required to replace an existing electricity reading',
        );
      }
      return this.correctReading(
        existing.id,
        {
          previousReading: dto.previousReading,
          currentReading: dto.currentReading,
          ratePerUnit: Number(ratePerUnit.toString()),
          reason: overrideReason,
          dueDate: dto.dueDate,
        },
        user,
      );
    }

    const fine = computeOneTimeLateFine({
      baseBill,
      dueDate,
      remainingBeforeFine: baseBill,
      lateFineApplied: false,
    });
    const lateFineAmount = fine.shouldApply
      ? fine.lateFineAmount
      : new Prisma.Decimal(0);
    const finalBill = computeFinalBill(baseBill, lateFineAmount);

    try {
      const reading = await this.prisma.$transaction(async (tx) => {
        const expense = await this.expensesService.createLinkedElectricityExpense(
          tx,
          {
            amount: finalBill,
            propertyId: unit.propertyId,
            unitId: unit.id,
            expenseDate: readingDate,
            userId: user.id,
            description: `Electricity ${dto.billingMonth}/${dto.billingYear} — ${unit.unitNumber}`,
            billingMonth: dto.billingMonth,
            billingYear: dto.billingYear,
            dueDate,
            metadata: {
              billingMonth: dto.billingMonth,
              billingYear: dto.billingYear,
              previousUnits: previousUnits.toString(),
              currentUnits: currentUnits.toString(),
              consumedUnits: consumedUnits.toString(),
              ratePerUnit: ratePerUnit.toString(),
              baseBill: baseBill.toString(),
              lateFineAmount: lateFineAmount.toString(),
              finalBill: finalBill.toString(),
            },
          },
        );

        return tx.electricityReading.create({
          data: {
            propertyId: unit.propertyId,
            unitId: unit.id,
            previousUnits,
            currentUnits,
            consumedUnits,
            ratePerUnit,
            calculatedAmount: baseBill,
            dueDate: dueDate ?? undefined,
            lateFinePercentage: DEFAULT_LATE_FINE_PERCENTAGE,
            lateFineAmount,
            lateFineApplied: fine.shouldApply,
            readingDate,
            billingMonth: dto.billingMonth,
            billingYear: dto.billingYear,
            notes: dto.notes?.trim(),
            expenseId: expense.id,
            createdByUserId: user.id,
          },
          include: readingInclude,
        });
      });

      await this.auditLogs.write({
        module: ApprovalModuleName.ELECTRICITY,
        action: 'ELECTRICITY_INITIALIZED',
        recordId: reading.id,
        userId: user.id,
        role: user.role,
        newData: mapElectricityReading(reading),
      });

      if (fine.shouldApply) {
        await this.notifyFineApplied(reading);
      }

      return mapElectricityReading(await this.applyPendingFine(reading));
    } catch (error) {
      this.handleUnique(error);
    }
  }

  async generateMonth(dto: GenerateElectricityMonthDto, user: AuthUser) {
    this.assertCanManageReadings(user.role);

    const property = await this.prisma.property.findUnique({
      where: { id: dto.propertyId },
      include: { units: { where: { isActive: true } } },
    });
    if (!property || !property.isActive) {
      throw new NotFoundException('Property not found');
    }

    const ratePerUnit = await this.resolveRate(dto.ratePerUnit);
    const prev = shiftBillingMonth(dto.billingMonth, dto.billingYear, -1);
    const dueDate = dto.dueDate ? new Date(dto.dueDate) : undefined;
    const created: ReturnType<typeof mapElectricityReading>[] = [];
    const skipped: Array<{ unitId: string; unitNumber: string; reason: string }> =
      [];

    for (const unit of property.units) {
      const existing = await this.prisma.electricityReading.findUnique({
        where: {
          unitId_billingMonth_billingYear: {
            unitId: unit.id,
            billingMonth: dto.billingMonth,
            billingYear: dto.billingYear,
          },
        },
      });
      if (existing) {
        skipped.push({
          unitId: unit.id,
          unitNumber: unit.unitNumber,
          reason: 'Already exists',
        });
        continue;
      }

      const previousBill = await this.prisma.electricityReading.findUnique({
        where: {
          unitId_billingMonth_billingYear: {
            unitId: unit.id,
            billingMonth: prev.month,
            billingYear: prev.year,
          },
        },
      });

      if (!previousBill || previousBill.currentUnits == null) {
        skipped.push({
          unitId: unit.id,
          unitNumber: unit.unitNumber,
          reason:
            'No previous month current reading — initialize first month as Super Admin',
        });
        continue;
      }

      const reading = await this.prisma.electricityReading.create({
        data: {
          propertyId: property.id,
          unitId: unit.id,
          previousUnits: previousBill.currentUnits,
          currentUnits: null,
          consumedUnits: null,
          ratePerUnit,
          calculatedAmount: new Prisma.Decimal(0),
          dueDate,
          lateFinePercentage: DEFAULT_LATE_FINE_PERCENTAGE,
          lateFineAmount: new Prisma.Decimal(0),
          lateFineApplied: false,
          readingDate: new Date(
            Date.UTC(dto.billingYear, dto.billingMonth - 1, 1),
          ),
          billingMonth: dto.billingMonth,
          billingYear: dto.billingYear,
          createdByUserId: user.id,
        },
        include: readingInclude,
      });

      created.push(mapElectricityReading(reading));
    }

    await this.auditLogs.write({
      module: ApprovalModuleName.ELECTRICITY,
      action: 'GENERATE_MONTH',
      recordId: dto.propertyId,
      userId: user.id,
      role: user.role,
      newData: {
        billingMonth: dto.billingMonth,
        billingYear: dto.billingYear,
        createdCount: created.length,
        skippedCount: skipped.length,
      },
    });

    return { created, skipped };
  }

  async enterCurrentReading(
    id: string,
    dto: EnterCurrentReadingDto,
    user: AuthUser,
  ) {
    this.assertCanManageReadings(user.role);
    let reading = await this.getReadingOrThrow(id);

    if (reading.expense?.isFinalized && user.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException(
        'Finalized electricity bills cannot be edited by Admin',
      );
    }

    const previousUnits = reading.previousUnits;
    const currentUnits = new Prisma.Decimal(dto.currentReading);
    if (currentUnits.lessThan(previousUnits)) {
      throw new BadRequestException(
        'Current reading cannot be lower than previous reading',
      );
    }

    const consumedUnits = computeUnitsConsumed(previousUnits, currentUnits);
    const baseBill = computeBaseBill(consumedUnits, reading.ratePerUnit);
    const dueDate = dto.dueDate
      ? new Date(dto.dueDate)
      : reading.dueDate ?? null;
    const readingDate = dto.readingDate
      ? new Date(dto.readingDate)
      : new Date();

    const paidAmount = reading.expense?.paidAmount ?? new Prisma.Decimal(0);
    const fine = computeOneTimeLateFine({
      baseBill,
      dueDate,
      remainingBeforeFine: baseBill.minus(paidAmount),
      lateFineApplied: reading.lateFineApplied,
      lateFinePercentage: reading.lateFinePercentage,
    });
    const lateFineAmount = reading.lateFineApplied
      ? reading.lateFineAmount
      : fine.shouldApply
        ? fine.lateFineAmount
        : new Prisma.Decimal(0);
    const lateFineApplied = reading.lateFineApplied || fine.shouldApply;
    const finalBill = computeFinalBill(baseBill, lateFineAmount);
    const safePaid = paidAmount.greaterThan(finalBill) ? finalBill : paidAmount;
    const remainingAmount = finalBill.minus(safePaid);
    const paymentStatus = deriveExpensePaymentStatus(
      finalBill,
      safePaid,
      dueDate,
    );

    reading = await this.prisma.$transaction(async (tx) => {
      let expenseId = reading.expenseId;
      if (expenseId) {
        await tx.expense.update({
          where: { id: expenseId },
          data: {
            amount: finalBill,
            paidAmount: safePaid,
            remainingAmount,
            paymentStatus,
            expenseDate: readingDate,
            dueDate: dueDate ?? undefined,
            billingMonth: reading.billingMonth,
            billingYear: reading.billingYear,
            description: `Electricity ${reading.billingMonth}/${reading.billingYear} — ${reading.unit?.unitNumber ?? ''}`,
            metadata: {
              billingMonth: reading.billingMonth,
              billingYear: reading.billingYear,
              previousUnits: previousUnits.toString(),
              currentUnits: currentUnits.toString(),
              consumedUnits: consumedUnits.toString(),
              ratePerUnit: reading.ratePerUnit.toString(),
              baseBill: baseBill.toString(),
              lateFineAmount: lateFineAmount.toString(),
              finalBill: finalBill.toString(),
            },
          },
        });
      } else {
        const expense =
          await this.expensesService.createLinkedElectricityExpense(tx, {
            amount: finalBill,
            propertyId: reading.propertyId,
            unitId: reading.unitId,
            expenseDate: readingDate,
            userId: user.id,
            description: `Electricity ${reading.billingMonth}/${reading.billingYear} — ${reading.unit?.unitNumber ?? ''}`,
            billingMonth: reading.billingMonth,
            billingYear: reading.billingYear,
            dueDate,
            metadata: {
              billingMonth: reading.billingMonth,
              billingYear: reading.billingYear,
              previousUnits: previousUnits.toString(),
              currentUnits: currentUnits.toString(),
              consumedUnits: consumedUnits.toString(),
              ratePerUnit: reading.ratePerUnit.toString(),
              baseBill: baseBill.toString(),
              lateFineAmount: lateFineAmount.toString(),
              finalBill: finalBill.toString(),
            },
          });
        expenseId = expense.id;
      }

      return tx.electricityReading.update({
        where: { id },
        data: {
          currentUnits,
          consumedUnits,
          calculatedAmount: baseBill,
          dueDate: dueDate ?? undefined,
          lateFineAmount,
          lateFineApplied,
          readingDate,
          notes: dto.notes?.trim() ?? reading.notes,
          expenseId: expenseId ?? undefined,
        },
        include: readingInclude,
      });
    });

    await this.auditLogs.write({
      module: ApprovalModuleName.ELECTRICITY,
      action: 'CURRENT_READING_ENTERED',
      recordId: id,
      userId: user.id,
      role: user.role,
      newData: {
        currentReading: currentUnits.toString(),
        unitsConsumed: consumedUnits.toString(),
        baseBill: baseBill.toString(),
        lateFineAmount: lateFineAmount.toString(),
        finalBill: finalBill.toString(),
      },
    });

    if (fine.shouldApply) {
      await this.notifyFineApplied(reading);
    }

    return mapElectricityReading(reading);
  }

  async correctReading(
    id: string,
    dto: CorrectElectricityReadingDto,
    user: AuthUser,
  ) {
    if (user.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException(
        'Only Super Admin can correct electricity readings',
      );
    }
    if (!dto.reason?.trim()) {
      throw new BadRequestException('Correction reason is required');
    }

    const existing = await this.getReadingOrThrow(id);
    const previousUnits = new Prisma.Decimal(
      dto.previousReading ?? Number(existing.previousUnits.toString()),
    );
    const currentUnits =
      dto.currentReading !== undefined
        ? new Prisma.Decimal(dto.currentReading)
        : existing.currentUnits;
    const ratePerUnit =
      dto.ratePerUnit !== undefined
        ? new Prisma.Decimal(dto.ratePerUnit)
        : existing.ratePerUnit;

    if (currentUnits != null && currentUnits.lessThan(previousUnits)) {
      throw new BadRequestException(
        'Current reading cannot be lower than previous reading',
      );
    }

    const oldSnapshot = mapElectricityReading(existing);
    let consumedUnits: Prisma.Decimal | null = null;
    let baseBill = new Prisma.Decimal(0);
    let lateFineAmount = existing.lateFineAmount;
    let lateFineApplied = existing.lateFineApplied;
    let finalBill = existing.expense?.amount ?? existing.calculatedAmount;
    const dueDate = dto.dueDate ? new Date(dto.dueDate) : existing.dueDate;

    if (currentUnits != null) {
      consumedUnits = computeUnitsConsumed(previousUnits, currentUnits);
      baseBill = computeBaseBill(consumedUnits, ratePerUnit);
      // Preserve one-time fine if already applied; recompute amount from new base only if not applied yet
      if (lateFineApplied) {
        lateFineAmount = baseBill
          .mul(existing.lateFinePercentage)
          .div(100)
          .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
      } else {
        const fine = computeOneTimeLateFine({
          baseBill,
          dueDate,
          remainingBeforeFine: baseBill,
          lateFineApplied: false,
          lateFinePercentage: existing.lateFinePercentage,
        });
        lateFineAmount = fine.shouldApply
          ? fine.lateFineAmount
          : new Prisma.Decimal(0);
        lateFineApplied = fine.shouldApply;
      }
      finalBill = computeFinalBill(baseBill, lateFineAmount);
    }

    const reading = await this.prisma.$transaction(async (tx) => {
      if (existing.expenseId && currentUnits != null) {
        const linked = await tx.expense.findUnique({
          where: { id: existing.expenseId },
          select: { paidAmount: true },
        });
        const paidAmount = linked?.paidAmount ?? new Prisma.Decimal(0);
        const safePaid = paidAmount.greaterThan(finalBill)
          ? finalBill
          : paidAmount;
        await tx.expense.update({
          where: { id: existing.expenseId },
          data: {
            amount: finalBill,
            paidAmount: safePaid,
            remainingAmount: finalBill.minus(safePaid),
            paymentStatus: deriveExpensePaymentStatus(
              finalBill,
              safePaid,
              dueDate,
            ),
            dueDate: dueDate ?? undefined,
            billingMonth: existing.billingMonth,
            billingYear: existing.billingYear,
            metadata: {
              billingMonth: existing.billingMonth,
              billingYear: existing.billingYear,
              previousUnits: previousUnits.toString(),
              currentUnits: currentUnits.toString(),
              consumedUnits: consumedUnits?.toString() ?? null,
              ratePerUnit: ratePerUnit.toString(),
              baseBill: baseBill.toString(),
              lateFineAmount: lateFineAmount.toString(),
              finalBill: finalBill.toString(),
              corrected: true,
              correctionReason: dto.reason.trim(),
            },
          },
        });
      }

      return tx.electricityReading.update({
        where: { id },
        data: {
          previousUnits,
          currentUnits: currentUnits ?? undefined,
          consumedUnits: consumedUnits ?? undefined,
          ratePerUnit,
          calculatedAmount: baseBill,
          dueDate: dueDate ?? undefined,
          lateFineAmount,
          lateFineApplied,
          notes: [
            existing.notes?.trim() ?? '',
            `CORRECTION:${dto.reason.trim()}`,
          ]
            .filter(Boolean)
            .join('\n'),
        },
        include: readingInclude,
      });
    });

    await this.auditLogs.write({
      module: ApprovalModuleName.ELECTRICITY,
      action: 'CURRENT_READING_CORRECTED',
      recordId: id,
      userId: user.id,
      role: user.role,
      oldData: oldSnapshot,
      newData: {
        ...mapElectricityReading(reading),
        reason: dto.reason.trim(),
      },
    });

    return mapElectricityReading(reading);
  }

  async recordPayment(
    id: string,
    dto: RecordElectricityPaymentDto,
    user: AuthUser,
  ) {
    this.assertCanManageReadings(user.role);
    const reading = await this.getReadingOrThrow(id);
    if (!reading.expenseId || !reading.expense) {
      throw new BadRequestException(
        'Enter current reading before recording payment',
      );
    }

    const method = this.parsePaymentMethod(dto.paymentMethod);
    return this.expensesService.recordPayment(
      reading.expenseId,
      {
        amountPaid: dto.amountPaid,
        paymentDate: dto.paymentDate,
        paymentMethod: method,
        bankName: dto.bankName,
        transactionReference: dto.transactionReference,
        notes: dto.notes,
      },
      user,
    ).then(async () => {
      const refreshed = await this.getReadingOrThrow(id);
      return mapElectricityReading(await this.applyPendingFine(refreshed));
    });
  }

  async findAll(query: QueryElectricityReadingsDto, role: Role) {
    if (role === Role.RECEPTIONIST) {
      throw new ForbiddenException(
        'Receptionist cannot view electricity readings',
      );
    }

    const where: Prisma.ElectricityReadingWhereInput = {};
    if (query.propertyId) where.propertyId = query.propertyId;
    if (query.unitId) where.unitId = query.unitId;
    if (query.billingMonth !== undefined) where.billingMonth = query.billingMonth;
    if (query.billingYear !== undefined) where.billingYear = query.billingYear;

    const rows = await this.prisma.electricityReading.findMany({
      where,
      include: readingInclude,
      orderBy: [
        { billingYear: 'desc' },
        { billingMonth: 'desc' },
        { readingDate: 'desc' },
      ],
    });

    const mapped: ReturnType<typeof mapElectricityReading>[] = [];
    for (const row of rows) {
      mapped.push(mapElectricityReading(await this.applyPendingFine(row)));
    }
    return mapped;
  }

  async findOne(id: string, role: Role) {
    if (role === Role.RECEPTIONIST) {
      throw new ForbiddenException(
        'Receptionist cannot view electricity readings',
      );
    }
    const reading = await this.applyPendingFine(await this.getReadingOrThrow(id));
    return mapElectricityReading(reading);
  }

  async archive(id: string, role: Role) {
    if (role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException(
        'Only Super Admin can delete electricity readings',
      );
    }

    const existing = await this.getReadingOrThrow(id);
    await this.prisma.$transaction(async (tx) => {
      await tx.electricityReading.delete({ where: { id } });
      if (existing.expenseId) {
        await tx.expense.update({
          where: { id: existing.expenseId },
          data: { isActive: false },
        });
      }
    });
    return { id, archived: true };
  }

  /** Apply one-time late fine when due and still unpaid; never re-apply. */
  async applyPendingFine(reading: ReadingRow): Promise<ReadingRow> {
    if (reading.currentUnits == null || reading.lateFineApplied) {
      return reading;
    }

    const baseBill = reading.calculatedAmount;
    const paidAmount = reading.expense?.paidAmount ?? new Prisma.Decimal(0);
    const dueDate = reading.dueDate ?? reading.expense?.dueDate ?? null;
    const fine = computeOneTimeLateFine({
      baseBill,
      dueDate,
      remainingBeforeFine: baseBill.minus(paidAmount),
      lateFineApplied: false,
      lateFinePercentage: reading.lateFinePercentage,
    });

    if (!fine.shouldApply) {
      // Still refresh overdue status if needed
      if (reading.expenseId && dueDate) {
        const amount = reading.expense?.amount ?? baseBill;
        const status = deriveExpensePaymentStatus(amount, paidAmount, dueDate);
        if (reading.expense && reading.expense.paymentStatus !== status) {
          await this.prisma.expense.update({
            where: { id: reading.expenseId },
            data: { paymentStatus: status },
          });
          return this.getReadingOrThrow(reading.id);
        }
      }
      return reading;
    }

    const lateFineAmount = fine.lateFineAmount;
    const finalBill = computeFinalBill(baseBill, lateFineAmount);
    const safePaid = paidAmount.greaterThan(finalBill) ? finalBill : paidAmount;

    await this.prisma.$transaction(async (tx) => {
      await tx.electricityReading.update({
        where: { id: reading.id },
        data: {
          lateFineAmount,
          lateFineApplied: true,
        },
      });
      if (reading.expenseId) {
        await tx.expense.update({
          where: { id: reading.expenseId },
          data: {
            amount: finalBill,
            paidAmount: safePaid,
            remainingAmount: finalBill.minus(safePaid),
            paymentStatus: deriveExpensePaymentStatus(
              finalBill,
              safePaid,
              dueDate,
            ),
          },
        });
      }
    });

    await this.auditLogs.write({
      module: ApprovalModuleName.ELECTRICITY,
      action: 'FINE_APPLIED',
      recordId: reading.id,
      userId: reading.createdByUserId,
      role: Role.SUPER_ADMIN,
      newData: {
        lateFineAmount: lateFineAmount.toString(),
        finalBill: finalBill.toString(),
      },
    });

    await this.notifyFineApplied(reading);

    return this.getReadingOrThrow(reading.id);
  }

  private async notifyFineApplied(reading: ReadingRow) {
    await this.notifications.notifyRole(Role.ADMIN, {
      type: NotificationType.WARNING,
      title: 'Electricity overdue fine applied',
      message: `5% late fine applied for ${reading.property?.name ?? 'property'} ${reading.unit?.unitNumber ?? ''} (${reading.billingMonth}/${reading.billingYear})`,
      relatedModule: 'ELECTRICITY',
      relatedId: reading.id,
      actionUrl: '/expenses',
    });
  }

  private async resolveRate(override?: number) {
    if (override !== undefined) {
      const rate = new Prisma.Decimal(override);
      if (rate.lessThanOrEqualTo(0)) {
        throw new BadRequestException('ratePerUnit must be greater than zero');
      }
      return rate;
    }
    const defaultRate = await this.getDefaultRate();
    return new Prisma.Decimal(defaultRate.ratePerUnit);
  }

  private async requireUnit(unitId: string, propertyId: string) {
    const unit = await this.prisma.unit.findUnique({
      where: { id: unitId },
      include: { property: true },
    });
    if (!unit || !unit.isActive || !unit.property.isActive) {
      throw new NotFoundException('Unit not found');
    }
    if (unit.propertyId !== propertyId) {
      throw new BadRequestException(
        'Unit does not belong to the selected property',
      );
    }
    return unit;
  }

  private async getReadingOrThrow(id: string) {
    const reading = await this.prisma.electricityReading.findUnique({
      where: { id },
      include: readingInclude,
    });
    if (!reading) {
      throw new NotFoundException('Electricity reading not found');
    }
    return reading;
  }

  private assertCanManageReadings(role: Role) {
    if (role === Role.RECEPTIONIST) {
      throw new ForbiddenException(
        'Receptionist cannot manage electricity readings',
      );
    }
    if (role !== Role.SUPER_ADMIN && role !== Role.ADMIN) {
      throw new ForbiddenException('Insufficient permissions');
    }
  }

  private parsePaymentMethod(value: string): PaymentMethod {
    const allowed = Object.values(PaymentMethod) as string[];
    if (!allowed.includes(value)) {
      throw new BadRequestException('Invalid payment method');
    }
    return value as PaymentMethod;
  }

  private handleUnique(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(
        'An electricity reading already exists for this unit, billing month and year',
      );
    }
    throw error;
  }
}
