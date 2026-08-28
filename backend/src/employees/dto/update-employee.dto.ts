import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { CreateEmployeeDto } from './create-employee.dto';

export class UpdateEmployeeDto extends PartialType(CreateEmployeeDto) {
  @ValidateIf((dto: UpdateEmployeeDto) => dto.monthlySalary !== undefined)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  salaryEffectiveMonth?: number;

  @ValidateIf((dto: UpdateEmployeeDto) => dto.monthlySalary !== undefined)
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  salaryEffectiveYear?: number;

  @ValidateIf((dto: UpdateEmployeeDto) => dto.monthlySalary !== undefined)
  @IsString()
  @MinLength(3)
  salaryChangeReason?: string;
}
