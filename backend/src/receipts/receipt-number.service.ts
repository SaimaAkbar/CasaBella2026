import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { SettingsService } from '../settings/settings.service';

type NumberingConfig = {
  prefix?: string;
  separator?: string;
  includeYear?: boolean;
  sequenceLength?: number;
  resetYearly?: boolean;
};

@Injectable()
export class ReceiptNumberService {
  constructor(private readonly settingsService: SettingsService) {}

  async nextReceiptNumber(tx: Prisma.TransactionClient): Promise<string> {
    const numbering =
      (await this.settingsService.getValue<NumberingConfig>(
        'numbering.receipt',
      )) ?? {};
    const prefix = numbering.prefix ?? 'RC';
    const separator = numbering.separator ?? '-';
    const seqLen = Number(numbering.sequenceLength) || 6;
    const year = new Date().getUTCFullYear();
    const settingKey =
      numbering.resetYearly === false
        ? 'receipt_seq_global'
        : `receipt_seq_${year}`;

    const rows = await tx.$queryRaw<Array<{ value: string }>>`
      INSERT INTO "SystemSetting" (key, value, "createdAt", "updatedAt")
      VALUES (${settingKey}, '1', NOW(), NOW())
      ON CONFLICT (key)
      DO UPDATE SET
        value = (CAST("SystemSetting".value AS INTEGER) + 1)::text,
        "updatedAt" = NOW()
      RETURNING value
    `;

    const seq = String(rows[0]?.value ?? '1').padStart(seqLen, '0');
    if (numbering.includeYear === false) {
      return `${prefix}${separator}${seq}`;
    }
    return `${prefix}${separator}${year}${separator}${seq}`;
  }
}
