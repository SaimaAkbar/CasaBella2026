import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import {
  PaymentForType,
  PaymentMethod,
} from '../../../generated/prisma/client';

export class AdjustmentPaymentDto {
  @IsEnum(PaymentForType)
  paymentForType: PaymentForType;

  @ValidateIf(
    (dto: AdjustmentPaymentDto) => dto.paymentForType === PaymentForType.BOOKING,
  )
  @IsUUID()
  bookingId?: string;

  @ValidateIf(
    (dto: AdjustmentPaymentDto) =>
      dto.paymentForType === PaymentForType.MONTHLY_TENANCY,
  )
  @IsUUID()
  monthlyTenancyId?: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;

  @IsIn(['CREDIT', 'DEBIT'])
  adjustmentDirection: 'CREDIT' | 'DEBIT';

  @IsString()
  @MinLength(3)
  reason: string;

  @IsDateString()
  paymentDate: string;

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @IsOptional()
  @IsString()
  notes?: string;
}
