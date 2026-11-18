import { Prisma, type PrismaClient } from '@prisma/client';
import { isSafeImageUrl } from '@/lib/page-blocks';

/**
 * ניהול קטלוג בית הדפוס בידי הסופר-אדמין: קטגוריות (עץ של שתי רמות) ודוגמאות של מוצר דוגמאות.
 * מקבל את ה-DB כפרמטר (בר-בדיקה).
 */

export type AdminResult = { ok: true; id?: string } | { ok: false; error: string };

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,79}$/;

export interface CategoryInput {
  name: string;
  slug: string;
  parentId: string | null;
  imageUrl: string | null;
  sortOrder: number;
  isActive: boolean;
}

export function validateCategory(c: CategoryInput): string | null {
  if (!c.name.trim() || c.name.length > 80) return 'יש לתת שם לקטגוריה (עד 80 תווים)';
  if (!SLUG_RE.test(c.slug)) return 'כתובת: אותיות אנגליות קטנות, מספרים ומקפים בלבד';
  if (c.imageUrl && !isSafeImageUrl(c.imageUrl)) return 'כתובת תמונה לא תקינה';
  if (!Number.isInteger(c.sortOrder) || c.sortOrder < 0 || c.sortOrder > 100_000) return 'סדר לא תקין';
  return null;
}

/** יצירה או עדכון. תת-קטגוריה רק תחת קטגוריה ראשית (שתי רמות), ולא תחת עצמה. */
export async function saveCategory(db: PrismaClient, id: string | null, c: CategoryInput): Promise<AdminResult> {
  const err = validateCategory(c);
  if (err) return { ok: false, error: err };
  if (c.parentId) {
    if (c.parentId === id) return { ok: false, error: 'קטגוריה לא יכולה להיות תחת עצמה' };
    const parent = await db.printCategory.findUnique({ where: { id: c.parentId }, select: { parentId: true } });
    if (!parent) return { ok: false, error: 'קטגוריית האב לא נמצאה' };
    if (parent.parentId) return { ok: false, error: 'אפשר לשייך רק לקטגוריה ראשית (שתי רמות)' };
    if (id && (await db.printCategory.count({ where: { parentId: id } }))) return { ok: false, error: 'לקטגוריה הזו יש תתי-קטגוריות, ולכן היא חייבת להישאר ראשית' };
  }
  const data = { name: c.name.trim(), slug: c.slug, parentId: c.parentId, imageUrl: c.imageUrl, sortOrder: c.sortOrder, isActive: c.isActive };
  try {
    const row = id ? await db.printCategory.update({ where: { id }, data }) : await db.printCategory.create({ data });
    return { ok: true, id: row.id };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return { ok: false, error: 'הכתובת כבר בשימוש — בחרו כתובת אחרת' };
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') return { ok: false, error: 'הקטגוריה לא נמצאה' };
    throw e;
  }
}

/** מחיקה רק של קטגוריה ריקה (בלי תתי-קטגוריות ובלי מוצרים). אחרת — משביתים. */
export async function deleteCategory(db: PrismaClient, id: string): Promise<AdminResult> {
  const c = await db.printCategory.findUnique({ where: { id }, include: { _count: { select: { children: true, templates: true } } } });
  if (!c) return { ok: false, error: 'הקטגוריה לא נמצאה' };
  if (c._count.children || c._count.templates) return { ok: false, error: 'בקטגוריה יש מוצרים או תתי-קטגוריות. אפשר להשבית אותה במקום למחוק' };
  await db.printCategory.delete({ where: { id } });
  return { ok: true };
}

// ---------- דוגמאות ----------

const CODE_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,39}$/;

export interface DesignInput {
  code: string;
  title: string;
  imageUrl: string;
  tags: string[];
  sortOrder: number;
  isActive: boolean;
}

/** תגיות מטקסט חופשי: מופרדות בפסיק, בלי כפילויות, עד 12 תגיות של עד 30 תווים */
export function parseTags(text: string): string[] {
  return [...new Set(text.split(/[,|]/).map((t) => t.trim()).filter(Boolean))].slice(0, 12).map((t) => t.slice(0, 30));
}

export function validateDesign(d: DesignInput): string | null {
  if (!CODE_RE.test(d.code)) return 'קוד: אותיות אנגליות, מספרים, מקף וקו תחתון (עד 40)';
  if (!d.title.trim() || d.title.length > 160) return 'יש לתת שם לדוגמא (עד 160 תווים)';
  if (!d.imageUrl || !isSafeImageUrl(d.imageUrl)) return 'יש להעלות תמונה לדוגמא';
  if (!Number.isInteger(d.sortOrder) || d.sortOrder < 0 || d.sortOrder > 1_000_000) return 'סדר לא תקין';
  return null;
}

export async function saveDesign(db: PrismaClient, templateId: string, id: string | null, d: DesignInput): Promise<AdminResult> {
  const err = validateDesign(d);
  if (err) return { ok: false, error: err };
  const data = { code: d.code.toUpperCase(), title: d.title.trim(), imageUrl: d.imageUrl, tags: d.tags, sortOrder: d.sortOrder, isActive: d.isActive };
  try {
    if (id) {
      const r = await db.printDesign.updateMany({ where: { id, templateId }, data });
      if (r.count !== 1) return { ok: false, error: 'הדוגמא לא נמצאה' };
      return { ok: true, id };
    }
    if (!(await db.printTemplate.count({ where: { id: templateId } }))) return { ok: false, error: 'המוצר לא נמצא' };
    const row = await db.printDesign.create({ data: { ...data, templateId } });
    return { ok: true, id: row.id };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return { ok: false, error: `הקוד ${data.code} כבר קיים במוצר הזה` };
    throw e;
  }
}
