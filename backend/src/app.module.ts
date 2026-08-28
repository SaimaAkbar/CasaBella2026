import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ApprovalsModule } from './approvals/approvals.module';
import { AuditLogsModule } from './audit-logs/audit-logs.module';
import { AuthModule } from './auth/auth.module';
import { AvailabilityModule } from './availability/availability.module';
import { BackupsModule } from './backups/backups.module';
import { BookingsModule } from './bookings/bookings.module';
import { MaintenanceGuard } from './common/guards/maintenance.guard';
import { DashboardModule } from './dashboard/dashboard.module';
import { ElectricityReadingsModule } from './electricity-readings/electricity-readings.module';
import { EmployeesModule } from './employees/employees.module';
import { ExpenseCategoriesModule } from './expense-categories/expense-categories.module';
import { ExpensesModule } from './expenses/expenses.module';
import { GuestsModule } from './guests/guests.module';
import { HealthModule } from './health/health.module';
import { InventoryCategoriesModule } from './inventory-categories/inventory-categories.module';
import { InventoryItemsModule } from './inventory-items/inventory-items.module';
import { InventoryMovementsModule } from './inventory-movements/inventory-movements.module';
import { MonthlyAgreementsModule } from './monthly-agreements/monthly-agreements.module';
import { MonthlyBillsModule } from './monthly-bills/monthly-bills.module';
import { MonthlyTenanciesModule } from './monthly-tenancies/monthly-tenancies.module';
import { MonthlyTenantsModule } from './monthly-tenants/monthly-tenants.module';
import { NotificationsModule } from './notifications/notifications.module';
import { OwnersModule } from './owners/owners.module';
import { PaymentsModule } from './payments/payments.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProfitLossModule } from './profit-loss/profit-loss.module';
import { PropertiesModule } from './properties/properties.module';
import { ReportsModule } from './reports/reports.module';
import { RoomAssetsModule } from './room-assets/room-assets.module';
import { SalaryRecordsModule } from './salary-records/salary-records.module';
import { SalaryTransactionsModule } from './salary-transactions/salary-transactions.module';
import { SettingsModule } from './settings/settings.module';
import { SystemModule } from './system/system.module';
import { TenantUnitHotelUseModule } from './tenant-unit-hotel-use/tenant-unit-hotel-use.module';
import { UnitsModule } from './units/units.module';
import { UsersModule } from './users/users.module';
import { StaffApprovalGateInterceptor } from './approvals/staff-approval-gate.interceptor';

@Module({
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: Number(process.env.THROTTLE_TTL ?? 60_000),
          limit: Number(process.env.THROTTLE_LIMIT ?? 600),
        },
      ],
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    UsersModule,
    AuthModule,
    SettingsModule,
    ApprovalsModule,
    AuditLogsModule,
    NotificationsModule,
    PropertiesModule,
    UnitsModule,
    AvailabilityModule,
    ProfitLossModule,
    ReportsModule,
    DashboardModule,
    MonthlyTenantsModule,
    MonthlyAgreementsModule,
    MonthlyTenanciesModule,
    MonthlyBillsModule,
    GuestsModule,
    BookingsModule,
    PaymentsModule,
    ExpenseCategoriesModule,
    ExpensesModule,
    ElectricityReadingsModule,
    OwnersModule,
    EmployeesModule,
    SalaryRecordsModule,
    SalaryTransactionsModule,
    InventoryCategoriesModule,
    InventoryItemsModule,
    InventoryMovementsModule,
    RoomAssetsModule,
    TenantUnitHotelUseModule,
    BackupsModule,
    SystemModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: MaintenanceGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: StaffApprovalGateInterceptor,
    },
  ],
})
export class AppModule {}
