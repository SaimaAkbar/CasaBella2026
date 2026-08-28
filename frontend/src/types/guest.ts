export type Guest = {
  id: string;
  fullName: string;
  phone: string;
  alternatePhone?: string | null;
  email?: string | null;
  cnic?: string | null;
  cnicOrPassport?: string | null;
  address?: string | null;
  nationality?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  vehicleNumber?: string | null;
  notes?: string | null;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type GuestInput = {
  fullName: string;
  phone: string;
  alternatePhone?: string;
  email?: string;
  cnic?: string;
  cnicOrPassport?: string;
  address?: string;
  nationality?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  vehicleNumber?: string;
  notes?: string;
};

export type GuestFormValues = {
  fullName: string;
  phone: string;
  alternatePhone: string;
  email: string;
  cnicOrPassport: string;
  address: string;
  nationality: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  vehicleNumber: string;
  notes: string;
};
