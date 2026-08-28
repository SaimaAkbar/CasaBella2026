import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import {
  MonthlyOccupancyState,
  MonthlyTenancyStatus,
} from '../../../generated/prisma/client';

export class QueryMonthlyTenanciesDto {
  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @IsOptional()
  @IsUUID()
  agreementId?: string;

  @IsOptional()
  @IsUUID()
  propertyId?: string;

  @IsOptional()
  @IsUUID()
  unitId?: string;

  @IsOptional()
  @IsEnum(MonthlyTenancyStatus)
  tenancyStatus?: MonthlyTenancyStatus;

  @IsOptional()
  @IsEnum(MonthlyOccupancyState)
  occupancyState?: MonthlyOccupancyState;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;

  @ValidateIf(
    (query: QueryMonthlyTenanciesDto) =>
      query.month !== undefined || query.year !== undefined,
  )
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  @Type(() => String)
  search?: string;
}
