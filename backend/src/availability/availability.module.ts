import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { UnitAvailabilityService } from './unit-availability.service';

@Module({
  imports: [PrismaModule],
  providers: [UnitAvailabilityService],
  exports: [UnitAvailabilityService],
})
export class AvailabilityModule {}
