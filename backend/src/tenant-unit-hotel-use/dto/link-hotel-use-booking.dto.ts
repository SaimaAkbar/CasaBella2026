import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { BookingType } from '../../../generated/prisma/client';
import { CreateGuestDto } from '../../guests/dto/create-guest.dto';

/** Attach an approved hotel-use settlement to a new booking. */
export class LinkHotelUseBookingDto {
  @IsUUID()
  hotelUseId: string;

  @IsOptional()
  @IsUUID()
  guestId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateGuestDto)
  guest?: CreateGuestDto;

  @IsEnum(BookingType)
  bookingType: BookingType;

  @IsDateString()
  checkInDateTime: string;

  @IsDateString()
  checkOutDateTime: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  hourlyRate?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  dailyRate?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  numberOfHours?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  numberOfDays?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  numberOfGuests?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  electricityCharges?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  cleaningCharges?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  laundryCharges?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  maintenanceCharges?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  otherCharges?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  discountAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  receivedAmount?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  bookingSource?: string;
}
