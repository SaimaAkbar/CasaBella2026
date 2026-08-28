import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { RoomAssetCondition } from '../../../generated/prisma/client';

export class ChangeRoomAssetConditionDto {
  @IsEnum(RoomAssetCondition)
  newCondition: RoomAssetCondition;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  quantityAffected?: number;

  @IsDateString()
  actionDate: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  repairCost?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  replacementCost?: number;

  @IsString()
  @MinLength(3)
  reason: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
