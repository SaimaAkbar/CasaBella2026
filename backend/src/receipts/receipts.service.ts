import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaymentForType, Prisma, Role } from '../../generated/prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import type { AuditContext } from '../common/types/audit-context.type';
import type { AuthUser } from '../common/types/auth-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { LogReceiptPrintDto } from './dto/log-receipt-print.dto';
import { LocalPrinterService } from './local-printer.service';
import {
  assertCanViewPaymentReceipt,
  buildThermalReceiptFromBooking,
  buildThermalReceiptFromExpensePayment,
  buildThermalReceiptFromPayment,
  buildThermalReceiptFromTenancy,
  type ThermalReceiptDto,
} from './receipt.mapper';

const paymentReceiptInclude = {
  booking: {
    include: {
      guest: { select: { fullName: true } },
      unit: {
        select: {
          unitNumber: true,
          property: { select: { name: true } },
        },
      },
    },
  },
  monthlyTenancy: {
    include: {
      tenant: { select: { fullName: true } },
      unit: {
        select: {
          unitNumber: true,
          property: { select: { name: true } },
        },
      },
    },
  },
  ownerMonthlyStatement: {
    include: {
      property: { select: { name: true } },
      unit: { select: { unitNumber: true } },
    },
  },
  owner: { select: { fullName: true } },
  createdBy: { select: { fullName: true } },
} satisfies Prisma.PaymentInclude;

const expensePaymentInclude = {
  createdBy: { select: { fullName: true } },
  expense: {
    include: {
      monthlyTenancy: {
        include: {
          tenant: { select: { fullName: true } },
          unit: {
            select: {
              unitNumber: true,
              property: { select: { name: true } },
            },
          },
        },
      },
      electricityReading: true,
    },
  },
} satisfies Prisma.ExpensePaymentInclude;

