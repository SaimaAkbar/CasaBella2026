import { Module } from '@nestjs/common';
import { BookingsModule } from '../bookings/bookings.module';
import { ElectricityReadingsModule } from '../electricity-readings/electricity-readings.module';
import { EmployeesModule } from '../employees/employees.module';
import { ExpensesModule } from '../expenses/expenses.module';
import { InventoryItemsModule } from '../inventory-items/inventory-items.module';
import { InventoryMovementsModule } from '../inventory-movements/inventory-movements.module';
import { MonthlyTenanciesModule } from '../monthly-tenancies/monthly-tenancies.module';
import { PaymentsModule } from '../payments/payments.module';
import { ProfitLossModule } from '../profit-loss/profit-loss.module';
import { RoomAssetsModule } from '../room-assets/room-assets.module';
import { SalaryRecordsModule } from '../salary-records/salary-records.module';
import { ReportExportService } from './export.service';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [
    BookingsModule,
    PaymentsModule,
    ExpensesModule,
    ElectricityReadingsModule,
    MonthlyTenanciesModule,
    EmployeesModule,
    SalaryRecordsModule,
    InventoryItemsModule,
    InventoryMovementsModule,
    RoomAssetsModule,
    ProfitLossModule,
  ],
  controllers: [ReportsController],
  providers: [ReportsService, ReportExportService],
  exports: [ReportsService],
})
export class ReportsModule {}
