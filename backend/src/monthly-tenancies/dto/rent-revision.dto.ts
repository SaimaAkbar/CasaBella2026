import { Type } from 'class-transformer';
import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class RentRevisionDto {
  /** New monthly rent amount. Must differ from the current rent. */
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  newRent: number;

  /**
   * ISO date string for the first day of the billing period where newRent applies.
   * Bills already generated before this date must not be changed.
   */
  @IsDateString()
  effectiveFrom: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
