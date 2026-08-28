import { PartialType } from '@nestjs/mapped-types';
import { CreateInventoryCategoryDto } from './create-inventory-category.dto';

export class UpdateInventoryCategoryDto extends PartialType(
  CreateInventoryCategoryDto,
) {}
