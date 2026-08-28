import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { Role, SettingCategory } from '../../generated/prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import type { AuthUser } from '../common/types/auth-user.type';
import { extractAuditContext } from '../common/utils/request-meta';
import { BulkUpdateSettingsDto } from './dto/bulk-update-settings.dto';
import { UpdateSettingDto } from './dto/update-setting.dto';
import { SettingsService } from './settings.service';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('public')
  getPublic() {
    return this.settingsService.getPublicSettings();
  }

  @Get('categories')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  categories() {
    return this.settingsService.listCategories();
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('category') category?: SettingCategory,
  ) {
    return this.settingsService.findAll(user, category);
  }

  @Get(':key')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  findOne(@Param('key') key: string, @CurrentUser() user: AuthUser) {
    return this.settingsService.findOne(key, user);
  }

  @Patch('bulk')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  updateBulk(
    @Body() dto: BulkUpdateSettingsDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.settingsService.updateBulk(dto.settings, user, {
      reason: dto.reason,
      context: extractAuditContext(req),
    });
  }

  @Patch(':key')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  updateOne(
    @Param('key') key: string,
    @Body() dto: UpdateSettingDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.settingsService.updateOne(key, dto.value, user, {
      reason: dto.reason,
      context: extractAuditContext(req),
    });
  }

  @Post('reset/:category')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  resetCategory(
    @Param('category') category: SettingCategory,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.settingsService.resetCategory(
      category,
      user,
      extractAuditContext(req),
    );
  }
}
