import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
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
import { SalaryPaymentStatus } from '../../../generated/prisma/client';

export class QuerySalaryRecordsDto {
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  salaryMonth?: number;

  @ValidateIf(
    (q: QuerySalaryRecordsDto) =>
      q.salaryMonth !== undefined || q.salaryYear !== undefined,
  )
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  salaryYear?: number;

  @IsOptional()
  @IsEnum(SalaryPaymentStatus)
  paymentStatus?: SalaryPaymentStatus;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  finalized?: boolean;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  search?: string;
}
