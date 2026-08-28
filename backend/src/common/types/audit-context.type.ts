/** Optional request metadata captured for AuditLog rows. */
export type AuditContext = {
  ipAddress?: string;
  device?: string;
  browser?: string;
  os?: string;
};
