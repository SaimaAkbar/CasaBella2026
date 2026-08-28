import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class InitializeElectricityBillDto {
  @IsUUID()
  propertyId: string;

  @IsUUID()
  unitId: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  previousReading: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  currentReading: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  ratePerUnit?: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  billingMonth: number;

  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  billingYear: number;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsDateString()
  readingDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class GenerateElectricityMonthDto {
  @IsUUID()
  propertyId: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  billingMonth: number;

  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  billingYear: number;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  ratePerUnit?: number;
}

export class EnterCurrentReadingDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  currentReading: number;

  @IsOptional()
  @IsDateString()
  readingDate?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CorrectElectricityReadingDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  previousReading?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  currentReading?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  ratePerUnit?: number;

  @IsString()
  reason: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}

export class RecordElectricityPaymentDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amountPaid: number;

  @IsDateString()
  paymentDate: string;

  @IsString()
  paymentMethod: string;

  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  @IsString()
  transactionReference?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
