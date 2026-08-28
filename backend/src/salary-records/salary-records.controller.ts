import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
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
import { GenerateMonthlySalaryDto } from './dto/generate-monthly.dto';
import { MarkSalaryPaidDto } from './dto/mark-paid.dto';
import { QuerySalaryRecordsDto } from './dto/query-salary-records.dto';
import { SalaryRecordsService } from './salary-records.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.ADMIN)
@Controller('salary-records')
export class SalaryRecordsController {
  constructor(private readonly salaryRecordsService: SalaryRecordsService) {}

  @Post('generate-monthly')
  generateMonthly(
    @Body() dto: GenerateMonthlySalaryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.salaryRecordsService.generateMonthly(
      dto,
      user.role,
      user.canAccessSalary ?? false,
      user.id,
    );
  }

  @Get()
  findAll(
    @Query() query: QuerySalaryRecordsDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.salaryRecordsService.findAll(
      query,
      user.role,
      user.canAccessSalary ?? false,
    );
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.salaryRecordsService.findOne(
      id,
      user.role,
      user.canAccessSalary ?? false,
    );
  }

  @Post(':id/finalize')
  finalize(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.salaryRecordsService.finalize(
      id,
      user.role,
      user.canAccessSalary ?? false,
    );
  }

  @Post(':id/approve')
  @Roles(Role.SUPER_ADMIN)
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.salaryRecordsService.approve(
      id,
      user.role,
      user.canAccessSalary ?? false,
      user.id,
    );
  }

  @Post(':id/mark-paid')
  markPaid(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MarkSalaryPaidDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.salaryRecordsService.markPaid(
      id,
      dto,
      user.role,
      user.canAccessSalary ?? false,
      user.id,
    );
  }
}
