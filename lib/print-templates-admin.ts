import { Prisma, type PrismaClient } from '@prisma/client';
import {
  describeValues,
  parseFields,
  parsePricing,
  quotePrint,
  validateValues,
  type CleanValues,
  type PrintQuote,
  type RawValues,
} from '@/lib/print-template';

/**
 * תבניות דפוס (PT-02/03/07) — ניהול בידי הסופר-אדמין (בית הדפוס) והזמנה בידי משתלה.
 * מקבל את ה-DB כפרמטר (בר-בדיקה). גרסה שפורסמה אינה משתנה (גם trigger ב-DB).
 */

export const DEFAULT_PRICING = { basePrice: 0, tiers: [], setupFee: 0, minQuantity: 1, quoteOnly: true };

export interface TemplateMeta {
  title: string;
  description: string | null;
  category: string | null;
  imageUrl: string | null;
  unitLabel: string | null;
  leadTimeDays: number | null;
  requiresArtwork?: boolean;
  isActive: boolean;
}

export function validateMeta(m: TemplateMeta): string | null {
  if (!m.title.trim() || m.title.length > 120) return 'יש לתת שם למוצר (עד 120 תווים)';
  if (m.leadTimeDays !== null && (!Number.isInteger(m.leadTimeDays) || m.leadTimeDays < 0 || m.leadTimeDays > 365)) return 'זמן הפקה לא תקין';
  if (m.imageUrl && !/^https:\/\//.test(m.imageUrl)) return 'כתובת תמונה לא תקינה';
  return null;
}

export async function createTemplate(db: PrismaClient, meta: TemplateMeta, actor: string | null) {
  return db.printTemplate.create({
    data: {
      ...meta,
      isActive: false,
      versions: { create: { version: 1, status: 'DRAFT', fields: [], pricing: DEFAULT_PRICING, createdBy: actor } },
    },
  });
}

export type SaveResult = { ok: true } | { ok: false; errors: string[] };

/** שמירת הטיוטה (שדות + תמחור). רק גרסת DRAFT ניתנת לעריכה. */
export async function saveDraft(
  db: PrismaClient,
  templateId: string,
  input: { fields: unknown; pricing: unknown; notes?: string | null },
): Promise<SaveResult> {
  const fields = parseFields(input.fields);
  const pricing = parsePricing(input.pricing);
  const errors = [...(fields.ok ? [] : fields.errors), ...(pricing.ok ? [] : pricing.errors)];
  if (errors.length) return { ok: false, errors };
  const res = await db.printTemplateVersion.updateMany({
    where: { templateId, status: 'DRAFT' },
    data: {
      fields: (fields as { value: unknown }).value as Prisma.InputJsonValue,
      pricing: (pricing as { value: unknown }).value as Prisma.InputJsonValue,
      notes: input.notes?.trim() || null,
    },
  });
  if (res.count !== 1) return { ok: false, errors: ['אין טיוטה לעריכה — צרו גרסה חדשה'] };
  return { ok: true };
}

/** פרסום הטיוטה: הגרסה המפורסמת הקודמת עוברת לארכיון. הזמנות קיימות נשארות על הגרסה שלהן. */
export async function publishDraft(db: PrismaClient, templateId: string, actor: string | null): Promise<SaveResult & { version?: number }> {
  return db.$transaction(async (tx) => {
    const draft = await tx.printTemplateVersion.findFirst({ where: { templateId, status: 'DRAFT' } });
    if (!draft) return { ok: false as const, errors: ['אין טיוטה לפרסום'] };
    const fields = parseFields(draft.fields);
    const pricing = parsePricing(draft.pricing);
    const errors = [...(fields.ok ? [] : fields.errors), ...(pricing.ok ? [] : pricing.errors)];
    if (errors.length) return { ok: false as const, errors };
    await tx.printTemplateVersion.updateMany({ where: { templateId, status: 'PUBLISHED' }, data: { status: 'ARCHIVED' } });
    await tx.printTemplateVersion.update({
      where: { id: draft.id },
      data: { status: 'PUBLISHED', publishedAt: new Date(), publishedBy: actor },
    });
    return { ok: true as const, version: draft.version };
  });
}

/** טיוטה חדשה מתוך הגרסה האחרונה (לשינוי תבנית שכבר פורסמה). */
export async function createDraftFromLatest(db: PrismaClient, templateId: string, actor: string | null): Promise<SaveResult> {
  return db.$transaction(async (tx) => {
    if (await tx.printTemplateVersion.findFirst({ where: { templateId, status: 'DRAFT' } })) {
      return { ok: false as const, errors: ['כבר קיימת טיוטה'] };
    }
    const latest = await tx.printTemplateVersion.findFirst({ where: { templateId }, orderBy: { version: 'desc' } });
    if (!latest) return { ok: false as const, errors: ['התבנית לא נמצאה'] };
    await tx.printTemplateVersion.create({
      data: {
        templateId,
        version: latest.version + 1,
        status: 'DRAFT',
        fields: latest.fields as Prisma.InputJsonValue,
        pricing: latest.pricing as Prisma.InputJsonValue,
        createdBy: actor,
      },
    });
    return { ok: true as const };
  });
}

// ---------- הזמנה ----------

export type CreateTemplateOrderResult =
  | { ok: true; orderId: string; quote: PrintQuote }
  | { ok: false; error?: string; fieldErrors?: Record<string, string> };

/**
 * הזמנה מגרסת תבנית מפורסמת: הערכים נבדקים מחדש בשרת מול הגרסה השמורה, המחיר מחושב בשרת,
 * ופריט ההזמנה שומר Snapshot (גרסה, שם, ערכים עם תוויות, פירוט מחיר). "הצעת מחיר בלבד" →
 * סטטוס QUOTE_REQUESTED.
 */
export async function createTemplateOrder(
  db: PrismaClient,
  args: {
    nurseryId: string;
    userId: string | null;
    templateVersionId: string;
    values: RawValues;
    quantity: number;
    notes?: string | null;
  },
): Promise<CreateTemplateOrderResult> {
  const v = await db.printTemplateVersion.findUnique({
    where: { id: args.templateVersionId },
    include: { template: true },
  });
  if (!v || v.status !== 'PUBLISHED' || !v.template.isActive) {
    return { ok: false, error: 'המוצר אינו זמין להזמנה — רעננו את הדף' };
  }
  const fields = parseFields(v.fields);
  const pricing = parsePricing(v.pricing);
  if (!fields.ok || !pricing.ok) return { ok: false, error: 'הגדרת המוצר אינה תקינה — פנו לבית הדפוס' };

  const checked = validateValues(fields.value, args.values);
  if (!checked.ok) return { ok: false, fieldErrors: checked.errors };
  const priced = quotePrint(pricing.value, fields.value, checked.values, args.quantity);
  if (!priced.ok) return { ok: false, error: priced.error };
  const q = priced.quote;

  const order = await db.printOrder.create({
    data: {
      nurseryId: args.nurseryId,
      orderedById: args.userId,
      status: q.quoteOnly ? 'QUOTE_REQUESTED' : 'NEW',
      totalAmount: q.total.toFixed(2),
      notes: args.notes?.trim().slice(0, 2000) || null,
      items: {
        create: {
          templateVersionId: v.id,
          title: v.template.title,
          quantity: q.quantity,
          unitPrice: q.unitPrice.toFixed(2),
          values: {
            raw: checked.values,
            display: describeValues(fields.value, checked.values),
          } as unknown as Prisma.InputJsonValue,
          priceBreakdown: {
            breakdown: q.breakdown,
            setupFee: q.setupFee,
            quoteOnly: q.quoteOnly,
            version: v.version,
          } as unknown as Prisma.InputJsonValue,
        },
      },
    },
  });
  return { ok: true, orderId: order.id, quote: q };
}

/** תצוגת פריט הזמנה (תבנית או מוצר ישן). */
export function itemDisplay(it: {
  title: string | null;
  printProduct?: { title: string } | null;
  values: unknown;
  customText?: string | null;
  options?: unknown;
}): { title: string; details: string[] } {
  const title = it.title ?? it.printProduct?.title ?? 'מוצר דפוס';
  const v = it.values as { display?: Array<{ label: string; value: string }> } | null;
  if (v?.display) return { title, details: v.display.map((d) => `${d.label}: ${d.value}`) };
  const details: string[] = [];
  if (Array.isArray(it.options) && it.options.length) details.push((it.options as Array<{ name?: string }>).map((o) => o.name).join(', '));
  if (it.customText) details.push(`"${it.customText}"`);
  return { title, details };
}

export type { CleanValues };
