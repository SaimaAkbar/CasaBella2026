import type { Request } from 'express';
import type { AuditContext } from '../types/audit-context.type';

function firstHeader(
  value: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

/**
 * Best-effort parse of User-Agent into device / browser / os labels.
 * Not a full UA parser — enough for audit trails.
 */
export function extractAuditContext(req: Request): AuditContext {
  const forwarded = firstHeader(req.headers['x-forwarded-for']);
  const ipAddress =
    forwarded?.split(',')[0]?.trim() ||
    req.ip ||
    req.socket?.remoteAddress ||
    undefined;

  const ua = firstHeader(req.headers['user-agent']) ?? '';
  const lower = ua.toLowerCase();

  let browser = 'Unknown';
  if (lower.includes('edg/')) browser = 'Edge';
  else if (lower.includes('chrome/')) browser = 'Chrome';
  else if (lower.includes('firefox/')) browser = 'Firefox';
  else if (lower.includes('safari/') && !lower.includes('chrome/'))
    browser = 'Safari';

  let os = 'Unknown';
  if (lower.includes('windows')) os = 'Windows';
  else if (lower.includes('mac os') || lower.includes('macintosh')) os = 'macOS';
  else if (lower.includes('android')) os = 'Android';
  else if (lower.includes('iphone') || lower.includes('ipad')) os = 'iOS';
  else if (lower.includes('linux')) os = 'Linux';

  let device = 'Desktop';
  if (lower.includes('mobile') || lower.includes('android') || lower.includes('iphone')) {
    device = 'Mobile';
  } else if (lower.includes('tablet') || lower.includes('ipad')) {
    device = 'Tablet';
  }

  return { ipAddress, device, browser, os };
}
