import { Role } from '../../generated/prisma/client';

export type GuestRecord = {
  id: string;
  fullName: string;
  phone: string;
  alternatePhone: string | null;
  email: string | null;
  cnicOrPassport: string | null;
  address: string | null;
  nationality: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  vehicleNumber: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Receptionist needs identity fields required for check-in.
 * Unrelated confidential fields (e.g. address detail) stay available
 * for operational check-in; no passwords/security fields exist here.
 */
export function mapGuestForRole(guest: GuestRecord, _role: Role) {
  return {
    id: guest.id,
    fullName: guest.fullName,
    phone: guest.phone,
    alternatePhone: guest.alternatePhone,
    email: guest.email,
    cnicOrPassport: guest.cnicOrPassport,
    address: guest.address,
    nationality: guest.nationality,
    emergencyContactName: guest.emergencyContactName,
    emergencyContactPhone: guest.emergencyContactPhone,
    vehicleNumber: guest.vehicleNumber,
    notes: guest.notes,
    isActive: guest.isActive,
    createdAt: guest.createdAt,
    updatedAt: guest.updatedAt,
  };
}
