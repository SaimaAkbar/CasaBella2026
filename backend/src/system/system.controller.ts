import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { Role } from '../../generated/prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import type { AuthUser } from '../common/types/auth-user.type';
import { extractAuditContext } from '../common/utils/request-meta';
import { SettingsService } from '../settings/settings.service';

class MaintenanceMessageDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  message?: string;
}

@Controller('system')
export class SystemController {
  constructor(private readonly settings: SettingsService) {}

  @Get('maintenance/status')
  async status() {
    const enabled = await this.settings.getBoolean(
      'system.maintenanceMode',
      false,
    );
    const message = await this.settings.getString(
      'system.maintenanceMessage',
      'System is under maintenance. Please try again later.',
    );
    return { enabled, message };
  }

  @Post('maintenance/enable')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  async enable(
    @Body() dto: MaintenanceMessageDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    if (dto.message) {
      await this.settings.updateOne(
        'system.maintenanceMessage',
        dto.message,
        user,
        { reason: 'Maintenance enabled', context: extractAuditContext(req) },
      );
    }
    await this.settings.updateOne('system.maintenanceMode', true, user, {
      reason: 'Maintenance enabled',
      context: extractAuditContext(req),
    });
    return this.status();
  }

  @Post('maintenance/disable')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  async disable(@CurrentUser() user: AuthUser, @Req() req: Request) {
    await this.settings.updateOne('system.maintenanceMode', false, user, {
      reason: 'Maintenance disabled',
      context: extractAuditContext(req),
    });
    return this.status();
  }
}
