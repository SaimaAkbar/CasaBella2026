import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {
  ExpenseScope,
  PaymentMethod,
} from '../../../generated/prisma/client';

export enum AllocationMethod {
  EQUAL = 'EQUAL',
  CUSTOM = 'CUSTOM',
}

export class AllocationCustomAmountDto {
  @IsUUID()
  unitId: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;
}

export class AllocateToUnitsDto {
  @IsBoolean()
  enabled: boolean;

  /** When omitted/empty and enabled, all active units on the property are used. */
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  unitIds?: string[];

  @IsEnum(AllocationMethod)
  method: AllocationMethod;

  @ValidateIf(
    (dto: AllocateToUnitsDto) => dto.method === AllocationMethod.CUSTOM,
  )
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AllocationCustomAmountDto)
  customAmounts?: AllocationCustomAmountDto[];
}

export class CreateExpenseDto {
  /**
   * Required unless `expenseName` is provided (Other Expense free-type).
   * GENERAL / PROPERTY / UNIT map to General / Whole Property / Specific Unit.
   */
  @ValidateIf((dto: CreateExpenseDto) => !dto.expenseName?.trim())
  @IsUUID()
  categoryId?: string;

  /** Free-typed Other Expense name; resolved to category when saveExpenseName is true. */
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  expenseName?: string;

  /** When true with expenseName, create/reuse ExpenseCategory (no duplicate names). */
  @IsOptional()
  @IsBoolean()
  saveExpenseName?: boolean;

  @IsEnum(ExpenseScope)
  expenseScope: ExpenseScope;

  @ValidateIf(
    (dto: CreateExpenseDto) =>
      dto.expenseScope === ExpenseScope.PROPERTY ||
      dto.expenseScope === ExpenseScope.UNIT,
  )
  @IsUUID()
  propertyId?: string;

  @ValidateIf((dto: CreateExpenseDto) => dto.expenseScope === ExpenseScope.UNIT)
  @IsUUID()
  unitId?: string;

  @ValidateIf(
    (dto: CreateExpenseDto) => dto.expenseScope === ExpenseScope.BOOKING,
  )
  @IsUUID()
  bookingId?: string;

  @ValidateIf(
    (dto: CreateExpenseDto) =>
      dto.expenseScope === ExpenseScope.MONTHLY_TENANCY,
  )
  @IsUUID()
  monthlyTenancyId?: string;

  @ValidateIf(
    (dto: CreateExpenseDto) => dto.expenseScope === ExpenseScope.EMPLOYEE,
  )
  @IsUUID()
  employeeId?: string;

  @IsDateString()
  expenseDate: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  paidAmount?: number;

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @IsOptional()
  @IsString()
  vendorName?: string;

  @IsOptional()
  @IsString()
  referenceNumber?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  receiptUrl?: string;

  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  /** Rent / recurring metadata: billingMonth, billingYear, dueDate, paidDate, payeeName, notes */
  @IsOptional()
  @IsObject()
  metadata?: {
    billingMonth?: number;
    billingYear?: number;
    dueDate?: string;
    paidDate?: string;
    payeeName?: string;
    notes?: string;
  };

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  billingMonth?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  billingYear?: number;

  /**
   * Optional WHOLE_PROPERTY (PROPERTY) allocation to apartments.
   * Default OFF — do not auto-split. When enabled, parent is excludeFromFinancials.
   */
  @IsOptional()
  @ValidateNested()
  @Type(() => AllocateToUnitsDto)
  allocateToUnits?: AllocateToUnitsDto;
}
