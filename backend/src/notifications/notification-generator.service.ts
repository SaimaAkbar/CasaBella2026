import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  BookingStatus,
  ExpensePaymentStatus,
  MonthlyBillPaymentStatus,
  NotificationPriority,
  NotificationType,
  OwnerAccountDirection,
  OwnerStatementPaymentStatus,
  Prisma,
  Role,
  SalaryPaymentStatus,
  UnitStatus,
} from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';

/** Format a Decimal or number as "Rs. 50,000" */
function fmt(value: Prisma.Decimal | number | string): string {
  const n =
    value instanceof Prisma.Decimal ? Number(value.toString()) : Number(value);
  return `Rs. ${n.toLocaleString('en-PK', { maximumFractionDigits: 0 })}`;
}

/** Zero-padded month label: "2026-08" */
function periodKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

/** Today's date string "2026-08-09" */
function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

@Injectable()
export class NotificationGeneratorService {
  private readonly logger = new Logger(NotificationGeneratorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  // ─── Scheduler entry-point (every 30 min) ──────────────────────────────────

  @Cron(CronExpression.EVERY_30_MINUTES)
  async runAll() {
    this.logger.log('Running notification generation cycle');
    await Promise.allSettled([
      this.generateTenantRentAlerts(),
      this.generateDailyGuestAlerts(),
      this.generateCleaningAlerts(),
      this.generateElectricityAlerts(),
      this.generateOwnerPaymentAlerts(),
      this.generateSalaryAlerts(),
      this.generateAgreementExpiryAlerts(),
    ]);
  }

  // ─── Public trigger methods (called after relevant business actions) ────────

  /** Call after a payment is recorded for a monthly bill. */
  async onBillPayment(billId: string) {
    await this.processSingleBill(billId);
  }

  /** Call after a booking is checked out. */
  async onBookingCheckout(bookingId: string) {
    await this.processCheckoutNotifications(bookingId);
  }

  /** Call after unit cleaning is marked complete. */
  async onCleaningComplete(unitId: string) {
    await this.notifications.resolveByDedupePrefix(`CLEANING_REQUIRED:${unitId}`);
  }

  /** Call after unit enters maintenance. */
  async onMaintenanceRequired(unitId: string, unitNumber: string, propertyName: string, notes?: string) {
    const dedupeKey = `MAINTENANCE_REQUIRED:${unitId}`;
    await this.notifications.notifyRoles([Role.SUPER_ADMIN, Role.ADMIN], {
      type: NotificationType.WARNING,
      priority: NotificationPriority.HIGH,
      title: 'Maintenance Required',
      message: `${propertyName} • ${unitNumber}${notes ? ` — ${notes}` : ''}`,
      relatedModule: 'UNITS',
      relatedId: unitId,
      actionUrl: `/rooms?unitId=${unitId}`,
      dedupeKey,
    });
  }

  /** Call after maintenance is completed. */
  async onMaintenanceComplete(unitId: string) {
    await this.notifications.resolveByDedupePrefix(`MAINTENANCE_REQUIRED:${unitId}`);
  }

  /** Call after an owner statement payment is recorded. */
  async onOwnerStatementPayment(statementId: string) {
    await this.processSingleOwnerStatement(statementId);
  }

  /** Call after a salary payment is recorded. */
  async onSalaryPayment(recordId: string) {
    await this.processSingleSalaryRecord(recordId);
  }

  // ─── TENANT RENT ALERTS ────────────────────────────────────────────────────

  async generateTenantRentAlerts() {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    const period = periodKey(year, month);

    const bills = await this.prisma.monthlyBill.findMany({
      where: {
        billingMonth: month,
        billingYear: year,
        paymentStatus: {
          in: [
            MonthlyBillPaymentStatus.UNPAID,
            MonthlyBillPaymentStatus.PARTIAL,
            MonthlyBillPaymentStatus.HALF_PAID,
            MonthlyBillPaymentStatus.OVERDUE,
          ],
        },
        remainingBalance: { gt: 0 },
      },
      include: {
        agreement: {
          include: {
            tenant: { select: { id: true, fullName: true } },
            assignments: {
              where: { tenancyStatus: 'ACTIVE' as const },
              take: 1,
              include: {
                unit: { select: { id: true, unitNumber: true } },
              },
            },
          },
        },
      },
    });

    for (const bill of bills) {
      await this.processTenantBillAlert(bill, now, period);
    }

    // Auto-resolve bills that are now paid
    const paidBills = await this.prisma.monthlyBill.findMany({
      where: {
        billingMonth: month,
        billingYear: year,
        paymentStatus: {
          in: [MonthlyBillPaymentStatus.PAID, MonthlyBillPaymentStatus.OVERPAID],
        },
      },
      select: { id: true },
    });
    for (const bill of paidBills) {
      await this.notifications.resolveByDedupePrefix(`TENANT_RENT:${bill.id}`);
    }
  }

  private async processSingleBill(billId: string) {
    const bill = await this.prisma.monthlyBill.findUnique({
      where: { id: billId },
      include: {
        agreement: {
          include: {
            tenant: { select: { id: true, fullName: true } },
            assignments: {
              where: { tenancyStatus: 'ACTIVE' as const },
              take: 1,
              include: {
                unit: { select: { id: true, unitNumber: true } },
              },
            },
          },
        },
      },
    });
    if (!bill) return;

    const period = periodKey(bill.billingYear, bill.billingMonth);
    const now = new Date();

    if (
      bill.paymentStatus === MonthlyBillPaymentStatus.PAID ||
      bill.paymentStatus === MonthlyBillPaymentStatus.OVERPAID ||
      bill.remainingBalance.lte(0)
    ) {
      await this.notifications.resolveByDedupePrefix(`TENANT_RENT:${bill.id}`);
      return;
    }
    await this.processTenantBillAlert(bill, now, period);
  }

  private async processTenantBillAlert(
    bill: Prisma.MonthlyBillGetPayload<{
      include: {
        agreement: {
          include: {
            tenant: { select: { id: true; fullName: true } };
            assignments: {
              where: { tenancyStatus: 'ACTIVE' };
              take: 1;
              include: { unit: { select: { id: true; unitNumber: true } } };
            };
          };
        };
      };
    }>,
    now: Date,
    period: string,
  ) {
    const tenant = bill.agreement.tenant;
    const unit = bill.agreement.assignments[0]?.unit;
    if (!unit) return;

    const remaining = fmt(bill.remainingBalance);
    const unitLabel = unit.unitNumber;
    const dueDate = bill.dueDate;
    const isOverdue = now > dueDate;
    const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / 86400000);
    const isDueToday = daysUntilDue === 0;
    const isDueSoon = daysUntilDue > 0 && daysUntilDue <= 3;

    let type = 'DUE_SOON';
    let title: string;
    let message: string;
    let priority: NotificationPriority;

    if (isOverdue) {
      type = 'OVERDUE';
      title = 'Rent Overdue';
      message = `${tenant.fullName} • ${unitLabel} — ${remaining} outstanding`;
      priority = NotificationPriority.CRITICAL;
    } else if (isDueToday) {
      type = 'DUE_TODAY';
      title = 'Rent Due Today';
      message = `${tenant.fullName} • ${unitLabel} — ${remaining} due today`;
      priority = NotificationPriority.HIGH;
    } else if (isDueSoon) {
      type = 'DUE_SOON';
      title = 'Rent Due Soon';
      message = `${tenant.fullName} • ${unitLabel} — ${remaining} due in ${daysUntilDue} day${daysUntilDue === 1 ? '' : 's'}`;
      priority = NotificationPriority.NORMAL;
    } else {
      return; // not due soon enough to alert
    }

    const dedupeKey = `TENANT_RENT:${bill.id}:${period}:${type}`;
    await this.notifications.notifyRoles([Role.SUPER_ADMIN, Role.ADMIN], {
      type: NotificationType.WARNING,
      priority,
      title,
      message,
      relatedModule: 'MONTHLY_TENANTS',
      relatedId: bill.agreementId,
      actionUrl: `/monthly-tenants?billId=${bill.id}`,
      dedupeKey,
    });
  }