@Injectable()
export class ReceiptsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: SettingsService,
    private readonly auditLogs: AuditLogsService,
    private readonly localPrinter: LocalPrinterService,
  ) {}

  async getPrinterConfig() {
    const [printerName, paperWidth, printWidth, autoCut, footer] =
      await Promise.all([
        this.settingsService.getValue<string>('hardware.receiptPrinterName'),
        this.settingsService.getValue<string>('hardware.receiptPaperWidthMm'),
        this.settingsService.getValue<string>('hardware.receiptPrintWidthMm'),
        this.settingsService.getValue<boolean>('hardware.receiptAutoCut'),
        this.settingsService.getValue<string>('business.receiptFooter'),
      ]);

    return {
      printerName: printerName ?? '',
      paperWidthMm: Number(paperWidth) || 80,
      printWidthMm: Number(printWidth) || 72,
      autoCut: autoCut !== false,
      businessName: 'CASA BELLA',
      receiptFooter: footer ?? 'Thank You',
    };
  }

  async getPaymentReceipt(
    paymentId: string,
    user: AuthUser,
    billingMonth?: string,
  ): Promise<ThermalReceiptDto> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: paymentReceiptInclude,
    });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    try {
      assertCanViewPaymentReceipt(payment.paymentForType, user.role);
    } catch {
      throw new ForbiddenException('Insufficient permissions to view receipt');
    }

    const branding = await this.getBranding();
    return buildThermalReceiptFromPayment(payment, {
      ...branding,
      isReprint: payment.printCount > 0,
      billingMonth: billingMonth ?? null,
    });
  }

  async logPaymentPrint(
    paymentId: string,
    user: AuthUser,
    dto: LogReceiptPrintDto,
    auditContext?: AuditContext,
    billingMonth?: string,
  ): Promise<ThermalReceiptDto> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: paymentReceiptInclude,
    });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    try {
      assertCanViewPaymentReceipt(payment.paymentForType, user.role);
    } catch {
      throw new ForbiddenException('Insufficient permissions to print receipt');
    }

    const isReprint = payment.printCount > 0;
    const updated = await this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        printCount: { increment: 1 },
        lastPrintedAt: new Date(),
      },
      include: paymentReceiptInclude,
    });

    await this.auditLogs.write({
      module: 'RECEIPTS',
      action: isReprint ? 'RECEIPT_REPRINTED' : 'RECEIPT_PRINTED',
      recordId: paymentId,
      userId: user.id,
      role: user.role,
      newData: {
        receiptNumber: updated.receiptNumber,
        paymentNumber: updated.paymentNumber,
        printerName: dto.printerName ?? null,
        printCount: updated.printCount,
      },
      context: auditContext,
    });

    const branding = await this.getBranding();
    const receipt = buildThermalReceiptFromPayment(updated, {
      ...branding,
      isReprint,
      billingMonth: billingMonth ?? null,
    });
    return this.attachPhysicalPrint(receipt, dto.printerName);
  }

  async getExpensePaymentReceipt(
    expensePaymentId: string,
    user: AuthUser,
  ): Promise<ThermalReceiptDto> {
    this.assertCanPrintExpenseReceipt(user.role);
    const row = await this.prisma.expensePayment.findUnique({
      where: { id: expensePaymentId },
      include: expensePaymentInclude,
    });
    if (!row || row.isReversed) {
      throw new NotFoundException('Expense payment not found');
    }

    const branding = await this.getBranding();
    return buildThermalReceiptFromExpensePayment(row, {
      ...branding,
      isReprint: row.printCount > 0,
    });
  }

  async logExpensePaymentPrint(
    expensePaymentId: string,
    user: AuthUser,
    dto: LogReceiptPrintDto,
    auditContext?: AuditContext,
  ): Promise<ThermalReceiptDto> {
    this.assertCanPrintExpenseReceipt(user.role);
    const existing = await this.prisma.expensePayment.findUnique({
      where: { id: expensePaymentId },
    });
    if (!existing || existing.isReversed) {
      throw new NotFoundException('Expense payment not found');
    }

    const isReprint = existing.printCount > 0;
    const updated = await this.prisma.expensePayment.update({
      where: { id: expensePaymentId },
      data: {
        printCount: { increment: 1 },
        lastPrintedAt: new Date(),
      },
      include: expensePaymentInclude,
    });

    await this.auditLogs.write({
      module: 'RECEIPTS',
      action: isReprint ? 'RECEIPT_REPRINTED' : 'RECEIPT_PRINTED',
      recordId: expensePaymentId,
      userId: user.id,
      role: user.role,
      newData: {
        receiptNumber: updated.receiptNumber,
        expenseId: updated.expenseId,
        printerName: dto.printerName ?? null,
        printCount: updated.printCount,
        receiptType: 'ELECTRICITY',
      },
      context: auditContext,
    });

    const branding = await this.getBranding();
    const receipt = buildThermalReceiptFromExpensePayment(updated, {
      ...branding,
      isReprint,
    });
    return this.attachPhysicalPrint(receipt, dto.printerName);
  }

  async getOwnerPaymentReceipt(
    paymentId: string,
    user: AuthUser,
  ): Promise<ThermalReceiptDto> {
    if (user.role !== Role.SUPER_ADMIN && user.role !== Role.ADMIN) {
      throw new ForbiddenException('Insufficient permissions to view owner receipt');
    }
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, paymentForType: PaymentForType.OWNER },
      include: paymentReceiptInclude,
    });
    if (!payment) {
      throw new NotFoundException('Owner payment not found');
    }

    const branding = await this.getBranding();
    return buildThermalReceiptFromPayment(payment, {
      ...branding,
      isReprint: payment.printCount > 0,
      billingMonth: null,
    });
  }

  async logOwnerPaymentPrint(
    paymentId: string,
    user: AuthUser,
    dto: LogReceiptPrintDto,
    auditContext?: AuditContext,
  ): Promise<ThermalReceiptDto> {
    if (user.role !== Role.SUPER_ADMIN && user.role !== Role.ADMIN) {
      throw new ForbiddenException('Insufficient permissions to print owner receipt');
    }

    const existing = await this.prisma.payment.findFirst({
      where: { id: paymentId, paymentForType: PaymentForType.OWNER },
    });
    if (!existing) {
      throw new NotFoundException('Owner payment not found');
    }

    const isReprint = existing.printCount > 0;
    const updated = await this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        printCount: { increment: 1 },
        lastPrintedAt: new Date(),
      },
      include: paymentReceiptInclude,
    });

    await this.auditLogs.write({
      module: 'RECEIPTS',
      action: isReprint ? 'RECEIPT_REPRINTED' : 'RECEIPT_PRINTED',
      recordId: paymentId,
      userId: user.id,
      role: user.role,
      newData: {
        receiptNumber: updated.receiptNumber,
        paymentNumber: updated.paymentNumber,
        printerName: dto.printerName ?? null,
        printCount: updated.printCount,
        receiptType: 'OWNER_PAYMENT',
      },
      context: auditContext,
    });

    const branding = await this.getBranding();
    const receipt = buildThermalReceiptFromPayment(updated, {
      ...branding,
      isReprint,
      billingMonth: null,
    });
    return this.attachPhysicalPrint(receipt, dto.printerName);
  }

  async listInstalledPrinters() {
    const printers = await this.localPrinter.listWindowsPrinters();
    const configured = await this.settingsService.getValue<string>(
      'hardware.receiptPrinterName',
    );
    const resolved = await this.localPrinter.resolvePrinterName(configured);
    return { printers, resolvedPrinterName: resolved };
  }

  async testPrint(dto: LogReceiptPrintDto) {
    const config = await this.getPrinterConfig();
    const result = await this.localPrinter.printTest({
      printerName: dto.printerName || config.printerName || 'POS-80',
      businessName: config.businessName,
      autoCut: config.autoCut,
    });
    return result;
  }

  async printBookingBill(
    bookingId: string,
    user: AuthUser,
    dto: LogReceiptPrintDto,
    auditContext?: AuditContext,
  ): Promise<ThermalReceiptDto> {
    const receipt = await this.getBookingBill(bookingId, user);

    await this.auditLogs.write({
      module: 'RECEIPTS',
      action: 'RECEIPT_PRINTED',
      recordId: bookingId,
      userId: user.id,
      role: user.role,
      newData: {
        receiptNumber: receipt.receiptNumber,
        printerName: dto.printerName ?? null,
        billType: 'BOOKING_BILL',
        remainingBalance: receipt.remainingBalance,
        totalPaid: receipt.totalPaid,
      },
      context: auditContext,
    });

    return this.attachPhysicalPrint(receipt, dto.printerName);
  }

  async getBookingBill(
    bookingId: string,
    user: AuthUser,
  ): Promise<ThermalReceiptDto> {
    if (
      user.role !== Role.SUPER_ADMIN &&
      user.role !== Role.ADMIN &&
      user.role !== Role.RECEPTIONIST
    ) {
      throw new ForbiddenException('Insufficient permissions to print bill');
    }

    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        guest: { select: { fullName: true } },
        unit: {
          select: {
            unitNumber: true,
            property: { select: { name: true } },
          },
        },
      },
    });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    const branding = await this.getBranding();
    return buildThermalReceiptFromBooking(booking, branding);
  }

  async printTenancyBill(
    monthlyTenancyId: string,
    user: AuthUser,
    dto: LogReceiptPrintDto,
    auditContext?: AuditContext,
  ): Promise<ThermalReceiptDto> {
    const receipt = await this.getTenancyBill(monthlyTenancyId, user);

    await this.auditLogs.write({
      module: 'RECEIPTS',
      action: 'RECEIPT_PRINTED',
      recordId: monthlyTenancyId,
      userId: user.id,
      role: user.role,
      newData: {
        receiptNumber: receipt.receiptNumber,
        printerName: dto.printerName ?? null,
        billType: 'TENANCY_BILL',
        remainingBalance: receipt.remainingBalance,
        totalPaid: receipt.totalPaid,
      },
      context: auditContext,
    });

    return this.attachPhysicalPrint(receipt, dto.printerName);
  }

  async getTenancyBill(
    monthlyTenancyId: string,
    user: AuthUser,
  ): Promise<ThermalReceiptDto> {
    if (
      user.role !== Role.SUPER_ADMIN &&
      user.role !== Role.ADMIN &&
      user.role !== Role.RECEPTIONIST
    ) {
      throw new ForbiddenException('Insufficient permissions to print bill');
    }

    const tenancy = await this.prisma.monthlyTenancy.findUnique({
      where: { id: monthlyTenancyId },
      include: {
        tenant: { select: { fullName: true } },
        agreement: { select: { agreementNumber: true } },
        unit: {
          select: {
            unitNumber: true,
            property: { select: { name: true } },
          },
        },
      },
    });
    if (!tenancy) {
      throw new NotFoundException('Monthly tenancy not found');
    }

    const branding = await this.getBranding();
    return buildThermalReceiptFromTenancy(tenancy, branding);
  }

  private async getBranding() {
    const footer = await this.settingsService.getValue<string>(
      'business.receiptFooter',
    );
    return {
      businessName: 'CASA BELLA',
      businessSubtitle: 'HOTEL & RESIDENCES',
      footer: footer ?? 'Thank You',
    };
  }

  private assertCanPrintExpenseReceipt(role: Role) {
    if (role === Role.SUPER_ADMIN || role === Role.ADMIN) return;
    throw new ForbiddenException(
      'Receptionist cannot print electricity receipts',
    );
  }

  private async attachPhysicalPrint(
    receipt: ThermalReceiptDto,
    printerNameOverride?: string,
  ): Promise<ThermalReceiptDto> {
    if (!this.localPrinter.isSupported()) {
      return {
        ...receipt,
        physicalPrint: { attempted: false, success: false },
      };
    }

    const config = await this.getPrinterConfig();
    const printerName =
      printerNameOverride?.trim() || config.printerName || 'POS-80';

    try {
      const result = await this.localPrinter.printReceipt(receipt, {
        printerName,
        autoCut: config.autoCut,
      });
      return {
        ...receipt,
        physicalPrint: {
          attempted: true,
          success: true,
          printerName: result.printerName,
        },
      };
    } catch (error) {
      return {
        ...receipt,
        physicalPrint: {
          attempted: true,
          success: false,
          printerName,
          error:
            error instanceof Error
              ? error.message
              : 'Unable to print on thermal printer.',
        },
      };
    }
  }
}
