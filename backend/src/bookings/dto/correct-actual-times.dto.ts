import { Type } from 'class-transformer';
import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class CorrectActualTimesDto {
  @IsOptional()
  @IsDateString()
  actualCheckInAt?: string;

  @IsOptional()
  @IsDateString()
  actualCheckOutAt?: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  reason: string;
}
