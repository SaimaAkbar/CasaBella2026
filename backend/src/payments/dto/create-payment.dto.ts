import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateIf,
} from 'class-validator';
import {
  PaymentForType,
  PaymentMethod,
} from '../../../generated/prisma/client';

export class CreatePaymentDto {
  @IsEnum(PaymentForType)
  paymentForType: PaymentForType;

  @ValidateIf((dto: CreatePaymentDto) => dto.paymentForType === PaymentForType.BOOKING)
  @IsUUID()
  bookingId?: string;

  @ValidateIf(
    (dto: CreatePaymentDto) =>
      dto.paymentForType === PaymentForType.MONTHLY_TENANCY,
  )
  @IsUUID()
  monthlyTenancyId?: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;

  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @IsOptional()
  @IsString()
  transactionReference?: string;

  @IsDateString()
  paymentDate: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  proofAttachmentUrl?: string;

  /** Super Admin only — allows payment above remaining balance */
  @IsOptional()
  @IsString()
  overpayReason?: string;
}
