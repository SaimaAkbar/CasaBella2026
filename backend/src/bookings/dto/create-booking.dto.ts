import { Type } from 'class-transformer';
import {
  IsBoolean,
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

export class CreateBookingDto {
  @IsOptional()
  @IsUUID()
  guestId?: string;

  /** Inline guest creation when guestId is omitted */
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateGuestDto)
  guest?: CreateGuestDto;

  /** Used to enforce property → unit consistency on booking create. */
  @IsUUID()
  propertyId!: string;

  @IsUUID()
  unitId!: string;

  @IsEnum(BookingType)
  bookingType!: BookingType;

  @IsDateString()
  checkInDateTime!: string;

  @IsDateString()
  checkOutDateTime!: string;

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
  @IsInt()
  @Min(0)
  adults?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  children?: number;

  @IsOptional()
  @IsString()
  bookingSource?: string;

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

  /** Guest-bill amenity description. Not an operating expense. */
  @IsOptional()
  @IsString()
  otherChargesDescription?: string;

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

  /** Super Admin only — allows receivedAmount > totalAmount */
  @IsOptional()
  @IsBoolean()
  allowAdvance?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;

  /**
   * Required when booking a unit that has an active monthly tenancy.
   * Must reference an APPROVED TenantUnitHotelUse without an existing booking.
   */
  @IsOptional()
  @IsUUID()
  hotelUseId?: string;
}
