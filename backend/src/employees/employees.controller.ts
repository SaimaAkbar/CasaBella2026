import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
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
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { QueryEmployeesDto } from './dto/query-employees.dto';
import { QuerySalarySummaryDto } from './dto/query-salary-summary.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { EmployeesService } from './employees.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Post()
  create(@Body() dto: CreateEmployeeDto, @CurrentUser() user: AuthUser) {
    return this.employeesService.create(dto, user.role);
  }

  @Get()
  findAll(@Query() query: QueryEmployeesDto, @CurrentUser() user: AuthUser) {
    return this.employeesService.findAll(query, user.role);
  }

  @Get('summary/stats')
  getSummary(
    @Query() query: QuerySalarySummaryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.employeesService.getSummary(user.role, query);
  }

  @Get('salary-summary')
  getSalarySummary(
    @Query() query: QuerySalarySummaryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.employeesService.getSummary(user.role, query);
  }

  @Get(':id/yearly-status')
  getYearlyStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('year', ParseIntPipe) year: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.employeesService.getYearlyStatus(id, year, user.role);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.employeesService.findOne(id, user.role);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmployeeDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.employeesService.update(id, dto, user.role, user.id);
  }

  @Delete(':id')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.employeesService.archive(id, user.role);
  }
}
