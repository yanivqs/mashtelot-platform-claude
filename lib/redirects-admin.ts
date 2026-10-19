import type { PrismaClient } from '@prisma/client';
import { checkRule, parseRedirectCsv, planRule } from '@/lib/redirects';

/**
 * ניהול הפניות של משתלה (§14.01). מקבל את ה-DB כפרמטר כדי שיהיה בר-בדיקה, וכל פעולה
 * מוגבלת ל-`nurseryId` שהגיע מה-session — לעולם לא מזהה מהלקוח.
 */

export type SaveRedirectResult = { ok: true; from: string; to: string; retargeted: number } | { ok: false; error: string };

export async function saveRedirect(
  db: PrismaClient,
  nurseryId: string,
  fromRaw: string,
  toRaw: string,
): Promise<SaveRedirectResult> {
  const check = checkRule(fromRaw, toRaw);
  if (!check.ok) return check;

  return db.$transaction(async (tx) => {
    const existing = await tx.redirect.findMany({ where: { nurseryId }, select: { fromPath: true, toPath: true } });
    const plan = planRule(check.from, check.to, existing);
    if ('error' in plan) return { ok: false as const, error: plan.error };

    await tx.redirect.upsert({
      where: { nurseryId_fromPath: { nurseryId, fromPath: plan.from } },
      create: { nurseryId, fromPath: plan.from, toPath: plan.to },
      update: { toPath: plan.to },
    });
    if (plan.retarget.length) {
      await tx.redirect.updateMany({ where: { nurseryId, fromPath: { in: plan.retarget } }, data: { toPath: plan.to } });
    }
    return { ok: true as const, from: plan.from, to: plan.to, retargeted: plan.retarget.length };
  });
}

export async function deleteRedirect(db: PrismaClient, nurseryId: string, id: string): Promise<boolean> {
  const res = await db.redirect.deleteMany({ where: { id, nurseryId } });
  return res.count === 1;
}

export interface ImportResult {
  saved: number;
  errors: Array<{ line: number; error: string }>;
}

/** יבוא CSV: כל שורה נשמרת בנפרד (עם קיצור שרשראות); שורות שגויות מדווחות ולא עוצרות את השאר. */
export async function importRedirects(db: PrismaClient, nurseryId: string, csv: string): Promise<ImportResult> {
  const parsed = parseRedirectCsv(csv);
  const errors = [...parsed.errors];
  let saved = 0;
  for (const row of parsed.rows) {
    const res = await saveRedirect(db, nurseryId, row.from, row.to);
    if (res.ok) saved++;
    else errors.push({ line: row.line, error: res.error });
  }
  errors.sort((a, b) => a.line - b.line);
  return { saved, errors };
}

/** חיפוש הפניה לנתיב שלא נמצא + רישום פגיעה. מחזיר את היעד או null. */
export async function findRedirect(db: PrismaClient, nurseryId: string, path: string): Promise<string | null> {
  const rule = await db.redirect.findUnique({
    where: { nurseryId_fromPath: { nurseryId, fromPath: path } },
    select: { id: true, toPath: true },
  });
  if (!rule) return null;
  await db.redirect.update({ where: { id: rule.id }, data: { hits: { increment: 1 }, lastHitAt: new Date() } });
  return rule.toPath;
}
