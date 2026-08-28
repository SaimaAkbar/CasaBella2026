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
import { Role } from '../../generated/prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import type { AuthUser } from '../common/types/auth-user.type';
import {
  AdjustOwnerPaymentDto,
  CreateOwnerPaymentDto,
  MarkOwnerPaidDto,
  QueryOwnerPaymentsDto,
  ReverseOwnerPaymentDto,
} from './dto/owner-payment.dto';
import { OwnerPaymentsService } from './owner-payments.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
@Controller('owner-payment-transactions')
export class OwnerPaymentsController {
  constructor(private readonly ownerPaymentsService: OwnerPaymentsService) {}

  @Post()
  create(@Body() dto: CreateOwnerPaymentDto, @CurrentUser() user: AuthUser) {
    return this.ownerPaymentsService.create(dto, user);
  }

  @Post('mark-paid')
  markPaid(@Body() dto: MarkOwnerPaidDto, @CurrentUser() user: AuthUser) {
    return this.ownerPaymentsService.markPaid(dto, user);
  }

  @Post('adjustment')
  adjust(@Body() dto: AdjustOwnerPaymentDto, @CurrentUser() user: AuthUser) {
    return this.ownerPaymentsService.adjust(dto, user);
  }

  @Get()
  findAll(
    @Query() query: QueryOwnerPaymentsDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.ownerPaymentsService.findAll(query, user.role);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.ownerPaymentsService.findOne(id, user.role);
  }

  @Post(':id/reverse')
  reverse(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReverseOwnerPaymentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.ownerPaymentsService.reverse(id, dto, user);
  }
}
