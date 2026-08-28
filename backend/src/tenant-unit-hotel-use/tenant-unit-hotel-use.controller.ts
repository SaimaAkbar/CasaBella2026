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
import { CreateTenantUnitHotelUseDto } from './dto/create-tenant-unit-hotel-use.dto';
import { LinkHotelUseBookingDto } from './dto/link-hotel-use-booking.dto';
import { QueryEligibleAssignmentsDto } from './dto/settle-hotel-use.dto';
import { QueryTenantUnitHotelUseDto } from './dto/query-tenant-unit-hotel-use.dto';
import { SettleHotelUseDto } from './dto/settle-hotel-use.dto';
import { TenantUnitHotelUseService } from './tenant-unit-hotel-use.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.RECEPTIONIST)
@Controller('tenant-unit-hotel-use')
export class TenantUnitHotelUseController {
  constructor(private readonly service: TenantUnitHotelUseService) {}

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  create(
    @Body() dto: CreateTenantUnitHotelUseDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.service.create(dto, user, extractAuditContext(req));
  }

  @Get()
  findAll(
    @Query() query: QueryTenantUnitHotelUseDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.findAll(query, user.role);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.findOne(id, user.role);
  }

  @Get(':id/settlement')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  getSettlement(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.getSettlementDetail(id, user.role);
  }

  @Post(':id/approve')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.service.approve(id, user, extractAuditContext(req));
  }

  @Post(':id/cancel')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.service.cancel(id, user, extractAuditContext(req));
  }

  @Post(':id/settle')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  settle(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SettleHotelUseDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.service.settle(id, dto, user, extractAuditContext(req));
  }

  @Post(':id/create-booking')
  createBooking(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: Omit<LinkHotelUseBookingDto, 'hotelUseId'>,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.service.createBooking(
      { ...dto, hotelUseId: id },
      user,
      extractAuditContext(req),
    );
  }
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.RECEPTIONIST)
@Controller('tenant-unit-assignments')
export class TenantUnitAssignmentsController {
  constructor(private readonly service: TenantUnitHotelUseService) {}

  @Get('eligible-for-hotel-use')
  listEligible(
    @Query() query: QueryEligibleAssignmentsDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.listEligibleAssignments(query, user.role);
  }
}
