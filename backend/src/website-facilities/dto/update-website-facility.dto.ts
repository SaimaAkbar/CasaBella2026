import { PartialType } from '@nestjs/mapped-types';
import { CreateWebsiteFacilityDto } from './create-website-facility.dto';

export class UpdateWebsiteFacilityDto extends PartialType(
  CreateWebsiteFacilityDto,
) {}
