import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class RenewMonthlyAgreementDto {
  /** Start date of the new agreement (usually the day after old one ends). */
  @IsDateString()
  agreementStart: string;

  @IsOptional()
  @IsDateString()
  agreementEnd?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(28)
  billingDay?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  securityDeposit?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
