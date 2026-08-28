import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsNumber,
  IsOptional,
  IsUUID,
  Min,
} from 'class-validator';

/** Change unit = end current assignment + create new (never overwrite unitId). */
export class ChangeUnitAssignmentDto {
  @IsUUID()
  propertyId: string;

  @IsUUID()
  unitId: string;

  @IsOptional()
  @IsDateString()
  assignmentStart?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  monthlyRent?: number;

  @IsOptional()
  @IsBoolean()
  hotelUseAllowed?: boolean;
}
