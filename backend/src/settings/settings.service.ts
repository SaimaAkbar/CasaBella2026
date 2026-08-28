import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Role,
  SettingCategory,
  type SystemSetting,
} from '../../generated/prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import type { AuditContext } from '../common/types/audit-context.type';
import type { AuthUser } from '../common/types/auth-user.type';
import { PrismaService } from '../prisma/prisma.service';
import {
  LEGACY_SETTING_ALIASES,
  SETTINGS_BY_KEY,
  SETTINGS_CATALOG,
  type SettingDefinition,
} from './settings.catalog';
import {
  parseSettingValue,
  serializeSettingValue,
} from './settings.validation';

type CacheEntry = {
  value: string;
  expiresAt: number;
};

const CACHE_TTL_MS = 60_000;

@Injectable()
export class SettingsService {
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async ensureDefaultsSeeded() {
    for (const def of SETTINGS_CATALOG) {
      await this.prisma.systemSetting.upsert({
        where: { key: def.key },
        update: {},
        create: {
          key: def.key,
          value: def.defaultValue,
          category: def.category,
          dataType: def.dataType,
          description: def.description,
          isSensitive: def.isSensitive ?? false,
          isPublic: def.isPublic ?? false,
        },
      });
    }

    for (const [legacyKey, modernKey] of Object.entries(
      LEGACY_SETTING_ALIASES,
    )) {
      const legacy = await this.prisma.systemSetting.findUnique({
        where: { key: legacyKey },
      });
      if (!legacy) continue;
      const modern = await this.prisma.systemSetting.findUnique({
        where: { key: modernKey },
      });
      if (modern && modern.value === SETTINGS_BY_KEY.get(modernKey)?.defaultValue) {
        await this.prisma.systemSetting.update({
          where: { key: modernKey },
          data: { value: legacy.value },
        });
        this.cache.delete(modernKey);
      }
    }
  }

  listCategories() {
    return Object.values(SettingCategory);
  }

  async getPublicSettings() {
    const defs = SETTINGS_CATALOG.filter((d) => d.isPublic);
    const rows = await this.prisma.systemSetting.findMany({
      where: { key: { in: defs.map((d) => d.key) } },
    });
    const byKey = new Map(rows.map((r) => [r.key, r]));
    return defs.map((def) => this.serialize(def, byKey.get(def.key)));
  }

  async findAll(user: AuthUser, category?: SettingCategory) {
    this.assertCanReadSettings(user);

    const defs = SETTINGS_CATALOG.filter((def) => {
      if (category && def.category !== category) return false;
      if (user.role !== Role.SUPER_ADMIN && def.isSensitive) return false;
      return true;
    });

    const rows = await this.prisma.systemSetting.findMany({
      where: { key: { in: defs.map((d) => d.key) } },
    });
    const byKey = new Map(rows.map((r) => [r.key, r]));

    return defs.map((def) => this.serialize(def, byKey.get(def.key)));
  }

  async findOne(key: string, user: AuthUser) {
    const def = this.requireDefinition(key);
    if (def.isPublic) {
      const row = await this.getRow(def.key);
      return this.serialize(def, row);
    }

    this.assertCanReadSettings(user);
    if (def.isSensitive && user.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Sensitive setting access denied');
    }

    const row = await this.getRow(def.key);
    return this.serialize(def, row);
  }

