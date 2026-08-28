import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export const UNIT_MONTH_STATUSES = [
  'NO_CHARGE',
  'PAID',
  'PARTIAL',
  'UNPAID',
  'OVERDUE',
] as const;

export type UnitMonthStatus = (typeof UNIT_MONTH_STATUSES)[number];

export class PropertyMonthViewQueryDto {
  @IsUUID()
  propertyId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;

  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year!: number;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(UNIT_MONTH_STATUSES)
  status?: UnitMonthStatus;
}
