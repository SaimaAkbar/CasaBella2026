import { PartialType } from '@nestjs/mapped-types';
import { CreateMonthlyTenantDto } from './create-monthly-tenant.dto';

export class UpdateMonthlyTenantDto extends PartialType(
  CreateMonthlyTenantDto,
) {}
