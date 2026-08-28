import { Type } from 'class-transformer';
import {
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
import {
  PaymentForType,
  PaymentMethod,
  PaymentStatus,
  PaymentTransactionType,
} from '../../../generated/prisma/client';

export class QueryPaymentsDto {
  @IsOptional()
  @IsEnum(PaymentForType)
  paymentForType?: PaymentForType;

  @IsOptional()
  @IsUUID()
  bookingId?: string;

  @IsOptional()
  @IsUUID()
  monthlyTenancyId?: string;

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @IsOptional()
  @IsEnum(PaymentTransactionType)
  transactionType?: PaymentTransactionType;

  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

  @IsOptional()
  @IsUUID()
  createdByUserId?: string;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;

  @ValidateIf(
    (query: QueryPaymentsDto) =>
      query.month !== undefined || query.year !== undefined,
  )
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @Type(() => String)
  @IsString()
  today?: string;

  @IsOptional()
  @IsString()
  @Type(() => String)
  search?: string;
}
