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
  UseGuards,
} from '@nestjs/common';
import { Role } from '../../generated/prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import type { AuthUser } from '../common/types/auth-user.type';
import {
  CreateOwnerDto,
  QueryOwnersDto,
  UpdateOwnerDto,
} from './dto/owner.dto';
import {
  QueryOwnerOverviewDto,
  QueryOwnersMonthlySummaryDto,
} from './dto/owner-statement.dto';
import { OwnersService } from './owners.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.ADMIN)
@Controller('owners')
export class OwnersController {
  constructor(private readonly ownersService: OwnersService) {}

  @Post()
  create(@Body() dto: CreateOwnerDto, @CurrentUser() user: AuthUser) {
    return this.ownersService.create(dto, user);
  }

  @Get()
  findAll(@Query() query: QueryOwnersDto, @CurrentUser() user: AuthUser) {
    return this.ownersService.findAll(query, user.role);
  }

  @Get('overview')
  overview(
    @Query() query: QueryOwnerOverviewDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.ownersService.getOverview(query, user.role);
  }

  @Get('apartment-summary')
  apartmentSummary(
    @Query() query: QueryOwnerOverviewDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.ownersService.getApartmentSummary(query, user.role);
  }

  @Get('monthly-summary')
  monthlySummary(
    @Query() query: QueryOwnersMonthlySummaryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.ownersService.getMonthlySummary(query, user.role);
  }

  @Get(':id/summary')
  ownerSummary(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.ownersService.getOwnerSummary(id, user.role);
  }

  @Get(':id/year-view')
  yearView(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('year') yearRaw: string | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    const year = Number(yearRaw ?? new Date().getFullYear());
    return this.ownersService.getYearView(id, year, user.role);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.ownersService.findOne(id, user.role);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOwnerDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.ownersService.update(id, dto, user);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.ownersService.archive(id, user);
  }
}
