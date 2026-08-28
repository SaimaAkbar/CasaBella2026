import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import {
  PaymentMethod,
  SalaryAdjustmentDirection,
  SalaryTransactionType,
} from '../../../generated/prisma/client';

export class CreateSalaryTransactionDto {
  @ValidateIf((dto: CreateSalaryTransactionDto) => !dto.salaryMonth)
  @IsUUID()
  salaryRecordId?: string;

  @IsUUID()
  employeeId: string;

  @ValidateIf((dto: CreateSalaryTransactionDto) => !dto.salaryRecordId)
  @Transform(({ obj }: { obj: Record<string, unknown> }) =>
    obj.salaryMonth ?? obj.month,
  )
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  salaryMonth?: number;

  @ValidateIf((dto: CreateSalaryTransactionDto) => !dto.salaryRecordId)
  @Transform(({ obj }: { obj: Record<string, unknown> }) =>
    obj.salaryYear ?? obj.year,
  )
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  salaryYear?: number;

  @IsEnum(SalaryTransactionType)
  transactionType: SalaryTransactionType;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;

  @ValidateIf(
    (dto: CreateSalaryTransactionDto) =>
      dto.transactionType === SalaryTransactionType.ADJUSTMENT,
  )
  @IsEnum(SalaryAdjustmentDirection)
  adjustmentDirection?: SalaryAdjustmentDirection;

  @IsDateString()
  transactionDate: string;

  @ValidateIf(
    (dto: CreateSalaryTransactionDto) =>
      dto.transactionType === SalaryTransactionType.ADVANCE ||
      dto.transactionType === SalaryTransactionType.DEDUCTION ||
      dto.transactionType === SalaryTransactionType.BONUS ||
      dto.transactionType === SalaryTransactionType.ADJUSTMENT,
  )
  @IsString()
  @MinLength(3)
  reason?: string;

  @ValidateIf(
    (dto: CreateSalaryTransactionDto) =>
      dto.transactionType === SalaryTransactionType.SALARY_PAYMENT ||
      dto.transactionType === SalaryTransactionType.ADVANCE,
  )
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @IsOptional()
  @IsString()
  transactionReference?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
