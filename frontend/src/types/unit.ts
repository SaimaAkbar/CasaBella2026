import type { UnitStatus, UnitType } from './dashboard';

export type { UnitStatus, UnitType };

export type Unit = {
  id: string;
  unitNumber: string;
  unitType: UnitType;
  floor: number | null;
  bedrooms?: number | null;
  status: UnitStatus;
  isActive: boolean;
  monthlyRent?: string | null;
  dailyRate?: string | null;
  hourlyRate?: string | null;
  notes?: string | null;
  propertyId: string;
  property?: { id: string; name: string };
};

export type UnitInput = {
  propertyId: string;
  unitNumber: string;
  unitType: UnitType;
  floor?: number;
  bedrooms?: number;
  monthlyRent?: number;
  dailyRate?: number;
  hourlyRate?: number;
  status?: UnitStatus;
  notes?: string;
  isActive?: boolean;
};

export type UnitFormValues = {
  propertyId: string;
  unitNumber: string;
  unitType: UnitType | '';
  floor: string;
  bedrooms: string;
  monthlyRent: string;
  dailyRate: string;
  hourlyRate: string;
  status: UnitStatus;
  notes: string;
  isActive: boolean;
};

export type UnitQuery = {
  propertyId?: string;
  unitType?: UnitType | '';
  status?: UnitStatus | '';
  isActive?: boolean | '';
  search?: string;
};
