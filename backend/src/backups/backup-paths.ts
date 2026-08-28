import * as fs from 'fs';
import * as path from 'path';

const SAFE_NAME = /^[A-Za-z0-9._-]+$/;

export function getBackupDirectory(): string {
  const configured = process.env.BACKUP_DIRECTORY?.trim();
  const dir = configured
    ? path.resolve(configured)
    : path.resolve(process.cwd(), 'storage', 'backups');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function assertInsideBackupDir(filePath: string): string {
  const root = getBackupDirectory();
  const resolved = path.resolve(filePath);
  const relative = path.relative(root, resolved);
  if (
    relative.startsWith('..') ||
    path.isAbsolute(relative) ||
    relative.includes('\0')
  ) {
    throw new Error('Invalid backup file path');
  }
  return resolved;
}

export function assertSafeFileName(fileName: string): string {
  const base = path.basename(fileName);
  if (!SAFE_NAME.test(base) || !base.endsWith('.backup')) {
    throw new Error('Invalid backup file name');
  }
  return base;
}

export function parseDatabaseUrl(databaseUrl: string): {
  host: string;
  port: string;
  user: string;
  password: string;
  database: string;
} {
  const url = new URL(databaseUrl);
  return {
    host: url.hostname || 'localhost',
    port: url.port || '5432',
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ''),
  };
}
