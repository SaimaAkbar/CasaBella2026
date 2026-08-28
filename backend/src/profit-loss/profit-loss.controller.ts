import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Role } from '../../generated/prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import type { AuthUser } from '../common/types/auth-user.type';
import {
  QueryProfitLossByUnitDto,
  QueryProfitLossDto,
  QueryProfitLossTrendDto,
} from './dto/query-profit-loss.dto';
import { ProfitLossService } from './profit-loss.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.ADMIN)
@Controller('profit-loss')
export class ProfitLossController {
  constructor(private readonly profitLossService: ProfitLossService) {}

  @Get('summary')
  getSummary(
    @Query() query: QueryProfitLossDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.profitLossService.getSummary(
      query,
      user.role,
      user.canAccessProfitLoss ?? false,
    );
  }

  @Get('trend')
  getTrend(
    @Query() query: QueryProfitLossTrendDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.profitLossService.getTrend(
      query,
      user.role,
      user.canAccessProfitLoss ?? false,
    );
  }

  @Get('by-property')
  getByProperty(
    @Query() query: QueryProfitLossDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.profitLossService.getByProperty(
      query,
      user.role,
      user.canAccessProfitLoss ?? false,
    );
  }

  @Get('by-unit')
  getByUnit(
    @Query() query: QueryProfitLossByUnitDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.profitLossService.getByUnit(
      query,
      user.role,
      user.canAccessProfitLoss ?? false,
    );
  }

  @Get('income-breakdown')
  getIncomeBreakdown(
    @Query() query: QueryProfitLossDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.profitLossService.getIncomeBreakdown(
      query,
      user.role,
      user.canAccessProfitLoss ?? false,
    );
  }

  @Get('expense-breakdown')
  getExpenseBreakdown(
    @Query() query: QueryProfitLossDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.profitLossService.getExpenseBreakdown(
      query,
      user.role,
      user.canAccessProfitLoss ?? false,
      user.canAccessSalary ?? false,
    );
  }

  @Get('income-sources')
  getIncomeSources(
    @Query() query: QueryProfitLossDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.profitLossService.getIncomeSourceBreakdown(
      query,
      user.role,
      user.canAccessProfitLoss ?? false,
    );
  }

  @Get('expense-categories')
  getExpenseCategories(
    @Query() query: QueryProfitLossDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.profitLossService.getExpenseCategoryBreakdown(
      query,
      user.role,
      user.canAccessProfitLoss ?? false,
    );
  }
}
