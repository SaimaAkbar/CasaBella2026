import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { UnitStatus, UnitType } from '../../../generated/prisma/client';
import {
  DASHBOARD_BOOKING_TYPE_FILTERS,
  type DashboardBookingTypeFilter,
} from './dashboard-summary-query.dto';

export class DashboardRoomGridQueryDto {
  @IsOptional()
  @IsUUID()
  propertyId?: string;

  @IsOptional()
  @IsUUID()
  apartmentId?: string;

  @IsOptional()
  @IsUUID()
  unitId?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  today?: boolean;

  @IsOptional()
  @IsEnum(UnitStatus)
  status?: UnitStatus;

  /** Alias for status — resolved display status from resolveUnitStatus. */
  @IsOptional()
  @IsEnum(UnitStatus)
  displayStatus?: UnitStatus;

  @IsOptional()
  @IsEnum(UnitType)
  unitType?: UnitType;

  @IsOptional()
  @IsIn(DASHBOARD_BOOKING_TYPE_FILTERS)
  bookingType?: DashboardBookingTypeFilter;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;

  @ValidateIf(
    (query: DashboardRoomGridQueryDto) =>
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
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsString()
  @Type(() => String)
  search?: string;
}
