import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { SettlementType } from '../../../generated/prisma/client';

export class CreateTenantUnitHotelUseDto {
  @IsUUID()
  monthlyTenancyId!: string;

  @IsEnum(SettlementType)
  settlementType!: SettlementType;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  totalGuestCharge!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  tenantShare?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  organizationShare?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  tenantSharePercentage?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  organizationSharePercentage?: number;

  @IsOptional()
  @IsString()
  reason?: string;

  /** Required for RENT_CREDIT settlement period. */
  @ValidateIf((o: CreateTenantUnitHotelUseDto) => o.settlementType === SettlementType.RENT_CREDIT)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  billingMonth?: number;

  @ValidateIf((o: CreateTenantUnitHotelUseDto) => o.settlementType === SettlementType.RENT_CREDIT)
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  billingYear?: number;

  @IsOptional()
  @IsDateString()
  plannedCheckInDateTime?: string;

  @IsOptional()
  @IsDateString()
  plannedCheckOutDateTime?: string;
}
