import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';
import { RoomAssetCondition } from '../../../generated/prisma/client';

export class CreateRoomAssetDto {
  @IsUUID()
  propertyId: string;

  @IsUUID()
  unitId: string;

  @IsString()
  @MinLength(2)
  itemName: string;

  @IsOptional()
  @IsString()
  category?: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  quantity: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  purchaseCost?: number;

  @IsDateString()
  assignedDate: string;

  @IsOptional()
  @IsEnum(RoomAssetCondition)
  condition?: RoomAssetCondition;

  @IsOptional()
  @IsString()
  serialNumber?: string;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
