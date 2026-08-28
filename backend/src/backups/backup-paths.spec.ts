jest.mock('../../generated/prisma/client', () => ({}));

import * as path from 'path';
import {
  assertInsideBackupDir,
  assertSafeFileName,
  getBackupDirectory,
  parseDatabaseUrl,
} from './backup-paths';

describe('backup-paths', () => {
  const original = process.env.BACKUP_DIRECTORY;

  afterEach(() => {
    if (original === undefined) delete process.env.BACKUP_DIRECTORY;
    else process.env.BACKUP_DIRECTORY = original;
  });

  it('creates/resolves backup directory', () => {
    process.env.BACKUP_DIRECTORY = path.join(process.cwd(), 'tmp-backups-test');
    const dir = getBackupDirectory();
    expect(dir).toContain('tmp-backups-test');
  });

  it('accepts safe backup file names', () => {
    expect(assertSafeFileName('BKP-20260803-0001.backup')).toBe(
      'BKP-20260803-0001.backup',
    );
  });

  it('rejects unsafe file names and path traversal', () => {
    expect(() => assertSafeFileName('../secret.backup')).toThrow();
    expect(() => assertSafeFileName('evil.exe')).toThrow();

    process.env.BACKUP_DIRECTORY = path.join(process.cwd(), 'tmp-backups-test');
    const root = getBackupDirectory();
    expect(() =>
      assertInsideBackupDir(path.join(root, '..', 'outside.backup')),
    ).toThrow(/Invalid backup file path/);
  });

  it('parses DATABASE_URL without exposing secrets in structure misuse', () => {
    const parsed = parseDatabaseUrl(
      'postgresql://user:p%40ss@localhost:5432/hotel-residences-pos',
    );
    expect(parsed.database).toBe('hotel-residences-pos');
    expect(parsed.user).toBe('user');
    expect(parsed.password).toBe('p@ss');
    expect(parsed.host).toBe('localhost');
  });
});
