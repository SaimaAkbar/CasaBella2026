import { Module } from '@nestjs/common';
import { InventoryCategoriesController } from './inventory-categories.controller';
import { InventoryCategoriesService } from './inventory-categories.service';

@Module({
  controllers: [InventoryCategoriesController],
  providers: [InventoryCategoriesService],
  exports: [InventoryCategoriesService],
})
export class InventoryCategoriesModule {}
