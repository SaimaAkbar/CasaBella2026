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
import { Role } from '../../generated/prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import type { AuthUser } from '../common/types/auth-user.type';
import { CreateMonthlyAgreementDto } from './dto/create-monthly-agreement.dto';
import { RenewMonthlyAgreementDto } from './dto/renew-monthly-agreement.dto';
import {
  QueryMonthlyAgreementsDto,
  UpdateMonthlyAgreementDto,
} from './dto/update-monthly-agreement.dto';
import { MonthlyAgreementsService } from './monthly-agreements.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.RECEPTIONIST)
@Controller('monthly-agreements')
export class MonthlyAgreementsController {
  constructor(private readonly service: MonthlyAgreementsService) {}

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  create(
    @Body() dto: CreateMonthlyAgreementDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.create(dto, user.role);
  }

  @Get()
  findAll(
    @Query() query: QueryMonthlyAgreementsDto,
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

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMonthlyAgreementDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.update(id, dto, user.role, user.id);
  }

  @Post(':id/renew')
  @Roles(Role.SUPER_ADMIN)
  renew(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RenewMonthlyAgreementDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.renew(id, dto, user.role, user.id);
  }

  @Post(':id/activate')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  activate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.activate(id, user.role);
  }

  @Post(':id/end')
  @Roles(Role.SUPER_ADMIN)
  end(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.end(id, user.role);
  }
}
