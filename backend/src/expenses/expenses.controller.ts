import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { CreateExpenseDto } from './dto/create-expense.dto';
import { PropertyMonthViewQueryDto } from './dto/property-month-view.dto';
import { QueryExpensesDto } from './dto/query-expenses.dto';
import {
  BulkCreateExpensesDto,
  MonthlySummaryQueryDto,
  RecordExpensePaymentDto,
} from './dto/record-payment.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { ExpensesService } from './expenses.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.RECEPTIONIST)
@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Post()
  create(@Body() dto: CreateExpenseDto, @CurrentUser() user: AuthUser) {
    return this.expensesService.create(dto, user.role, user.id);
  }

  @Post('bulk')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  bulkCreate(
    @Body() dto: BulkCreateExpensesDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.expensesService.bulkCreate(dto, user);
  }

  @Get()
  findAll(@Query() query: QueryExpensesDto, @CurrentUser() user: AuthUser) {
    return this.expensesService.findAll(query, user.role);
  }

  @Get('monthly-summary')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  monthlySummary(
    @Query() query: MonthlySummaryQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.expensesService.getMonthlySummary(query, user.role);
  }

  @Get('property-month-view')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  propertyMonthView(
    @Query() query: PropertyMonthViewQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.expensesService.getPropertyMonthView(query, user.role);
  }

  @Get('summary/stats')
  getSummary(@Query() query: QueryExpensesDto, @CurrentUser() user: AuthUser) {
    return this.expensesService.getSummary(query, user.role);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.expensesService.findOne(id, user.role);
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateExpenseDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.expensesService.update(id, dto, user, {
      auditContext: extractAuditContext(req),
    });
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.expensesService.archive(id, user, {
      auditContext: extractAuditContext(req),
    });
  }

  @Post(':id/finalize')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  finalize(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.expensesService.finalize(id, user.role, user.id);
  }

  @Post(':id/mark-paid')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  markPaid(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.expensesService.markPaid(id, user.role);
  }

  @Post(':id/record-payment')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  recordPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecordExpensePaymentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.expensesService.recordPayment(id, dto, user);
  }
}
