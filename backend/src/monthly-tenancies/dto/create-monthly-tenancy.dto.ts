import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { MonthlyOccupancyState } from '../../../generated/prisma/client';

export class CreateMonthlyTenancyDto {
  @IsUUID()
  tenantId: string;

  /** Required for new assignments under the agreement workflow. */
  @IsUUID()
  agreementId: string;

  /** Used to enforce property → unit consistency on assign. */
  @IsUUID()
  propertyId: string;

  @IsUUID()
  unitId: string;

  @IsDateString()
  agreementStart: string;

  @IsOptional()
  @IsDateString()
  agreementEnd?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  securityDeposit?: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  monthlyRent: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  maintenanceCharges?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  laundryCharges?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  cleaningCharges?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  waterCharges?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  societyCharges?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  electricityCharges?: number;

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
  totalReceived?: number;

  /** Super Admin only — allows totalReceived > totalPayable */
  @IsOptional()
  @IsBoolean()
  allowAdvance?: boolean;

  @IsEnum(MonthlyOccupancyState)
  occupancyState: MonthlyOccupancyState;

  @IsOptional()
  @IsBoolean()
  hotelUseAllowed?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}
