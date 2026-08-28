import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { PaymentMethod } from '../../../generated/prisma/client';

export class RecordExpensePaymentDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amountPaid: number;

  @IsDateString()
  paymentDate: string;

  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

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

export class BulkCreateExpensesDto {
  @IsUUID()
  categoryId: string;

  @IsUUID()
  propertyId: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  unitIds: string[];

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;

  /** When true, `amount` is a total split equally across selected units. */
  @IsOptional()
  @IsBoolean()
  splitTotal?: boolean;

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
  expenseDate?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  vendorName?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;
}

export class MonthlySummaryQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month: number;

  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year: number;

  @IsOptional()
  @IsUUID()
  propertyId?: string;
}
