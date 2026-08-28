-- CreateEnum
CREATE TYPE "NotificationPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "SettingCategory" AS ENUM ('BUSINESS', 'FINANCE', 'ELECTRICITY', 'NUMBERING', 'DASHBOARD', 'BOOKING', 'PAYMENT', 'EXPENSE', 'INVENTORY', 'SALARY', 'SECURITY', 'DOCUMENTS', 'APPEARANCE', 'SYSTEM');

-- CreateEnum
CREATE TYPE "SettingDataType" AS ENUM ('STRING', 'NUMBER', 'BOOLEAN', 'JSON', 'DATE', 'COLOR');

-- CreateEnum
CREATE TYPE "BackupType" AS ENUM ('MANUAL', 'SCHEDULED', 'PRE_RESTORE');

-- CreateEnum
CREATE TYPE "BackupStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'DELETED');

-- CreateEnum
CREATE TYPE "BackupStorageType" AS ENUM ('LOCAL', 'CLOUD');

-- CreateEnum
CREATE TYPE "RestoreStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'INFO';
ALTER TYPE "NotificationType" ADD VALUE 'SUCCESS';
ALTER TYPE "NotificationType" ADD VALUE 'WARNING';
ALTER TYPE "NotificationType" ADD VALUE 'ERROR';
ALTER TYPE "NotificationType" ADD VALUE 'REMINDER';

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "actionUrl" TEXT,
ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "icon" TEXT,
ADD COLUMN     "priority" "NotificationPriority" NOT NULL DEFAULT 'NORMAL',
ADD COLUMN     "readAt" TIMESTAMP(3),
ADD COLUMN     "recipientRole" "Role";

-- AlterTable
ALTER TABLE "SystemSetting" ADD COLUMN     "category" "SettingCategory" NOT NULL DEFAULT 'BUSINESS',
ADD COLUMN     "dataType" "SettingDataType" NOT NULL DEFAULT 'STRING',
ADD COLUMN     "description" TEXT,
ADD COLUMN     "isPublic" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isSensitive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "updatedByUserId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "forcePasswordChange" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastLoginAt" TIMESTAMP(3),
ADD COLUMN     "lockedUntil" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "BackupRecord" (
    "id" TEXT NOT NULL,
    "backupNumber" TEXT NOT NULL,
    "backupType" "BackupType" NOT NULL,
    "storageType" "BackupStorageType" NOT NULL DEFAULT 'LOCAL',
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileSizeBytes" BIGINT,
    "checksum" TEXT,
    "databaseName" TEXT NOT NULL,
    "databaseVersion" TEXT,
    "applicationVersion" TEXT,
    "status" "BackupStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "notes" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "restoredByUserId" TEXT,
    "restoredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BackupRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RestoreHistory" (
    "id" TEXT NOT NULL,
    "backupId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "status" "RestoreStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT NOT NULL,
    "confirmationText" TEXT NOT NULL,
    "preRestoreBackupId" TEXT,
    "restoredByUserId" TEXT NOT NULL,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RestoreHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BackupRecord_backupNumber_key" ON "BackupRecord"("backupNumber");

-- CreateIndex
CREATE INDEX "BackupRecord_status_idx" ON "BackupRecord"("status");

-- CreateIndex
CREATE INDEX "BackupRecord_backupType_idx" ON "BackupRecord"("backupType");

-- CreateIndex
CREATE INDEX "BackupRecord_createdAt_idx" ON "BackupRecord"("createdAt");

-- CreateIndex
CREATE INDEX "BackupRecord_createdByUserId_idx" ON "BackupRecord"("createdByUserId");

-- CreateIndex
CREATE INDEX "RestoreHistory_backupId_idx" ON "RestoreHistory"("backupId");

-- CreateIndex
CREATE INDEX "RestoreHistory_status_idx" ON "RestoreHistory"("status");

-- CreateIndex
CREATE INDEX "RestoreHistory_startedAt_idx" ON "RestoreHistory"("startedAt");

-- CreateIndex
CREATE INDEX "Notification_priority_idx" ON "Notification"("priority");

-- CreateIndex
CREATE INDEX "Notification_expiresAt_idx" ON "Notification"("expiresAt");

-- CreateIndex
CREATE INDEX "SystemSetting_category_idx" ON "SystemSetting"("category");

-- CreateIndex
CREATE INDEX "SystemSetting_isPublic_idx" ON "SystemSetting"("isPublic");

-- AddForeignKey
ALTER TABLE "SystemSetting" ADD CONSTRAINT "SystemSetting_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BackupRecord" ADD CONSTRAINT "BackupRecord_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BackupRecord" ADD CONSTRAINT "BackupRecord_restoredByUserId_fkey" FOREIGN KEY ("restoredByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestoreHistory" ADD CONSTRAINT "RestoreHistory_backupId_fkey" FOREIGN KEY ("backupId") REFERENCES "BackupRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestoreHistory" ADD CONSTRAINT "RestoreHistory_preRestoreBackupId_fkey" FOREIGN KEY ("preRestoreBackupId") REFERENCES "BackupRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestoreHistory" ADD CONSTRAINT "RestoreHistory_restoredByUserId_fkey" FOREIGN KEY ("restoredByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