  async getValue<T = unknown>(key: string): Promise<T> {
    const resolved = LEGACY_SETTING_ALIASES[key] ?? key;
    const def = SETTINGS_BY_KEY.get(resolved);
    if (!def) {
      throw new NotFoundException(`Unknown setting: ${key}`);
    }

    const cached = this.cache.get(def.key);
    if (cached && cached.expiresAt > Date.now()) {
      return parseSettingValue(def, cached.value) as T;
    }

    const row = await this.getRow(def.key);
    const value = row?.value ?? def.defaultValue;
    this.cache.set(def.key, {
      value,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
    return parseSettingValue(def, value) as T;
  }

  async getString(key: string, fallback?: string): Promise<string> {
    try {
      const value = await this.getValue<unknown>(key);
      if (value === null || value === undefined) return fallback ?? '';
      return String(value);
    } catch {
      return fallback ?? '';
    }
  }

  async getNumber(key: string, fallback = 0): Promise<number> {
    const value = await this.getValue<unknown>(key);
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  async getBoolean(key: string, fallback = false): Promise<boolean> {
    try {
      const value = await this.getValue<unknown>(key);
      return Boolean(value);
    } catch {
      return fallback;
    }
  }

  async updateOne(
    key: string,
    rawValue: unknown,
    user: AuthUser,
    options?: { reason?: string; context?: AuditContext },
  ) {
    this.assertCanUpdateSettings(user);
    const def = this.requireDefinition(key);
    if (def.category === SettingCategory.SECURITY && user.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Only Super Admin can update security settings');
    }

    const serialized = serializeSettingValue(def, rawValue);
    const existing = await this.getRow(def.key);
    const oldValue = existing?.value ?? def.defaultValue;

    const row = await this.prisma.systemSetting.upsert({
      where: { key: def.key },
      create: {
        key: def.key,
        value: serialized,
        category: def.category,
        dataType: def.dataType,
        description: def.description,
        isSensitive: def.isSensitive ?? false,
        isPublic: def.isPublic ?? false,
        updatedByUserId: user.id,
      },
      update: {
        value: serialized,
        category: def.category,
        dataType: def.dataType,
        description: def.description,
        isSensitive: def.isSensitive ?? false,
        isPublic: def.isPublic ?? false,
        updatedByUserId: user.id,
      },
    });

    // Keep legacy keys in sync for older readers.
    for (const [legacyKey, modernKey] of Object.entries(LEGACY_SETTING_ALIASES)) {
      if (modernKey === def.key) {
        await this.prisma.systemSetting.upsert({
          where: { key: legacyKey },
          create: { key: legacyKey, value: serialized },
          update: { value: serialized },
        });
      }
    }

    this.cache.delete(def.key);

    await this.auditLogs.write({
      module: 'SETTINGS',
      action: 'SETTING_UPDATED',
      recordId: def.key,
      userId: user.id,
      role: user.role,
      oldData: { key: def.key, value: parseSettingValue(def, oldValue) },
      newData: {
        key: def.key,
        value: parseSettingValue(def, serialized),
        reason: options?.reason ?? null,
        category: def.category,
      },
      context: options?.context,
    });

    return this.serialize(def, row);
  }

  async updateBulk(
    items: Array<{ key: string; value: unknown }>,
    user: AuthUser,
    options?: { reason?: string; context?: AuditContext },
  ) {
    const results: Array<ReturnType<SettingsService['serialize']>> = [];
    for (const item of items) {
      results.push(await this.updateOne(item.key, item.value, user, options));
    }
    return results;
  }

  async resetCategory(
    category: SettingCategory,
    user: AuthUser,
    context?: AuditContext,
  ) {
    if (user.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Only Super Admin can reset settings');
    }

    const defs = SETTINGS_CATALOG.filter((d) => d.category === category);
    if (defs.length === 0) {
      throw new NotFoundException(`Unknown category: ${category}`);
    }

    const results: Array<ReturnType<SettingsService['serialize']>> = [];
    for (const def of defs) {
      results.push(
        await this.updateOne(
          def.key,
          parseSettingValue(def, def.defaultValue),
          user,
          {
            reason: `Reset category ${category}`,
            context,
          },
        ),
      );
    }
    return results;
  }

  clearCache(key?: string) {
    if (key) {
      this.cache.delete(key);
      return;
    }
    this.cache.clear();
  }

  private async getRow(key: string): Promise<SystemSetting | null> {
    return this.prisma.systemSetting.findUnique({ where: { key } });
  }

  private requireDefinition(key: string): SettingDefinition {
    const resolved = LEGACY_SETTING_ALIASES[key] ?? key;
    const def = SETTINGS_BY_KEY.get(resolved);
    if (!def) {
      throw new NotFoundException(`Unknown setting: ${key}`);
    }
    return def;
  }

  private assertCanReadSettings(user: AuthUser) {
    if (user.role === Role.SUPER_ADMIN) return;
    throw new ForbiddenException('Settings access denied');
  }

  private assertCanUpdateSettings(user: AuthUser) {
    if (user.role === Role.SUPER_ADMIN) return;
    throw new ForbiddenException(
      'Only Super Admin can update settings directly',
    );
  }

  private serialize(def: SettingDefinition, row?: SystemSetting | null) {
    const stored = row?.value ?? def.defaultValue;
    return {
      key: def.key,
      value: parseSettingValue(def, stored),
      rawValue: stored,
      category: def.category,
      dataType: def.dataType,
      description: def.description,
      isSensitive: def.isSensitive ?? false,
      isPublic: def.isPublic ?? false,
      updatedAt: row?.updatedAt?.toISOString() ?? null,
      updatedByUserId: row?.updatedByUserId ?? null,
    };
  }
}
