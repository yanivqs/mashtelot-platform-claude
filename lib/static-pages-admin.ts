import type { PrismaClient } from '@prisma/client';

/**
 * לוגיקת השמירה/מחיקה של עמודים סטטיים, מופרדת מה-Server Action כדי שתהיה
 * ניתנת לבדיקה מול בסיס נתונים (ללא cookies/headers של Next). ה-Action אחראי
 * לזיהוי המשתמש, למודול ולסניטציה; כאן נאכף שהעמוד שייך למשתלה (C-P0-01).
 */

export const PAGE_SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,60}[a-z0-9])?$/;
export const RESERVED_PAGE_SLUGS = new Set([
  'catalog',
  'cart',
  'checkout',
  'product',
  'contact',
  'blog',
  'admin',
  'api',
  '_next',
]);

export interface StaticPageInput {
  /** ריק = עמוד חדש */
  id?: string | null;
  title: string;
  slug: string;
  /** HTML שכבר עבר סניטציה */
  contentHtml: string;
  isPublished: boolean;
  showInNav: boolean;
  sortOrder: number;
  seoMetaTitle: string | null;
  seoMetaDescription: string | null;
}

export type SaveStaticPageResult = { ok: true; id: string } | { ok: false; error: string };

export async function saveStaticPage(
  db: PrismaClient,
  nurseryId: string,
  input: StaticPageInput,
): Promise<SaveStaticPageResult> {
  const id = input.id?.trim() || null;
  const title = input.title.trim();
  const slug = input.slug.trim().toLowerCase();

  if (!title) return { ok: false, error: 'כותרת היא שדה חובה' };
  if (!PAGE_SLUG_RE.test(slug)) {
    return { ok: false, error: 'מזהה כתובת (slug) לא תקין — אותיות אנגלית קטנות, ספרות ומקפים' };
  }
  if (RESERVED_PAGE_SLUGS.has(slug)) return { ok: false, error: `"${slug}" הוא מזהה שמור` };

  const clash = await db.staticPage.findFirst({
    where: { nurseryId, slug, NOT: id ? { id } : undefined },
    select: { id: true },
  });
  if (clash) return { ok: false, error: 'כבר קיים עמוד עם מזהה כתובת זה' };

  const data = {
    title,
    slug,
    contentHtml: input.contentHtml,
    isPublished: input.isPublished,
    showInNav: input.showInNav,
    sortOrder: input.sortOrder,
    seoMetaTitle: input.seoMetaTitle,
    seoMetaDescription: input.seoMetaDescription,
  };

  if (id) {
    // התנהגות מקורית (לפני התיקון) — מועברת כפי שהיא כדי לשחזר את הבאג בבדיקה
    await db.staticPage.update({ where: { id }, data });
    return { ok: true, id };
  }
  const created = await db.staticPage.create({ data: { ...data, nurseryId } });
  return { ok: true, id: created.id };
}

/** מחיקה רק אם העמוד שייך למשתלה. מחזיר האם נמחק. */
export async function deleteStaticPage(
  db: PrismaClient,
  nurseryId: string,
  id: string,
): Promise<boolean> {
  const res = await db.staticPage.deleteMany({ where: { id, nurseryId } });
  return res.count === 1;
}
