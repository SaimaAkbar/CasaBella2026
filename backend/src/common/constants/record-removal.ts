export const HISTORY_CANNOT_DELETE_MESSAGE =
  'This record has financial/history references and cannot be permanently deleted. It can be archived instead.';

export type RemovalPolicy = {
  action: 'PERMANENT_DELETE' | 'ARCHIVE';
  message: string;
  confirmLabel: string;
  reasonRequired: boolean;
};