  // ─── DAILY GUEST ALERTS ────────────────────────────────────────────────────

  async generateDailyGuestAlerts() {
    const today = todayKey();
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    // Checkout today
    const checkoutsToday = await this.prisma.booking.findMany({
      where: {
        bookingStatus: BookingStatus.CHECKED_IN,
        checkOutDateTime: { gte: startOfDay, lte: endOfDay },
      },
      include: {
        guest: { select: { id: true, fullName: true } },
        unit: { select: { id: true, unitNumber: true } },
      },
    });

    for (const booking of checkoutsToday) {
      const dedupeKey = `CHECKOUT_TODAY:${booking.id}:${today}`;
      const checkoutTime = booking.checkOutDateTime.toLocaleTimeString('en-PK', {
        hour: '2-digit',
        minute: '2-digit',
      });
      await this.notifications.notifyRoles(
        [Role.SUPER_ADMIN, Role.ADMIN, Role.RECEPTIONIST],
        {
          type: NotificationType.REMINDER,
          priority: NotificationPriority.HIGH,
          title: 'Checkout Today',
          message: `${booking.guest.fullName} • ${booking.unit.unitNumber} at ${checkoutTime}`,
          relatedModule: 'BOOKINGS',
          relatedId: booking.id,
          actionUrl: `/daily-guests?bookingId=${booking.id}`,
          dedupeKey,
        },
      );
    }

    // Checkout overdue (checked-in but past checkout time)
    const overdueCheckouts = await this.prisma.booking.findMany({
      where: {
        bookingStatus: BookingStatus.CHECKED_IN,
        checkOutDateTime: { lt: startOfDay },
      },
      include: {
        guest: { select: { id: true, fullName: true } },
        unit: { select: { id: true, unitNumber: true } },
      },
    });

    for (const booking of overdueCheckouts) {
      const dedupeKey = `CHECKOUT_OVERDUE:${booking.id}`;
      await this.notifications.notifyRoles(
        [Role.SUPER_ADMIN, Role.ADMIN, Role.RECEPTIONIST],
        {
          type: NotificationType.WARNING,
          priority: NotificationPriority.CRITICAL,
          title: 'Checkout Overdue',
          message: `${booking.guest.fullName} • ${booking.unit.unitNumber} — past checkout time`,
          relatedModule: 'BOOKINGS',
          relatedId: booking.id,
          actionUrl: `/daily-guests?bookingId=${booking.id}`,
          dedupeKey,
        },
      );
    }

    // Resolve overdue alerts for bookings that are now checked out
    const recentCheckouts = await this.prisma.booking.findMany({
      where: {
        bookingStatus: BookingStatus.CHECKED_OUT,
        updatedAt: { gte: new Date(Date.now() - 2 * 60 * 60 * 1000) },
      },
      select: { id: true },
    });
    for (const b of recentCheckouts) {
      await this.notifications.resolveByDedupePrefix(`CHECKOUT_OVERDUE:${b.id}`);
      await this.notifications.resolveByDedupePrefix(`CHECKOUT_TODAY:${b.id}`);
    }
  }

