import { Module } from '@nestjs/common';
import { MonthlyTenantsController } from './monthly-tenants.controller';
import { MonthlyTenantsService } from './monthly-tenants.service';

@Module({
  controllers: [MonthlyTenantsController],
  providers: [MonthlyTenantsService],
  exports: [MonthlyTenantsService],
})
export class MonthlyTenantsModule {}
