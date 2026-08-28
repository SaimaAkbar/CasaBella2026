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
  BookingStatus,
  BookingType,
  PaymentState,
} from '../../../generated/prisma/client';

export class QueryBookingsDto {
  @IsOptional()
  @IsUUID()
  propertyId?: string;

  @IsOptional()
  @IsUUID()
  unitId?: string;

  @IsOptional()
  @IsUUID()
  guestId?: string;

  @IsOptional()
  @IsEnum(BookingType)
  bookingType?: BookingType;

  @IsOptional()
  @IsEnum(BookingStatus)
  bookingStatus?: BookingStatus;

  @IsOptional()
  @IsEnum(PaymentState)
  paymentState?: PaymentState;

  @IsOptional()
  @IsDateString()
  checkInDate?: string;

  @IsOptional()
  @IsDateString()
  checkOutDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;

  @ValidateIf(
    (query: QueryBookingsDto) =>
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

  /** Shortcut for today's check-ins / operational day filter */
  @IsOptional()
  @Type(() => String)
  @IsString()
  today?: string;

  @IsOptional()
  @IsString()
  @Type(() => String)
  search?: string;
}
