import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import {
  MODULE_KEYS,
  defaultConfigFor,
  type ModuleKey,
} from '@/lib/modules';

export interface ModuleState {
  enabled: boolean;
  config: Record<string, unknown>;
}

/** מפת מצב המודולים של משתלה (מפתח → { enabled, config }). ממוזג עם ברירות מחדל. */
export const getNurseryModuleMap = cache(
  async (nurseryId: string): Promise<Map<ModuleKey, ModuleState>> => {
    const rows = await prisma.nurseryModule.findMany({ where: { nurseryId } });
    const byKey = new Map(rows.map((r) => [r.moduleKey, r]));
    const map = new Map<ModuleKey, ModuleState>();
    for (const key of MODULE_KEYS) {
      const row = byKey.get(key);
      map.set(key, {
        enabled: row?.isEnabled ?? false,
        config: {
          ...defaultConfigFor(key),
          ...((row?.config as Record<string, unknown> | null) ?? {}),
        },
      });
    }
    return map;
  },
);

export async function isModuleEnabled(nurseryId: string, key: ModuleKey): Promise<boolean> {
  return (await getNurseryModuleMap(nurseryId)).get(key)?.enabled ?? false;
}

/** קבוצת המפתחות של המודולים הפעילים במשתלה. */
export async function getEnabledModuleKeys(nurseryId: string): Promise<Set<ModuleKey>> {
  const map = await getNurseryModuleMap(nurseryId);
  const set = new Set<ModuleKey>();
  for (const [key, state] of map) if (state.enabled) set.add(key);
  return set;
}

export async function getModuleConfig(
  nurseryId: string,
  key: ModuleKey,
): Promise<Record<string, unknown>> {
  return (await getNurseryModuleMap(nurseryId)).get(key)?.config ?? {};
}

/**
 * שומר על route בפורטל: אם המודול לא משויך למשתלת המשתמש — הפניה ל-/admin.
 * סופר-אדמין תמיד עובר.
 */
export async function requireModule(key: ModuleKey): Promise<void> {
  return requireAnyModule([key]);
}

/** כמו requireModule, אך מספיק שאחד מהמפתחות משויך. */
export async function requireAnyModule(keys: ModuleKey[]): Promise<void> {
  const user = await getSessionUser();
  if (!user) redirect('/admin/login');
  if (user.role === 'SUPER_ADMIN') return;
  if (!user.nurseryId) redirect('/admin');
  const map = await getNurseryModuleMap(user.nurseryId);
  if (!keys.some((k) => map.get(k)?.enabled)) redirect('/admin');
}
