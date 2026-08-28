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
} from 'class-validator';
import { MonthlyAgreementStatus } from '../../../generated/prisma/client';

export class UpdateMonthlyAgreementDto {
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

export class QueryMonthlyAgreementsDto {
  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @IsOptional()
  @IsEnum(MonthlyAgreementStatus)
  status?: MonthlyAgreementStatus;

  @IsOptional()
  @IsString()
  search?: string;
}
