import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class GenerateMonthlySalaryDto {
  @Transform(({ obj }: { obj: Record<string, unknown> }) =>
    obj.month ?? obj.salaryMonth,
  )
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month: number;

  @Transform(({ obj }: { obj: Record<string, unknown> }) =>
    obj.year ?? obj.salaryYear,
  )
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year: number;

  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @IsString()
  department?: string;
}
