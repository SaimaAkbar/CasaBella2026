import { Module } from '@nestjs/common';
import { ExpensesModule } from '../expenses/expenses.module';
import { RoomAssetsController } from './room-assets.controller';
import { RoomAssetsService } from './room-assets.service';

@Module({
  imports: [ExpensesModule],
  controllers: [RoomAssetsController],
  providers: [RoomAssetsService],
  exports: [RoomAssetsService],
})
export class RoomAssetsModule {}
