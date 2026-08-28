import { Module, OnModuleInit } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

@Module({
  imports: [AuditLogsModule],
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule implements OnModuleInit {
  constructor(private readonly settingsService: SettingsService) {}

  async onModuleInit() {
    await this.settingsService.ensureDefaultsSeeded();
  }
}
