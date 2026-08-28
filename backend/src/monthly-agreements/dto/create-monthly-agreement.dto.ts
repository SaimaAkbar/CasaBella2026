import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class CreateMonthlyAgreementDto {
  @IsUUID()
  tenantId: string;

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

  /** When true, activate immediately instead of DRAFT. Default true. */
  @IsOptional()
  @IsBoolean()
  activate?: boolean;
}
