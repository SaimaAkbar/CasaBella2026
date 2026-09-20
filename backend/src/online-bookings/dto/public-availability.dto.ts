import { IsDateString, IsUUID } from 'class-validator';

export class PublicAvailabilityDto {
  @IsUUID()
  unitId: string;

  @IsDateString()
  checkInDateTime: string;

  @IsDateString()
  checkOutDateTime: string;
}
