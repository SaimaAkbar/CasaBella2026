/**
 * Wipe all business/demo data, keep login users (+ system settings).
 *
 * Usage (from backend/):
 *   npx tsx prisma/wipe-business-data.ts
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

const SYSTEM_EXPENSE_CATEGORIES = [
  'Rent',
  'Electricity',
  'Maintenance',
  'Society Bill',
  'Cleaning',
  'Laundry',
  'Salary',
  'Inventory',
  'Water',
  'Gas',
  'Internet',
  'Repair',
  'Fuel',
  'Lift Bill',
  'Lift Maintenance',
  'Other',
] as const;

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  const usersBefore = await prisma.user.findMany({
    select: { email: true, role: true, fullName: true },
    orderBy: { email: 'asc' },
  });

  console.log(`Keeping ${usersBefore.length} login user(s):`);
  for (const user of usersBefore) {
    console.log(`  - ${user.email} (${user.role}) — ${user.fullName}`);
  }

  console.log('\nDeleting business data…');

  // Delete in FK-safe order (leaf tables first).
  const steps: Array<[string, () => Promise<{ count: number }>]> = [
    ['RoomAssetHistory', () => prisma.roomAssetHistory.deleteMany()],
    ['InventoryMovement', () => prisma.inventoryMovement.deleteMany()],
    ['RoomAsset', () => prisma.roomAsset.deleteMany()],
    ['InventoryItem', () => prisma.inventoryItem.deleteMany()],
    ['InventoryCategory', () => prisma.inventoryCategory.deleteMany()],
    ['SalaryTransaction', () => prisma.salaryTransaction.deleteMany()],
    ['SalaryRevision', () => prisma.salaryRevision.deleteMany()],
    ['SalaryRecord', () => prisma.salaryRecord.deleteMany()],
    ['ExpensePayment', () => prisma.expensePayment.deleteMany()],
    ['ElectricityReading', () => prisma.electricityReading.deleteMany()],
    ['ElectricityRateHistory', () => prisma.electricityRateHistory.deleteMany()],
    ['Expense', () => prisma.expense.deleteMany()],
    ['ExpenseCategory', () => prisma.expenseCategory.deleteMany()],
    ['Payment', () => prisma.payment.deleteMany()],
    ['RentCredit', () => prisma.rentCredit.deleteMany()],
    ['TenantUnitHotelUse', () => prisma.tenantUnitHotelUse.deleteMany()],
    ['Booking', () => prisma.booking.deleteMany()],
    ['Guest', () => prisma.guest.deleteMany()],
    ['RentRevision', () => prisma.rentRevision.deleteMany()],
    ['MonthlyBill', () => prisma.monthlyBill.deleteMany()],
    ['MonthlyTenancy', () => prisma.monthlyTenancy.deleteMany()],
    ['MonthlyAgreement', () => prisma.monthlyAgreement.deleteMany()],
    ['MonthlyTenant', () => prisma.monthlyTenant.deleteMany()],
    ['OwnerAgreementRevision', () => prisma.ownerAgreementRevision.deleteMany()],
    ['OwnerMonthlyStatement', () => prisma.ownerMonthlyStatement.deleteMany()],
    ['OwnerUnitAssignment', () => prisma.ownerUnitAssignment.deleteMany()],
    ['Owner', () => prisma.owner.deleteMany()],
    ['Unit', () => prisma.unit.deleteMany()],
    ['Property', () => prisma.property.deleteMany()],
    ['Employee', () => prisma.employee.deleteMany()],
    ['ApprovalRequest', () => prisma.approvalRequest.deleteMany()],
    ['AuditLog', () => prisma.auditLog.deleteMany()],
    ['Notification', () => prisma.notification.deleteMany()],
    ['RestoreHistory', () => prisma.restoreHistory.deleteMany()],
    ['BackupRecord', () => prisma.backupRecord.deleteMany()],
  ];

  for (const [name, run] of steps) {
    const result = await run();
    console.log(`  cleared ${name}: ${result.count}`);
  }

  // Keep settings values, but drop user FK pointers from deleted activity.
  await prisma.systemSetting.updateMany({
    data: { updatedByUserId: null },
  });

  console.log('\nRestoring system expense categories…');
  for (const name of SYSTEM_EXPENSE_CATEGORIES) {
    await prisma.expenseCategory.create({
      data: {
        name,
        description: `${name} (system)`,
        isSystem: true,
        isActive: true,
      },
    });
  }
  console.log(`  created ${SYSTEM_EXPENSE_CATEGORIES.length} categories`);

  const usersAfter = await prisma.user.count();
  console.log(`\nDone. Login users kept: ${usersAfter}`);
  console.log('You can now add real properties, units, guests, tenants, etc.');

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  process.exit(1);
});
