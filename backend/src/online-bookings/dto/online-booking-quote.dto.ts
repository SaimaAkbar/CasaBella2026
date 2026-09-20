import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsUUID,
  Min,
} from 'class-validator';

export class OnlineBookingQuoteDto {
  @IsUUID()
  unitId: string;

  @IsDateString()
  checkInDateTime: string;

  @IsDateString()
  checkOutDateTime: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  adults?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  children?: number;
}
