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
import { BookingType, Role } from '../../generated/prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import type { AuthUser } from '../common/types/auth-user.type';
import { BookingsService } from './bookings.service';
import { CheckoutBookingDto } from './dto/checkout-booking.dto';
import { CreateBookingDto } from './dto/create-booking.dto';
import { QueryBookingsDto } from './dto/query-bookings.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.RECEPTIONIST)
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  create(@Body() dto: CreateBookingDto, @CurrentUser() user: AuthUser) {
    return this.bookingsService.create(dto, user.role, user.id);
  }

  @Get()
  findAll(@Query() query: QueryBookingsDto, @CurrentUser() user: AuthUser) {
    return this.bookingsService.findAll(query, user.role);
  }

  @Get('summary/stats')
  getSummary(@Query() query: QueryBookingsDto, @CurrentUser() user: AuthUser) {
    return this.bookingsService.getSummary(query, user.role);
  }

  @Get('eligible-units')
  listEligibleUnits(
    @Query('propertyId') propertyId?: string,
    @Query('bookingType') bookingType?: BookingType,
  ) {
    return this.bookingsService.listEligibleUnits(propertyId, bookingType);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.bookingsService.findOne(id, user.role);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBookingDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.bookingsService.update(id, dto, user.role);
  }

  @Post(':id/confirm')
  confirm(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.bookingsService.confirm(id, user.role);
  }

  @Post(':id/check-in')
  checkIn(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.bookingsService.checkIn(id, user.role);
  }

  @Post(':id/check-out')
  checkOut(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CheckoutBookingDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.bookingsService.checkOut(id, dto, user.role, user.id);
  }

  @Post(':id/cancel')
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.bookingsService.cancel(id, user.role);
  }

  @Post(':id/no-show')
  markNoShow(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.bookingsService.markNoShow(id, user.role);
  }

  @Post(':id/mark-cleaning-cleared')
  markCleaningCleared(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.bookingsService.markCleaningCleared(id, user.role);
  }

  @Post(':id/mark-accounts-cleared')
  markAccountsCleared(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.bookingsService.markAccountsCleared(id, user.role);
  }
}
