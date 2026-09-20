import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import {
  BookingStatus,
  OnlinePaymentStatus,
  PaymentState,
} from '../../../generated/prisma/client';

export class QueryOnlineBookingsDto {
  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;

  @IsOptional()
  @IsEnum(BookingStatus)
  bookingStatus?: BookingStatus;

  @IsOptional()
  @IsEnum(PaymentState)
  paymentState?: PaymentState;

  @IsOptional()
  @IsEnum(OnlinePaymentStatus)
  onlinePaymentStatus?: OnlinePaymentStatus;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  range?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsString()
  propertyId?: string;
}
