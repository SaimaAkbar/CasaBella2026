import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { Role } from '../../generated/prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import type { AuthUser } from '../common/types/auth-user.type';
import { extractAuditContext } from '../common/utils/request-meta';
import { LogReceiptPrintDto } from './dto/log-receipt-print.dto';
import { ReceiptsService } from './receipts.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.RECEPTIONIST)
@Controller('receipts')
export class ReceiptsController {
  constructor(private readonly receiptsService: ReceiptsService) {}

  @Get('config')
  getConfig() {
    return this.receiptsService.getPrinterConfig();
  }

  @Get('printers')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  listPrinters() {
    return this.receiptsService.listInstalledPrinters();
  }

  @Post('test-print')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  testPrint(@Body() dto: LogReceiptPrintDto) {
    return this.receiptsService.testPrint(dto);
  }

  @Post('bookings/:id/print')
  printBookingBill(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LogReceiptPrintDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.receiptsService.printBookingBill(
      id,
      user,
      dto,
      extractAuditContext(req),
    );
  }

  @Get('bookings/:id')
  getBookingBill(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.receiptsService.getBookingBill(id, user);
  }

  @Post('tenancies/:id/print')
  printTenancyBill(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LogReceiptPrintDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.receiptsService.printTenancyBill(
      id,
      user,
      dto,
      extractAuditContext(req),
    );
  }

  @Get('tenancies/:id')
  getTenancyBill(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.receiptsService.getTenancyBill(id, user);
  }

  @Get('payments/:id')
  getPaymentReceipt(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Query('billingMonth') billingMonth?: string,
  ) {
    return this.receiptsService.getPaymentReceipt(id, user, billingMonth);
  }

  @Post('payments/:id/print')
  logPaymentPrint(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LogReceiptPrintDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Query('billingMonth') billingMonth?: string,
  ) {
    return this.receiptsService.logPaymentPrint(
      id,
      user,
      dto,
      extractAuditContext(req),
      billingMonth,
    );
  }

  @Get('expense-payments/:id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  getExpensePaymentReceipt(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.receiptsService.getExpensePaymentReceipt(id, user);
  }

  @Post('expense-payments/:id/print')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  logExpensePaymentPrint(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LogReceiptPrintDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.receiptsService.logExpensePaymentPrint(
      id,
      user,
      dto,
      extractAuditContext(req),
    );
  }

  @Get('owner-payments/:id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  getOwnerPaymentReceipt(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.receiptsService.getOwnerPaymentReceipt(id, user);
  }

  @Post('owner-payments/:id/print')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  logOwnerPaymentPrint(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LogReceiptPrintDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.receiptsService.logOwnerPaymentPrint(
      id,
      user,
      dto,
      extractAuditContext(req),
    );
  }
}
