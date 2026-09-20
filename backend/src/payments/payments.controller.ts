import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PaymentForType, Role } from '../../generated/prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import type { AuthUser } from '../common/types/auth-user.type';
import { AdjustmentPaymentDto } from './dto/adjustment-payment.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { QueryPaymentsDto } from './dto/query-payments.dto';
import { RefundPaymentDto } from './dto/refund-payment.dto';
import { ReversePaymentDto } from './dto/reverse-payment.dto';
import { PaymentsService } from './payments.service';
import { ReceiptsService } from '../receipts/receipts.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.RECEPTIONIST)
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly receiptsService: ReceiptsService,
  ) {}

  @Post()
  create(@Body() dto: CreatePaymentDto, @CurrentUser() user: AuthUser) {
    return this.paymentsService.create(dto, user.role, user.id);
  }

  @Post('adjustment')
  @Roles(Role.SUPER_ADMIN)
  adjust(@Body() dto: AdjustmentPaymentDto, @CurrentUser() user: AuthUser) {
    return this.paymentsService.adjust(dto, user.role, user.id);
  }

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  findAll(@Query() query: QueryPaymentsDto, @CurrentUser() user: AuthUser) {
    return this.paymentsService.findAll(query, user.role);
  }

  @Get('summary/stats')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  getSummary(@Query() query: QueryPaymentsDto, @CurrentUser() user: AuthUser) {
    return this.paymentsService.getSummary(query, user.role);
  }

  @Get('outstanding-sources')
  @Roles(Role.SUPER_ADMIN)
  listOutstandingSources(
    @Query('paymentForType') paymentForType: PaymentForType,
    @Query('includeSettled') includeSettled: string | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    return this.paymentsService.listOutstandingSources(
      paymentForType,
      user.role,
      includeSettled === 'true',
    );
  }

  @Get('by-booking/:bookingId')
  listForBooking(
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.paymentsService.listForBooking(bookingId, user.role);
  }

  @Get('by-tenancy/:monthlyTenancyId')
  listForTenancy(
    @Param('monthlyTenancyId', ParseUUIDPipe) monthlyTenancyId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.paymentsService.listForTenancy(monthlyTenancyId, user.role);
  }

  @Get(':id/receipt')
  getReceipt(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Query('billingMonth') billingMonth?: string,
  ) {
    return this.receiptsService.getPaymentReceipt(id, user, billingMonth);
  }

  @Get(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.paymentsService.findOne(id, user.role);
  }

  @Post(':id/refund')
  @Roles(Role.SUPER_ADMIN)
  refund(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RefundPaymentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.paymentsService.refund(id, dto, user.role, user.id);
  }

  @Post(':id/reverse')
  @Roles(Role.SUPER_ADMIN)
  reverse(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReversePaymentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.paymentsService.reverse(id, dto, user.role, user.id);
  }
}
