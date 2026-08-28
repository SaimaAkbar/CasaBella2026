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
import { CreateElectricityReadingDto } from './dto/create-electricity-reading.dto';
import {
  CorrectElectricityReadingDto,
  EnterCurrentReadingDto,
  GenerateElectricityMonthDto,
  InitializeElectricityBillDto,
  RecordElectricityPaymentDto,
} from './dto/electricity-bill.dto';
import { QueryElectricityReadingsDto } from './dto/query-electricity-readings.dto';
import { UpdateElectricityRateDto } from './dto/update-electricity-rate.dto';
import { ElectricityReadingsService } from './electricity-readings.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.ADMIN)
@Controller(['electricity-readings', 'electricity-bills'])
export class ElectricityReadingsController {
  constructor(private readonly service: ElectricityReadingsService) {}

  @Get()
  findAll(
    @Query() query: QueryElectricityReadingsDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.findAll(query, user.role);
  }

  @Get('settings/rate')
  getRate() {
    return this.service.getDefaultRate();
  }

  @Get('settings/rate-history')
  getRateHistory() {
    return this.service.getRateHistory();
  }

  @Patch('settings/rate')
  updateRate(
    @Body() dto: UpdateElectricityRateDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.updateDefaultRate(dto, user);
  }

  @Post()
  create(
    @Body() dto: CreateElectricityReadingDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.create(dto, user.role, user.id);
  }

  @Post('initialize')
  initialize(
    @Body() dto: InitializeElectricityBillDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.initialize(dto, user);
  }

  @Post('generate-month')
  generateMonth(
    @Body() dto: GenerateElectricityMonthDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.generateMonth(dto, user);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.findOne(id, user.role);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN)
  archive(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.archive(id, user.role);
  }

  @Post(':id/enter-current')
  enterCurrent(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EnterCurrentReadingDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.enterCurrentReading(id, dto, user);
  }

  @Post(':id/record-payment')
  recordPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecordElectricityPaymentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.recordPayment(id, dto, user);
  }

  @Post(':id/correct')
  correct(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CorrectElectricityReadingDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.correctReading(id, dto, user);
  }
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.ADMIN)
@Controller('electricity-rates')
export class ElectricityRatesController {
  constructor(private readonly service: ElectricityReadingsService) {}

  @Get()
  getRate() {
    return this.service.getDefaultRate();
  }

  @Get('history')
  getHistory() {
    return this.service.getRateHistory();
  }

  @Patch()
  updateRate(
    @Body() dto: UpdateElectricityRateDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.updateDefaultRate(dto, user);
  }

  @Post()
  updateRatePost(
    @Body() dto: UpdateElectricityRateDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.updateDefaultRate(dto, user);
  }
}
