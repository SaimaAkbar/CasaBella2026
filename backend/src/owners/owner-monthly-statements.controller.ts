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
import {
  GenerateOwnerStatementsDto,
  QueryOwnerMonthlyStatementsDto,
  UpdateOwnerMonthlyStatementDto,
} from './dto/owner-statement.dto';
import { OwnerMonthlyStatementsService } from './owner-monthly-statements.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.ADMIN)
@Controller('owner-monthly-statements')
export class OwnerMonthlyStatementsController {
  constructor(
    private readonly statementsService: OwnerMonthlyStatementsService,
  ) {}

  @Post('generate')
  generate(
    @Body() dto: GenerateOwnerStatementsDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.statementsService.generate(dto, user);
  }

  @Get('totals')
  totals(
    @Query() query: QueryOwnerMonthlyStatementsDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.statementsService.getTotals(query, user.role);
  }

  @Get()
  findAll(
    @Query() query: QueryOwnerMonthlyStatementsDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.statementsService.findAll(query, user.role);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.statementsService.findOne(id, user.role);
  }

  @Post(':id/finalize')
  finalize(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.statementsService.finalize(id, user);
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOwnerMonthlyStatementDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.statementsService.update(id, dto, user);
  }
}
