export type ApprovalModuleName =
  | 'PROPERTY'
  | 'UNITS'
  | 'MONTHLY_TENANTS'
  | 'BOOKINGS'
  | 'PAYMENTS'
  | 'EXPENSES'
  | 'ELECTRICITY'
  | 'OWNERS'
  | 'EMPLOYEES'
  | 'SALARY'
  | 'INVENTORY'
  | 'SETTINGS';

export type ApprovalActionType =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'ARCHIVE'
  | 'RESTORE'
  | 'APPROVE'
  | 'REJECT';

export type ApprovalStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED';

export type ApprovalPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';

export type ApprovalUserRef = {
  id: string;
  fullName: string;
  email: string;
  role: string;
};

export type ApprovalRequest = {
  id: string;
  moduleName: ApprovalModuleName;
  recordId: string;
  actionType: ApprovalActionType;
  requestedById: string;
  approvedById: string | null;
  requestedDate: string;
  approvedDate: string | null;
  status: ApprovalStatus;
  oldData: Record<string, unknown> | null;
  newData: Record<string, unknown> | null;
  reason: string | null;
  rejectionReason: string | null;
  priority: ApprovalPriority;
  createdAt: string;
  updatedAt: string;
  requestedBy: ApprovalUserRef | null;
  approvedBy: ApprovalUserRef | null;
};

export type ApprovalQuery = {
  status?: ApprovalStatus | '';
  moduleName?: ApprovalModuleName | '';
  requestedById?: string;
  priority?: ApprovalPriority | '';
  dateFrom?: string;
  dateTo?: string;
  search?: string;
};

export type AuditLog = {
  id: string;
  module: string;
  action: string;
  recordId: string | null;
  userId: string | null;
  role: string | null;
  oldData: Record<string, unknown> | null;
  newData: Record<string, unknown> | null;
  ipAddress: string | null;
  device: string | null;
  browser: string | null;
  os: string | null;
  createdAt: string;
  user: ApprovalUserRef | null;
};

export type AuditLogQuery = {
  module?: string;
  action?: string;
  userId?: string;
  role?: string;
  recordId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
};

export type AppNotification = {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  relatedModule: string | null;
  relatedId: string | null;
  priority?: string;
  actionUrl?: string | null;
  icon?: string | null;
  recipientRole?: string | null;
  isRead: boolean;
  readAt?: string | null;
  expiresAt?: string | null;
  createdAt: string;
  updatedAt?: string;
  dedupeKey?: string | null;
  isResolved?: boolean;
  resolvedAt?: string | null;
};
