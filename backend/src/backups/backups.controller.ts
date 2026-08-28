import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Role } from '../../generated/prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import type { AuthUser } from '../common/types/auth-user.type';
import { extractAuditContext } from '../common/utils/request-meta';
import { BackupSchedulerService } from './backup-scheduler.service';
import { BackupsService } from './backups.service';
import { RestoreBackupDto } from './dto/restore-backup.dto';
import { UpdateBackupScheduleDto } from './dto/update-backup-schedule.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
@Controller('backups')
export class BackupsController {
  constructor(
    private readonly backupsService: BackupsService,
    private readonly scheduler: BackupSchedulerService,
  ) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.backupsService.createManualBackup(
      user,
      undefined,
      extractAuditContext(req),
    );
  }

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.backupsService.list(user);
  }

  @Get('statistics')
  statistics(@CurrentUser() user: AuthUser) {
    return this.backupsService.statistics(user);
  }

  @Post('cleanup')
  cleanup(@CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.backupsService.cleanup(user, extractAuditContext(req));
  }

  @Get('schedule/status')
  scheduleStatus() {
    return this.scheduler.getStatus();
  }

  @Post('schedule')
  updateSchedule(
    @Body() dto: UpdateBackupScheduleDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.backupsService.updateScheduleSettings(
      user,
      dto,
      extractAuditContext(req),
    );
  }

  @Get(':id')
  getOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.backupsService.getOne(id, user);
  }

  @Post(':id/verify')
  verify(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.backupsService.verify(id, user);
  }

  @Get(':id/download')
  async download(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { fileName, stream } = await this.backupsService.getDownloadStream(
      id,
      user,
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${fileName}"`,
    );
    res.setHeader('Content-Type', 'application/octet-stream');
    return new StreamableFile(stream);
  }

  @Post(':id/restore')
  restore(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RestoreBackupDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.backupsService.restore(
      id,
      dto,
      user,
      extractAuditContext(req),
    );
  }

  @Delete(':id')
  delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.backupsService.delete(id, user, extractAuditContext(req));
  }
}
