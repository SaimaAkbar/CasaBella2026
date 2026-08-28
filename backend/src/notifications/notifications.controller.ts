import {
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
import {
  NotificationPriority,
  Role,
} from '../../generated/prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import type { AuthUser } from '../common/types/auth-user.type';
import { NotificationsService } from './notifications.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.RECEPTIONIST)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  findMine(
    @CurrentUser() user: AuthUser,
    @Query('unreadOnly') unreadOnly?: string,
    @Query('priority') priority?: NotificationPriority,
    @Query('module') module?: string,
    @Query('search') search?: string,
    @Query('take') take?: string,
  ) {
    return this.notificationsService.findMine(user.id, {
      unreadOnly: unreadOnly === 'true' || unreadOnly === '1',
      priority,
      module,
      search,
      take: take ? Number(take) : undefined,
    });
  }

  @Get('unread-count')
  unreadCount(@CurrentUser() user: AuthUser) {
    return this.notificationsService.unreadCount(user.id).then((count) => ({
      count,
    }));
  }

  @Get('summary')
  summary(@CurrentUser() user: AuthUser) {
    return this.notificationsService.dashboardSummary(user.id);
  }

  @Patch('read-all')
  markAllReadPatch(@CurrentUser() user: AuthUser) {
    return this.notificationsService.markAllRead(user.id);
  }

  @Post('read-all')
  markAllReadPost(@CurrentUser() user: AuthUser) {
    return this.notificationsService.markAllRead(user.id);
  }

  @Patch(':id/read')
  markReadPatch(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.notificationsService.markRead(id, user.id);
  }

  @Post(':id/read')
  markReadPost(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.notificationsService.markRead(id, user.id);
  }

  @Delete('expired')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  deleteExpired() {
    return this.notificationsService.deleteExpired();
  }
}
