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
import { CreateMonthlyTenantDto } from './dto/create-monthly-tenant.dto';
import { QueryMonthlyTenantsDto } from './dto/query-monthly-tenants.dto';
import { UpdateMonthlyTenantDto } from './dto/update-monthly-tenant.dto';
import { MonthlyTenantsService } from './monthly-tenants.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.RECEPTIONIST)
@Controller('monthly-tenants')
export class MonthlyTenantsController {
  constructor(private readonly monthlyTenantsService: MonthlyTenantsService) {}

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  create(
    @Body() dto: CreateMonthlyTenantDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.monthlyTenantsService.create(dto, user.role);
  }

  @Get()
  findAll(
    @Query() query: QueryMonthlyTenantsDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.monthlyTenantsService.findAll(query, user.role);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.monthlyTenantsService.findOne(id, user.role);
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMonthlyTenantDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.monthlyTenantsService.update(id, dto, user.role);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.monthlyTenantsService.archive(id, user.role);
  }
}
