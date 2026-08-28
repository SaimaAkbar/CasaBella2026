import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class GenerateMonthlyBillDto {
  @IsUUID()
  agreementId: string;

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

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  electricityCharges?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  maintenanceCharges?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  societyCharges?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  cleaningCharges?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  laundryCharges?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  waterCharges?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  otherCharges?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  previousBalance?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  credits?: number;
}

export class GenerateMonthlyBillsBatchDto {
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

  @IsOptional()
  @IsBoolean()
  onlyMissing?: boolean;
}

export class QueryMonthlyBillsDto {
  @IsOptional()
  @IsUUID()
  agreementId?: string;

  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  billingMonth?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  billingYear?: number;
}
