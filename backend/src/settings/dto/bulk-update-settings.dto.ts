import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

class BulkSettingItemDto {
  @IsString()
  @IsNotEmpty()
  key!: string;

  @IsNotEmpty()
  value!: unknown;
}

export class BulkUpdateSettingsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BulkSettingItemDto)
  settings!: BulkSettingItemDto[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
