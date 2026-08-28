import { BadRequestException } from '@nestjs/common';
import { SettingDataType } from '../../generated/prisma/client';
import type { SettingDefinition } from './settings.catalog';

const HEX_COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const PREFIX = /^[A-Za-z0-9]{1,12}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const SUPPORTED_DATE_FORMATS = new Set([
  'DD/MM/YYYY',
  'MM/DD/YYYY',
  'YYYY-MM-DD',
  'DD-MM-YYYY',
]);
const SUPPORTED_TIME_FORMATS = new Set(['HH:mm', 'hh:mm A']);
const SUPPORTED_CURRENCIES = new Set(['PKR', 'USD', 'EUR', 'GBP', 'AED', 'SAR']);

export function serializeSettingValue(
  def: SettingDefinition,
  raw: unknown,
): string {
  validateSettingValue(def, raw);

  switch (def.dataType) {
    case SettingDataType.BOOLEAN:
      return String(Boolean(raw === true || raw === 'true' || raw === 1));
    case SettingDataType.NUMBER:
      return String(Number(raw));
    case SettingDataType.JSON:
      return typeof raw === 'string' ? raw : JSON.stringify(raw);
    default:
      return String(raw ?? '');
  }
}

export function parseSettingValue(
  def: SettingDefinition,
  stored: string,
): unknown {
  switch (def.dataType) {
    case SettingDataType.BOOLEAN:
      return stored === 'true';
    case SettingDataType.NUMBER: {
      const n = Number(stored);
      return Number.isFinite(n) ? n : 0;
    }
    case SettingDataType.JSON:
      try {
        return JSON.parse(stored) as unknown;
      } catch {
        return stored;
      }
    default:
      return stored;
  }
}

export function validateSettingValue(
  def: SettingDefinition,
  raw: unknown,
): void {
  const key = def.key;

  switch (def.dataType) {
    case SettingDataType.BOOLEAN: {
      if (
        typeof raw !== 'boolean' &&
        raw !== 'true' &&
        raw !== 'false' &&
        raw !== 0 &&
        raw !== 1
      ) {
        throw new BadRequestException(`${key} must be a boolean`);
      }
      return;
    }
    case SettingDataType.NUMBER: {
      const n = Number(raw);
      if (!Number.isFinite(n)) {
        throw new BadRequestException(`${key} must be a number`);
      }
      if (
        key.includes('Percentage') ||
        key.includes('Tax') ||
        key.includes('ServiceCharge')
      ) {
        if (n < 0 || n > 100) {
          throw new BadRequestException(`${key} must be between 0 and 100`);
        }
      }
      if (
        key.includes('rate') ||
        key.includes('Threshold') ||
        key.includes('Limit') ||
        key.includes('Amount') ||
        key.includes('Deposit') ||
        key.includes('Duration') ||
        key.includes('Timeout') ||
        key.includes('Length') ||
        key.includes('Attempts') ||
        key.includes('Places') ||
        key.includes('Hours') ||
        key.includes('pageSize')
      ) {
        if (n < 0) {
          throw new BadRequestException(`${key} must be >= 0`);
        }
      }
      if (key === 'security.sessionTimeoutMinutes' && (n < 5 || n > 10080)) {
        throw new BadRequestException(
          'Session timeout must be between 5 and 10080 minutes',
        );
      }
      if (key === 'security.passwordMinimumLength' && (n < 6 || n > 128)) {
        throw new BadRequestException(
          'Password minimum length must be between 6 and 128',
        );
      }
      if (key === 'appearance.defaultPageSize' && (n < 5 || n > 200)) {
        throw new BadRequestException('Page size must be between 5 and 200');
      }
      return;
    }
    case SettingDataType.COLOR: {
      if (typeof raw !== 'string' || !HEX_COLOR.test(raw)) {
        throw new BadRequestException(`${key} must be a valid hex color`);
      }
      return;
    }
    case SettingDataType.JSON: {
      let value: unknown = raw;
      if (typeof raw === 'string') {
        try {
          value = JSON.parse(raw) as unknown;
        } catch {
          throw new BadRequestException(`${key} must be valid JSON`);
        }
      }
      if (key === 'dashboard.colors') {
        validateDashboardColors(value);
      }
      if (key.startsWith('numbering.')) {
        validateNumberingConfig(key, value);
      }
      if (key === 'payment.enabledMethods') {
        if (!Array.isArray(value) || value.length === 0) {
          throw new BadRequestException(
            'payment.enabledMethods must be a non-empty array',
          );
        }
      }
      return;
    }
    case SettingDataType.STRING:
    default: {
      if (typeof raw !== 'string' && typeof raw !== 'number') {
        throw new BadRequestException(`${key} must be a string`);
      }
      const s = String(raw);
      if (key === 'finance.currency' && !SUPPORTED_CURRENCIES.has(s)) {
        throw new BadRequestException(
          `Currency must be one of: ${[...SUPPORTED_CURRENCIES].join(', ')}`,
        );
      }
      if (key === 'business.dateFormat' && !SUPPORTED_DATE_FORMATS.has(s)) {
        throw new BadRequestException('Unsupported date format');
      }
      if (key === 'business.timeFormat' && !SUPPORTED_TIME_FORMATS.has(s)) {
        throw new BadRequestException('Unsupported time format');
      }
      if (
        (key === 'booking.defaultCheckInTime' ||
          key === 'booking.defaultCheckOutTime') &&
        !TIME.test(s)
      ) {
        throw new BadRequestException(`${key} must be HH:mm`);
      }
      return;
    }
  }
}

function validateDashboardColors(value: unknown) {
  if (!value || typeof value !== 'object') {
    throw new BadRequestException('dashboard.colors must be an object');
  }
  const required = [
    'AVAILABLE',
    'OCCUPIED',
    'CLEANING_REQUIRED',
    'MONTHLY_TENANT_VACANT',
    'MAINTENANCE',
    'BLOCKED',
  ];
  const map = value as Record<string, unknown>;
  for (const status of required) {
    if (typeof map[status] !== 'string' || !HEX_COLOR.test(map[status])) {
      throw new BadRequestException(
        `dashboard.colors.${status} must be a valid hex color`,
      );
    }
  }
  if (
    map.OCCUPIED_DAILY !== undefined &&
    (typeof map.OCCUPIED_DAILY !== 'string' ||
      !HEX_COLOR.test(map.OCCUPIED_DAILY))
  ) {
    throw new BadRequestException(
      'dashboard.colors.OCCUPIED_DAILY must be a valid hex color',
    );
  }
}

function validateNumberingConfig(key: string, value: unknown) {
  if (!value || typeof value !== 'object') {
    throw new BadRequestException(`${key} must be an object`);
  }
  const cfg = value as Record<string, unknown>;
  if (typeof cfg.prefix !== 'string' || !PREFIX.test(cfg.prefix)) {
    throw new BadRequestException(
      `${key}.prefix must be 1-12 alphanumeric characters`,
    );
  }
  if (typeof cfg.separator !== 'string' || cfg.separator.length > 3) {
    throw new BadRequestException(`${key}.separator is invalid`);
  }
  const seqLen = Number(cfg.sequenceLength);
  if (!Number.isInteger(seqLen) || seqLen < 3 || seqLen > 8) {
    throw new BadRequestException(
      `${key}.sequenceLength must be between 3 and 8`,
    );
  }
}
