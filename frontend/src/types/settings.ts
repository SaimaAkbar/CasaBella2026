export type SettingCategory =
  | 'BUSINESS'
  | 'FINANCE'
  | 'ELECTRICITY'
  | 'NUMBERING'
  | 'DASHBOARD'
  | 'BOOKING'
  | 'PAYMENT'
  | 'EXPENSE'
  | 'INVENTORY'
  | 'SALARY'
  | 'SECURITY'
  | 'DOCUMENTS'
  | 'APPEARANCE'
  | 'SYSTEM';

export type SettingDataType =
  | 'STRING'
  | 'NUMBER'
  | 'BOOLEAN'
  | 'JSON'
  | 'DATE'
  | 'COLOR';

export type SystemSetting = {
  key: string;
  value: unknown;
  rawValue: string;
  category: SettingCategory;
  dataType: SettingDataType;
  description: string;
  isSensitive: boolean;
  isPublic: boolean;
  updatedAt: string | null;
  updatedByUserId: string | null;
};

export type NumberingConfig = {
  prefix: string;
  separator: string;
  includeYear: boolean;
  includeMonth: boolean;
  sequenceLength: number;
  resetYearly: boolean;
  resetMonthly: boolean;
};

export type DashboardColors = {
  AVAILABLE: string;
  OCCUPIED: string;
  OCCUPIED_DAILY?: string;
  CLEANING_REQUIRED: string;
  MONTHLY_TENANT_VACANT: string;
  MAINTENANCE: string;
  BLOCKED: string;
};