  private async processCheckoutNotifications(bookingId: string) {
    // Resolve checkout alerts now that guest has checked out
    await this.notifications.resolveByDedupePrefix(`CHECKOUT_TODAY:${bookingId}`);
    await this.notifications.resolveByDedupePrefix(`CHECKOUT_OVERDUE:${bookingId}`);

    // Trigger cleaning alert for the unit
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        unit: {
          select: {
            id: true,
            unitNumber: true,
            property: { select: { name: true } },
          },
        },
        guest: { select: { fullName: true } },
      },
    });
    if (!booking) return;

    const dedupeKey = `CLEANING_REQUIRED:${booking.unitId}:${todayKey()}`;
    await this.notifications.notifyRoles(
      [Role.SUPER_ADMIN, Role.ADMIN, Role.RECEPTIONIST],
      {
        type: NotificationType.INFO,
        priority: NotificationPriority.NORMAL,
        title: 'Cleaning Required',
        message: `${booking.unit.property.name} • ${booking.unit.unitNumber} — ${booking.guest.fullName} checked out`,
        relatedModule: 'UNITS',
        relatedId: booking.unitId,
        actionUrl: `/rooms?unitId=${booking.unitId}`,
        dedupeKey,
      },
    );
  }

  // ─── CLEANING ALERTS ──────────────────────────────────────────────────────

  async generateCleaningAlerts() {
    const units = await this.prisma.unit.findMany({
      where: { status: UnitStatus.CLEANING_REQUIRED, isActive: true },
      include: { property: { select: { name: true } } },
    });

    for (const unit of units) {
      const dedupeKey = `CLEANING_REQUIRED:${unit.id}:${todayKey()}`;
      await this.notifications.notifyRoles(
        [Role.SUPER_ADMIN, Role.ADMIN, Role.RECEPTIONIST],
        {
          type: NotificationType.INFO,
          priority: NotificationPriority.NORMAL,
          title: 'Cleaning Required',
          message: `${unit.property.name} • ${unit.unitNumber}`,
          relatedModule: 'UNITS',
          relatedId: unit.id,
          actionUrl: `/rooms?unitId=${unit.id}`,
          dedupeKey,
        },
      );
    }

    // Resolve for units that are no longer in cleaning state
    const readyUnits = await this.prisma.unit.findMany({
      where: {
        status: { in: [UnitStatus.AVAILABLE, UnitStatus.MONTHLY_TENANT_VACANT] },
        isActive: true,
      },
      select: { id: true },
    });
    for (const unit of readyUnits) {
      await this.notifications.resolveByDedupePrefix(`CLEANING_REQUIRED:${unit.id}`);
    }
  }

  // ─── ELECTRICITY ALERTS ────────────────────────────────────────────────────

  async generateElectricityAlerts() {
    const now = new Date();

    // Query expenses linked to electricity readings that are unpaid/partial
    const expenses = await this.prisma.expense.findMany({
      where: {
        isActive: true,
        electricityReading: { isNot: null },
        paymentStatus: { not: ExpensePaymentStatus.PAID },
        remainingAmount: { gt: 0 },
      },
      select: {
        id: true,
        remainingAmount: true,
        paidAmount: true,
        paymentStatus: true,
        electricityReading: {
          select: {
            id: true,
            billingMonth: true,
            billingYear: true,
            dueDate: true,
            property: { select: { name: true } },
            unit: { select: { id: true, unitNumber: true } },
          },
        },
      },
    });

    for (const expense of expenses) {
      const reading = expense.electricityReading;
      if (!reading || !reading.dueDate) continue;

      const dueDate = reading.dueDate;
      const isOverdue = now > dueDate;
      const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / 86400000);
      const isDueToday = daysUntilDue === 0;
      const isDueSoon = daysUntilDue > 0 && daysUntilDue <= 3;

      const unitLabel = reading.unit
        ? `${reading.property.name} • ${reading.unit.unitNumber}`
        : reading.property.name;
      const remaining = fmt(expense.remainingAmount);
      const billPeriod = periodKey(reading.billingYear, reading.billingMonth);

      if (isOverdue) {
        const dedupeKey = `ELECTRICITY_OVERDUE:${reading.id}:${billPeriod}`;
        await this.notifications.notifyRoles([Role.SUPER_ADMIN, Role.ADMIN], {
          type: NotificationType.WARNING,
          priority: NotificationPriority.CRITICAL,
          title: 'Electricity Bill Overdue',
          message: `${unitLabel} — ${remaining} outstanding`,
          relatedModule: 'ELECTRICITY',
          relatedId: reading.id,
          actionUrl: `/expenses?readingId=${reading.id}`,
          dedupeKey,
        });
      } else if (isDueToday) {
        const dedupeKey = `ELECTRICITY_DUE_TODAY:${reading.id}:${billPeriod}`;
        await this.notifications.notifyRoles([Role.SUPER_ADMIN, Role.ADMIN], {
          type: NotificationType.WARNING,
          priority: NotificationPriority.HIGH,
          title: 'Electricity Bill Due Today',
          message: `${unitLabel} — ${remaining} due today`,
          relatedModule: 'ELECTRICITY',
          relatedId: reading.id,
          actionUrl: `/expenses?readingId=${reading.id}`,
          dedupeKey,
        });
      } else if (isDueSoon) {
        const dedupeKey = `ELECTRICITY_DUE_SOON:${reading.id}:${billPeriod}`;
        await this.notifications.notifyRoles([Role.SUPER_ADMIN, Role.ADMIN], {
          type: NotificationType.INFO,
          priority: NotificationPriority.NORMAL,
          title: 'Electricity Bill Due Soon',
          message: `${unitLabel} — ${remaining} due in ${daysUntilDue} day${daysUntilDue === 1 ? '' : 's'}`,
          relatedModule: 'ELECTRICITY',
          relatedId: reading.id,
          actionUrl: `/expenses?readingId=${reading.id}`,
          dedupeKey,
        });
      }
    }

    // Auto-resolve for paid electricity expenses
    const paidExpenses = await this.prisma.expense.findMany({
      where: {
        isActive: true,
        electricityReading: { isNot: null },
        paymentStatus: ExpensePaymentStatus.PAID,
      },
      select: {
        electricityReading: { select: { id: true } },
      },
    });
    for (const expense of paidExpenses) {
      if (!expense.electricityReading) continue;
      const rid = expense.electricityReading.id;
      await this.notifications.resolveByDedupePrefix(`ELECTRICITY_OVERDUE:${rid}`);
      await this.notifications.resolveByDedupePrefix(`ELECTRICITY_DUE_TODAY:${rid}`);
      await this.notifications.resolveByDedupePrefix(`ELECTRICITY_DUE_SOON:${rid}`);
    }
  }

  // ─── OWNER PAYMENT ALERTS ──────────────────────────────────────────────────

  async generateOwnerPaymentAlerts() {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    const period = periodKey(year, month);

    const statements = await this.prisma.ownerMonthlyStatement.findMany({
      where: {
        statementMonth: month,
        statementYear: year,
        paymentStatus: {
          in: [
            OwnerStatementPaymentStatus.UNPAID,
            OwnerStatementPaymentStatus.PARTIAL,
            OwnerStatementPaymentStatus.OVERDUE,
          ],
        },
        remainingAmount: { gt: 0 },
      },
      include: {
        owner: { select: { id: true, fullName: true } },
        property: { select: { name: true } },
        unit: { select: { id: true, unitNumber: true } },
      },
    });

    for (const stmt of statements) {
      await this.processSingleOwnerStatementAlert(stmt, now, period);
    }

    // Auto-resolve for paid statements
    const paidStatements = await this.prisma.ownerMonthlyStatement.findMany({
      where: {
        statementMonth: month,
        statementYear: year,
        paymentStatus: {
          in: [
            OwnerStatementPaymentStatus.PAID,
            OwnerStatementPaymentStatus.OVERPAID,
          ],
        },
      },
      select: { id: true },
    });
    for (const stmt of paidStatements) {
      await this.notifications.resolveByDedupePrefix(`OWNER_STMT:${stmt.id}`);
    }
  }

  private async processSingleOwnerStatement(statementId: string) {
    const stmt = await this.prisma.ownerMonthlyStatement.findUnique({
      where: { id: statementId },
      include: {
        owner: { select: { id: true, fullName: true } },
        property: { select: { name: true } },
        unit: { select: { id: true, unitNumber: true } },
      },
    });
    if (!stmt) return;

    if (stmt.remainingAmount.lte(0)) {
      await this.notifications.resolveByDedupePrefix(`OWNER_STMT:${stmt.id}`);
      return;
    }

    const period = periodKey(stmt.statementYear, stmt.statementMonth);
    await this.processSingleOwnerStatementAlert(stmt, new Date(), period);
  }

  private async processSingleOwnerStatementAlert(
    stmt: Prisma.OwnerMonthlyStatementGetPayload<{
      include: {
        owner: { select: { id: true; fullName: true } };
        property: { select: { name: true } };
        unit: { select: { id: true; unitNumber: true } };
      };
    }>,
    now: Date,
    period: string,
  ) {
    const isOverdue = now > stmt.dueDate;
    const daysUntilDue = Math.ceil((stmt.dueDate.getTime() - now.getTime()) / 86400000);
    const isDueSoon = daysUntilDue >= 0 && daysUntilDue <= 3;
    const remaining = fmt(stmt.remainingAmount);
    const unitLabel = `${stmt.property.name} • ${stmt.unit.unitNumber}`;
    const ownerName = stmt.owner.fullName;

    let title: string;
    let message: string;
    let priority: NotificationPriority;
    let alertType: string;

    const isPayable = stmt.accountDirection === OwnerAccountDirection.PAYABLE_TO_OWNER;

    if (isOverdue) {
      alertType = 'OVERDUE';
      priority = NotificationPriority.CRITICAL;
      if (isPayable) {
        title = 'Owner Payment Overdue';
        message = `${unitLabel} — ${ownerName} — ${remaining} payable outstanding`;
      } else {
        title = 'Owner Collection Overdue';
        message = `${unitLabel} — ${ownerName} — ${remaining} receivable outstanding`;
      }
    } else if (isDueSoon || daysUntilDue === 0) {
      alertType = 'DUE_SOON';
      priority = daysUntilDue === 0 ? NotificationPriority.HIGH : NotificationPriority.NORMAL;
      if (isPayable) {
        title = 'Owner Payment Due';
        message = `${unitLabel} — ${ownerName} — ${remaining} to pay${daysUntilDue === 0 ? ' today' : ` in ${daysUntilDue}d`}`;
      } else {
        title = 'Owner Collection Due';
        message = `${unitLabel} — ${ownerName} — ${remaining} receivable${daysUntilDue === 0 ? ' today' : ` in ${daysUntilDue}d`}`;
      }
    } else {
      return;
    }

    const dedupeKey = `OWNER_STMT:${stmt.id}:${period}:${alertType}`;
    // Owner financial data is SUPER_ADMIN only
    await this.notifications.notifyRole(Role.SUPER_ADMIN, {
      type: NotificationType.WARNING,
      priority,
      title,
      message,
      relatedModule: 'OWNERS',
      relatedId: stmt.id,
      actionUrl: `/owners?statementId=${stmt.id}`,
      dedupeKey,
    });
  }

  // ─── SALARY ALERTS (SUPER_ADMIN only) ─────────────────────────────────────

  async generateSalaryAlerts() {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    const period = periodKey(year, month);

    const records = await this.prisma.salaryRecord.findMany({
      where: {
        salaryMonth: month,
        salaryYear: year,
        paymentStatus: {
          in: [SalaryPaymentStatus.UNPAID, SalaryPaymentStatus.PARTIAL],
        },
        remainingBalance: { gt: 0 },
      },
      include: {
        employee: { select: { id: true, fullName: true } },
      },
    });

    for (const record of records) {
      await this.processSingleSalaryRecordAlert(record, period);
    }

    // Auto-resolve for fully paid records
    const paidRecords = await this.prisma.salaryRecord.findMany({
      where: {
        salaryMonth: month,
        salaryYear: year,
        paymentStatus: SalaryPaymentStatus.PAID,
      },
      select: { id: true },
    });
    for (const record of paidRecords) {
      await this.notifications.resolveByDedupePrefix(`SALARY:${record.id}`);
    }
  }

  private async processSingleSalaryRecord(recordId: string) {
    const record = await this.prisma.salaryRecord.findUnique({
      where: { id: recordId },
      include: { employee: { select: { id: true, fullName: true } } },
    });
    if (!record) return;

    const period = periodKey(record.salaryYear, record.salaryMonth);

    if (record.remainingBalance.lte(0) || record.paymentStatus === SalaryPaymentStatus.PAID) {
      await this.notifications.resolveByDedupePrefix(`SALARY:${record.id}`);
      return;
    }
    await this.processSingleSalaryRecordAlert(record, period);
  }

  private async processSingleSalaryRecordAlert(
    record: Prisma.SalaryRecordGetPayload<{
      include: { employee: { select: { id: true; fullName: true } } };
    }>,
    period: string,
  ) {
    const name = record.employee.fullName;
    const remaining = fmt(record.remainingBalance);
    const netPayable = fmt(record.netPayable);
    const isPartial = record.paymentStatus === SalaryPaymentStatus.PARTIAL;

    const alertType = isPartial ? 'PENDING' : 'DUE';
    const dedupeKey = `SALARY:${record.id}:${period}:${alertType}`;

    await this.notifications.notifyRole(Role.SUPER_ADMIN, {
      type: NotificationType.WARNING,
      priority: isPartial ? NotificationPriority.HIGH : NotificationPriority.NORMAL,
      title: isPartial ? 'Salary Pending' : 'Salary Due',
      message: isPartial
        ? `${name} — ${remaining} remaining of ${netPayable}`
        : `${name} — ${netPayable} salary due`,
      relatedModule: 'EMPLOYEES',
      relatedId: record.employeeId,
      actionUrl: `/employees?recordId=${record.id}`,
      dedupeKey,
    });
  }

  // ─── AGREEMENT EXPIRY ALERTS ────────────────────────────────────────────────

  async generateAgreementExpiryAlerts() {
    const now = new Date();

    // Fetch ACTIVE agreements that have an end date
    const agreements = await this.prisma.monthlyAgreement.findMany({
      where: {
        status: 'ACTIVE',
        agreementEnd: { not: null },
      },
      include: {
        tenant: { select: { id: true, fullName: true } },
      },
    });

    for (const agreement of agreements) {
      if (!agreement.agreementEnd) continue;

      const endDate = agreement.agreementEnd;
      const daysUntil = Math.ceil(
        (endDate.getTime() - now.getTime()) / 86400000,
      );
      const isExpired = daysUntil < 0;
      const expiresIn7 = daysUntil >= 0 && daysUntil <= 7;
      const expiresIn30 = daysUntil > 7 && daysUntil <= 30;

      if (isExpired) {
        const dedupeKey = `AGREEMENT_EXPIRED:${agreement.id}`;
        await this.notifications.notifyRoles(
          [Role.SUPER_ADMIN, Role.ADMIN],
          {
            type: NotificationType.WARNING,
            priority: NotificationPriority.CRITICAL,
            title: 'Agreement Expired',
            message: `${agreement.tenant.fullName} — ${agreement.agreementNumber} expired`,
            relatedModule: 'MONTHLY_TENANTS',
            relatedId: agreement.id,
            actionUrl: `/monthly-tenants?agreementId=${agreement.id}`,
            dedupeKey,
          },
        );
      } else if (expiresIn7) {
        const dedupeKey = `AGREEMENT_EXPIRING_SOON:${agreement.id}:7d`;
        await this.notifications.notifyRoles(
          [Role.SUPER_ADMIN, Role.ADMIN],
          {
            type: NotificationType.WARNING,
            priority: NotificationPriority.HIGH,
            title: 'Agreement Expiring Soon',
            message: `${agreement.tenant.fullName} — ${agreement.agreementNumber} expires in ${daysUntil} day${daysUntil === 1 ? '' : 's'}`,
            relatedModule: 'MONTHLY_TENANTS',
            relatedId: agreement.id,
            actionUrl: `/monthly-tenants?agreementId=${agreement.id}`,
            dedupeKey,
          },
        );
      } else if (expiresIn30) {
        const dedupeKey = `AGREEMENT_EXPIRING_SOON:${agreement.id}:30d`;
        await this.notifications.notifyRoles(
          [Role.SUPER_ADMIN, Role.ADMIN],
          {
            type: NotificationType.INFO,
            priority: NotificationPriority.NORMAL,
            title: 'Agreement Expiring',
            message: `${agreement.tenant.fullName} — ${agreement.agreementNumber} expires in ${daysUntil} days`,
            relatedModule: 'MONTHLY_TENANTS',
            relatedId: agreement.id,
            actionUrl: `/monthly-tenants?agreementId=${agreement.id}`,
            dedupeKey,
          },
        );
      }
    }
  }
}
