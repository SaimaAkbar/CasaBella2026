import { EmployeeStatus, Prisma } from '../../generated/prisma/client';

type EmployeeRecord = {
  id: string;
  employeeCode: string;
  fullName: string;
  fatherOrSpouseName: string | null;
  phone: string;
  alternatePhone: string | null;
  email: string | null;
  cnic: string | null;
  address: string | null;
  city: string | null;
  position: string;
  department: string | null;
  joiningDate: Date;
  monthlySalary: Prisma.Decimal;
  bankName: string | null;
  accountTitle: string | null;
  accountNumberOrIban: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  status: EmployeeStatus;
  notes: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

function money(value: Prisma.Decimal | null | undefined) {
  return value?.toString() ?? '0';
}

export function mapEmployee(employee: EmployeeRecord) {
  return {
    id: employee.id,
    employeeCode: employee.employeeCode,
    fullName: employee.fullName,
    fatherOrSpouseName: employee.fatherOrSpouseName,
    fatherName: employee.fatherOrSpouseName,
    phone: employee.phone,
    alternatePhone: employee.alternatePhone,
    email: employee.email,
    cnic: employee.cnic,
    address: employee.address,
    city: employee.city,
    position: employee.position,
    department: employee.department,
    joiningDate: employee.joiningDate,
    monthlySalary: money(employee.monthlySalary),
    bankName: employee.bankName,
    accountTitle: employee.accountTitle,
    accountNumberOrIban: employee.accountNumberOrIban,
    emergencyContactName: employee.emergencyContactName,
    emergencyContactPhone: employee.emergencyContactPhone,
    status: employee.status,
    notes: employee.notes,
    isActive: employee.isActive,
    createdAt: employee.createdAt,
    updatedAt: employee.updatedAt,
  };
}
