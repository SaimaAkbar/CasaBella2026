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
import {
  GenerateMonthlyBillDto,
  GenerateMonthlyBillsBatchDto,
  QueryMonthlyBillsDto,
} from './dto/monthly-bills.dto';
import { MonthlyBillsService } from './monthly-bills.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.RECEPTIONIST)
@Controller('monthly-bills')
export class MonthlyBillsController {
  constructor(private readonly service: MonthlyBillsService) {}

  @Post('generate')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  generate(
    @Body() dto: GenerateMonthlyBillDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.generate(dto, user.role);
  }

  @Post('generate-monthly')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  generateMonthly(
    @Body() dto: GenerateMonthlyBillsBatchDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.generateMonthly(dto, user.role);
  }

  @Get()
  findAll(
    @Query() query: QueryMonthlyBillsDto,
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

  @Post(':id/finalize')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  finalize(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.finalize(id, user.role);
  }
}
