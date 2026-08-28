import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '../../generated/prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import type { AuthUser } from '../common/types/auth-user.type';
import { DashboardService } from './dashboard.service';
import { DashboardRoomGridQueryDto } from './dto/dashboard-room-grid-query.dto';
import { DashboardSummaryQueryDto } from './dto/dashboard-summary-query.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.RECEPTIONIST)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  getSummary(
    @Query() query: DashboardSummaryQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.dashboardService.getSummary(
      query,
      user.role,
      user.canAccessSalary ?? false,
      user.canAccessProfitLoss ?? false,
      user.id,
    );
  }

  /** @deprecated Prefer GET /dashboard/unit-grid — kept for existing clients. */
  @Get('room-grid')
  getRoomGrid(
    @Query() query: DashboardRoomGridQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.dashboardService.getRoomGrid(query, user.role);
  }

  @Get('unit-grid')
  getUnitGrid(
    @Query() query: DashboardRoomGridQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.dashboardService.getRoomGrid(query, user.role);
  }

  @Get('unit-grid/:unitId')
  getUnitGridDetail(
    @Param('unitId', ParseUUIDPipe) unitId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.dashboardService.getUnitGridDetail(unitId, user.role);
  }

  /** Lightweight lists for dashboard filters (available to all dashboard roles). */
  @Get('filter-options')
  getFilterOptions() {
    return this.dashboardService.getFilterOptions();
  }
}
