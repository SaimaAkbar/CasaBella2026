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
import {
  CreateOwnerUnitAssignmentDto,
  EndOwnerUnitAssignmentDto,
  QueryOwnerUnitAssignmentsDto,
  ReviseOwnerUnitAssignmentDto,
  UpdateOwnerUnitAssignmentDto,
} from './dto/owner-unit-assignment.dto';
import { OwnerUnitAssignmentsService } from './owner-unit-assignments.service';

/**
 * Ownership agreements (product name: OwnerUnitAgreement).
 * Table/Prisma model remains OwnerUnitAssignment for FK stability.
 * Alias route: also registered as owner-unit-agreements below via same controller path pattern.
 */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
@Controller(['owner-unit-assignments', 'owner-unit-agreements'])
export class OwnerUnitAssignmentsController {
  constructor(
    private readonly assignmentsService: OwnerUnitAssignmentsService,
  ) {}

  @Post()
  create(
    @Body() dto: CreateOwnerUnitAssignmentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.assignmentsService.create(dto, user);
  }

  @Get()
  findAll(
    @Query() query: QueryOwnerUnitAssignmentsDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.assignmentsService.findAll(query, user.role);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.assignmentsService.findOne(id, user.role);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOwnerUnitAssignmentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.assignmentsService.update(id, dto, user);
  }

  @Post(':id/end')
  end(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EndOwnerUnitAssignmentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.assignmentsService.end(id, dto, user);
  }

  @Post(':id/revise')
  @Roles(Role.SUPER_ADMIN)
  revise(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviseOwnerUnitAssignmentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.assignmentsService.revise(id, dto, user);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN)
  archive(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.assignmentsService.archive(id, user);
  }
}
