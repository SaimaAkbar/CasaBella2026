import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { ONLINE_PAYMENT_SELECTIONS } from './online-booking-checkout.dto';

export class SubmitBankTransferDto {
  @IsString()
  @IsNotEmpty()
  bookingNumber: string;

  @IsIn(ONLINE_PAYMENT_SELECTIONS)
  paymentSelection: (typeof ONLINE_PAYMENT_SELECTIONS)[number];

  /** Display-only claim; server recalculates expected amount and compares. */
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  submittedAmount: number;

  @IsDateString()
  transferDate: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  transactionReference: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  senderName: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  senderBank: string;
}

export class RejectBankTransferDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  rejectionReason: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  staffNotes?: string;
}

export class VerifyBankTransferDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  staffNotes?: string;
}
