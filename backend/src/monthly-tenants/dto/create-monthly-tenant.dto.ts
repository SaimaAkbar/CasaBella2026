import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  ValidateIf,
} from 'class-validator';

/** Trim strings; empty optional values become undefined (stored as null). */
function emptyToUndefined({ value }: { value: unknown }): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

export class CreateMonthlyTenantDto {
  @Transform(emptyToUndefined)
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @Transform(emptyToUndefined)
  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  alternatePhone?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsEmail()
  email?: string;

  /** Pakistani CNIC: 12345-1234567-1 or 13 digits */
  @IsOptional()
  @Transform(emptyToUndefined)
  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsString()
  @Matches(/^(\d{5}-\d{7}-\d{1}|\d{13})$/, {
    message: 'CNIC must be 12345-1234567-1 or 13 digits',
  })
  cnic?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  address?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  emergencyContactName?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  emergencyContactPhone?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  notes?: string;
}
