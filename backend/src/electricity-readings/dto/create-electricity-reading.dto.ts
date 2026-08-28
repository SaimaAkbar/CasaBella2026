import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class CreateElectricityReadingDto {
  @IsUUID()
  propertyId: string;

  @IsOptional()
  @IsUUID()
  unitId?: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  previousUnits: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  currentUnits: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  ratePerUnit?: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  billingMonth: number;

  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  billingYear: number;

  @IsDateString()
  readingDate: string;

  @IsOptional()
  @IsString()
  notes?: string;

  /** Super Admin only — required when overriding duplicate month/year reading */
  @IsOptional()
  @IsString()
  @MinLength(3)
  overrideReason?: string;
}
