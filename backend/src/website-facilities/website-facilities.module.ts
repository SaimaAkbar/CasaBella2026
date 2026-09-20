import { Module } from '@nestjs/common';
import {
  PublicWebsiteFacilitiesController,
  WebsiteFacilitiesController,
} from './website-facilities.controller';
import { WebsiteFacilitiesService } from './website-facilities.service';

@Module({
  controllers: [
    WebsiteFacilitiesController,
    PublicWebsiteFacilitiesController,
  ],
  providers: [WebsiteFacilitiesService],
  exports: [WebsiteFacilitiesService],
})
export class WebsiteFacilitiesModule {}
