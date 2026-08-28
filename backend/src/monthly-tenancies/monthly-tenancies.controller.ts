import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Role } from '../../generated/prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import type { AuthUser } from '../common/types/auth-user.type';
import { ChangeUnitAssignmentDto } from './dto/change-unit-assignment.dto';
import { CreateMonthlyTenancyDto } from './dto/create-monthly-tenancy.dto';
import { QueryEligibleUnitsDto } from './dto/query-eligible-units.dto';
import { QueryMonthlyTenanciesDto } from './dto/query-monthly-tenancies.dto';
import { RentRevisionDto } from './dto/rent-revision.dto';
import { UpdateMonthlyTenancyDto } from './dto/update-monthly-tenancy.dto';
import { MonthlyTenanciesService } from './monthly-tenancies.service';

/**
 * @deprecated Prefer `/monthly-unit-assignments` for new clients.
 * Kept as a compatibility alias for existing UI calls.
 */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.RECEPTIONIST)
@Controller('monthly-tenancies')
export class MonthlyTenanciesController {
  constructor(
    private readonly monthlyTenanciesService: MonthlyTenanciesService,
  ) {}

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  create(
    @Body() dto: CreateMonthlyTenancyDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.monthlyTenanciesService.create(dto, user.role, user.id);
  }

  @Get()
  findAll(
    @Query() query: QueryMonthlyTenanciesDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.monthlyTenanciesService.findAll(query, user.role);
  }

  @Get('summary/stats')
  getSummary(
    @Query() query: QueryMonthlyTenanciesDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.monthlyTenanciesService.getSummary(query, user.role);
  }

  @Get('eligible-units')
  @SkipThrottle()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  listEligibleUnits(@Query() query: QueryEligibleUnitsDto) {
    return this.monthlyTenanciesService.listEligibleUnits(query);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.monthlyTenanciesService.findOne(id, user.role);
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMonthlyTenancyDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.monthlyTenanciesService.update(id, dto, user.role);
  }

  @Post(':id/change-unit')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  changeUnit(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeUnitAssignmentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.monthlyTenanciesService.changeUnit(
      id,
      dto,
      user.role,
      user.id,
    );
  }

  @Post(':id/mark-empty')
  markEmpty(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.monthlyTenanciesService.markEmpty(id, user.role);
  }

  @Post(':id/mark-occupied')
  markOccupied(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.monthlyTenanciesService.markOccupied(id, user.role);
  }

  @Post(':id/end')
  @Roles(Role.SUPER_ADMIN)
  endTenancy(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.monthlyTenanciesService.endTenancy(id, user.role);
  }

  @Post(':id/rent-revision')
  @Roles(Role.SUPER_ADMIN)
  recordRentRevision(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RentRevisionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.monthlyTenanciesService.recordRentRevision(
      id,
      dto,
      user.id,
      user.role,
    );
  }

  @Get(':id/rent-revisions')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  getRentRevisions(@Param('id', ParseUUIDPipe) id: string) {
    return this.monthlyTenanciesService.getRentRevisions(id);
  }
}

/**
 * Canonical assignment API (spec §14). Delegates to the same service as
 * `/monthly-tenancies` so hotel-use FKs remain on MonthlyTenancy rows.
 */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.RECEPTIONIST)
@Controller('monthly-unit-assignments')
export class MonthlyUnitAssignmentsController {
  constructor(
    private readonly monthlyTenanciesService: MonthlyTenanciesService,
  ) {}

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  create(
    @Body() dto: CreateMonthlyTenancyDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.monthlyTenanciesService.create(dto, user.role, user.id);
  }

  @Get()
  findAll(
    @Query() query: QueryMonthlyTenanciesDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.monthlyTenanciesService.findAll(query, user.role);
  }

  @Get('eligible-units')
  @SkipThrottle()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  listEligibleUnits(@Query() query: QueryEligibleUnitsDto) {
    return this.monthlyTenanciesService.listEligibleUnits(query);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.monthlyTenanciesService.findOne(id, user.role);
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMonthlyTenancyDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.monthlyTenanciesService.update(id, dto, user.role);
  }

  @Post(':id/change-unit')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  changeUnit(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeUnitAssignmentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.monthlyTenanciesService.changeUnit(
      id,
      dto,
      user.role,
      user.id,
    );
  }

  @Post(':id/mark-empty')
  markEmpty(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.monthlyTenanciesService.markEmpty(id, user.role);
  }

  @Post(':id/mark-occupied')
  markOccupied(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.monthlyTenanciesService.markOccupied(id, user.role);
  }

  @Post(':id/end')
  @Roles(Role.SUPER_ADMIN)
  end(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.monthlyTenanciesService.endTenancy(id, user.role);
  }

  @Post(':id/rent-revision')
  @Roles(Role.SUPER_ADMIN)
  recordRentRevision(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RentRevisionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.monthlyTenanciesService.recordRentRevision(
      id,
      dto,
      user.id,
      user.role,
    );
  }

  @Get(':id/rent-revisions')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  getRentRevisions(@Param('id', ParseUUIDPipe) id: string) {
    return this.monthlyTenanciesService.getRentRevisions(id);
  }
}
