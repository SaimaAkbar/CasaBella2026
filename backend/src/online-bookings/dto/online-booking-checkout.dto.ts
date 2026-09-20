import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { CreateGuestDto } from '../../guests/dto/create-guest.dto';

export const ONLINE_PAYMENT_SELECTIONS = ['ADVANCE_50', 'FULL_100'] as const;
export type OnlinePaymentSelectionDto =
  (typeof ONLINE_PAYMENT_SELECTIONS)[number];

export class OnlineBookingCheckoutDto {
  @ValidateNested()
  @Type(() => CreateGuestDto)
  guest: CreateGuestDto;

  @IsUUID()
  unitId: string;

  @IsOptional()
  @IsUUID()
  propertyId?: string;

  @IsDateString()
  checkInDateTime: string;

  @IsDateString()
  checkOutDateTime: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  adults: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  children: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  numberOfGuests: number;

  /** Server recalculates charge from booking total — never trust client amounts. */
  @IsIn(ONLINE_PAYMENT_SELECTIONS)
  paymentSelection: OnlinePaymentSelectionDto;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  idempotencyKey?: string;
}
