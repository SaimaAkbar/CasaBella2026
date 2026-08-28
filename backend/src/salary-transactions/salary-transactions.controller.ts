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
import { CreateSalaryTransactionDto } from './dto/create-salary-transaction.dto';
import { QuerySalaryTransactionsDto } from './dto/query-salary-transactions.dto';
import { ReverseSalaryTransactionDto } from './dto/reverse-salary-transaction.dto';
import { SalaryTransactionsService } from './salary-transactions.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
@Controller('salary-transactions')
export class SalaryTransactionsController {
  constructor(
    private readonly salaryTransactionsService: SalaryTransactionsService,
  ) {}

  @Post()
  create(
    @Body() dto: CreateSalaryTransactionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.salaryTransactionsService.create(dto, user.role, user.id);
  }

  @Get()
  findAll(
    @Query() query: QuerySalaryTransactionsDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.salaryTransactionsService.findAll(query, user.role);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.salaryTransactionsService.findOne(id, user.role);
  }

  @Post(':id/reverse')
  reverse(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReverseSalaryTransactionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.salaryTransactionsService.reverse(
      id,
      dto,
      user.role,
      user.id,
    );
  }
}
