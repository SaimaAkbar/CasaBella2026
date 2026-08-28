import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { Role, Status } from '../../generated/prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';
import { ResetUserPasswordDto } from './dto/reset-user-password.dto';
import { ChangeUserStatusDto } from './dto/change-user-status.dto';
import { ChangeUserRoleDto } from './dto/change-user-role.dto';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/types/auth-user.type';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  @Post()
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.remove(id);
  }

  @Patch(':id/password')
  async resetPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResetUserPasswordDto,
    @CurrentUser() actor: AuthUser,
  ) {
    if (actor.id === id) {
      throw new BadRequestException('Cannot reset your own password here');
    }

    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException('Password confirmation does not match');
    }

    const target = await this.usersService.findOne(id);
    if (target.role === Role.SUPER_ADMIN) {
      throw new BadRequestException('Cannot reset Super Admin password');
    }

    const updated = await this.usersService.resetPassword(
      id,
      dto.newPassword,
      dto.forceChangeOnNextLogin ?? false,
    );

    await this.auditLogs.write({
      module: 'USERS',
      action: 'USER_PASSWORD_RESET',
      recordId: id,
      userId: actor.id,
      role: actor.role,
      oldData: null,
      newData: null,
    });

    return updated;
  }

  @Patch(':id/status')
  async changeStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeUserStatusDto,
    @CurrentUser() actor: AuthUser,
  ) {
    if (actor.id === id) {
      throw new BadRequestException('Cannot change your own status');
    }

    const target = await this.usersService.findOne(id);
    if (target.role === Role.SUPER_ADMIN) {
      throw new BadRequestException('Cannot change Super Admin status');
    }

    const updated = await this.usersService.updateStatus(id, dto.status);

    await this.auditLogs.write({
      module: 'USERS',
      action: dto.status === Status.ACTIVE ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
      recordId: id,
      userId: actor.id,
      role: actor.role,
      oldData: null,
      newData: { status: dto.status },
    });

    return updated;
  }

  @Patch(':id/role')
  async changeRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeUserRoleDto,
    @CurrentUser() actor: AuthUser,
  ) {
    if (actor.id === id) {
      throw new BadRequestException('Cannot change your own role');
    }

    const target = await this.usersService.findOne(id);
    if (target.role === Role.SUPER_ADMIN) {
      throw new BadRequestException('Cannot change Super Admin role');
    }

    if (dto.role === Role.SUPER_ADMIN) {
      throw new BadRequestException('Cannot assign Super Admin role');
    }

    const updated = await this.usersService.updateRole(id, dto.role);

    await this.auditLogs.write({
      module: 'USERS',
      action: 'USER_ROLE_CHANGED',
      recordId: id,
      userId: actor.id,
      role: actor.role,
      oldData: { previousRole: target.role },
      newData: { role: dto.role },
    });

    return updated;
  }
}
