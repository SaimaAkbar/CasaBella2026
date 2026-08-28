import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { BookingType } from '../../../generated/prisma/client';

export class QueryBookingEligibleUnitsDto {
  @IsUUID()
  propertyId: string;

  @IsOptional()
  @IsEnum(BookingType)
  bookingType?: BookingType;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
