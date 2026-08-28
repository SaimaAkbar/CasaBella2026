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

/** Booking-type filter including MONTHLY (tenancy domain, not BookingType enum). */
export const DASHBOARD_BOOKING_TYPE_FILTERS = [
  'HOURLY',
  'DAILY',
  'MONTHLY',
] as const;
export type DashboardBookingTypeFilter =
  (typeof DASHBOARD_BOOKING_TYPE_FILTERS)[number];

export class DashboardSummaryQueryDto {
  /** Exact calendar day (YYYY-MM-DD). */
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  today?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;

  @ValidateIf(
    (query: DashboardSummaryQueryDto) =>
      query.month !== undefined || query.year !== undefined,
  )
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  /** Alias for dateFrom (client convenience). */
  @IsOptional()
  @IsDateString()
  startDate?: string;

  /** Alias for dateTo (client convenience). */
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsUUID()
  propertyId?: string;

  /** Filter to a specific apartment/unit id. */
  @IsOptional()
  @IsUUID()
  apartmentId?: string;

  @IsOptional()
  @IsUUID()
  unitId?: string;

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
  @IsString()
  @Type(() => String)
  search?: string;
}
