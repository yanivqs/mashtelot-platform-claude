import { Prisma, type PrismaClient } from '@prisma/client';
import { describeValues, parseFields, parsePricing, quotePrint, validateValues, type CleanValues, type PrintQuote, type RawValues } from '@/lib/print-template';

/**
 * מוצר דפוס קבוע (PT-04, נספח א.6): המשתלה מגישה מפרט (גרסת תבנית + ערכים) → בית הדפוס מאשר
 * → המפרט ננעל, ומזמינים ממנו שוב עם כמות והערות בלבד. שינוי מפרט = גרסה חדשה לאישור;
 * עד שתאושר, ההזמנות ממשיכות מהגרסה המאושרת הקודמת. מקבל את ה-DB כפרמטר (בר-בדיקה).
 */

export type SubmitResult = { ok: true; savedProductId: string; revision: number } | { ok: false; error?: string; fieldErrors?: Record<string, string> };

export async function submitSpec(
  db: PrismaClient,
  args: {
    nurseryId: string;
    actorEmail: string | null;
    templateVersionId: string;
    values: RawValues;
    /** שם פנימי — חובה במוצר חדש */
    name?: string;
    /** בקשת שינוי למוצר קיים */
    savedProductId?: string | null;
  },
): Promise<SubmitResult> {
  const v = await db.printTemplateVersion.findUnique({ where: { id: args.templateVersionId }, include: { template: true } });
  if (!v || v.status !== 'PUBLISHED' || !v.template.isActive) return { ok: false, error: 'המוצר אינו זמין — רעננו את הדף' };
  const fields = parseFields(v.fields);
  if (!fields.ok) return { ok: false, error: 'הגדרת המוצר אינה תקינה — פנו לבית הדפוס' };
  const checked = validateValues(fields.value, args.values);
  if (!checked.ok) return { ok: false, fieldErrors: checked.errors };
  const values = { raw: checked.values, display: describeValues(fields.value, checked.values) } as unknown as Prisma.InputJsonValue;

  try {
    return await db.$transaction(async (tx) => {
      let productId = args.savedProductId ?? null;
      if (productId) {
        const p = await tx.printSavedProduct.findFirst({ where: { id: productId, nurseryId: args.nurseryId, isArchived: false } });
        if (!p) return { ok: false as const, error: 'המוצר הקבוע לא נמצא' };
        if (p.templateId !== v.templateId) return { ok: false as const, error: 'בקשת שינוי חייבת להיות על אותו מוצר דפוס' };
      } else {
        const name = (args.name ?? '').trim();
        if (!name || name.length > 80) return { ok: false as const, error: 'יש לתת שם למוצר הקבוע (עד 80 תווים)' };
        const p = await tx.printSavedProduct.create({ data: { nurseryId: args.nurseryId, templateId: v.templateId, name } });
        productId = p.id;
      }
      const last = await tx.printSavedRevision.findFirst({ where: { savedProductId: productId }, orderBy: { revision: 'desc' }, select: { revision: true } });
      const revision = (last?.revision ?? 0) + 1;
      await tx.printSavedRevision.create({
        data: {
          savedProductId: productId,
          nurseryId: args.nurseryId,
          revision,
          templateVersionId: v.id,
          values,
          submittedBy: args.actorEmail,
        },
      });
      return { ok: true as const, savedProductId: productId, revision };
    });
  } catch (e) {
    // בקשה ממתינה אחת לכל מוצר (אינדקס חלקי)
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return { ok: false, error: 'כבר יש בקשה ממתינה לאישור למוצר הזה' };
    }
    throw e;
  }
}

export type ReviewResult = { ok: true } | { ok: false; error: string };

/** אישור/דחייה בידי בית הדפוס. אישור: הגרסה הקודמת מוחלפת, והגרסה הזו נעשית הפעילה. */
export async function reviewSpec(
  db: PrismaClient,
  args: { revisionId: string; approve: boolean; note?: string | null; actorEmail: string | null },
): Promise<ReviewResult> {
  const note = args.note?.trim().slice(0, 1000) || null;
  if (!args.approve && !note) return { ok: false, error: 'בדחייה יש לכתוב למשתלה מה לתקן' };
  return db.$transaction(async (tx) => {
    const rev = await tx.printSavedRevision.findUnique({ where: { id: args.revisionId }, include: { savedProduct: true } });
    if (!rev) return { ok: false as const, error: 'הבקשה לא נמצאה' };
    const res = await tx.printSavedRevision.updateMany({
      where: { id: rev.id, status: 'SUBMITTED' },
      data: { status: args.approve ? 'APPROVED' : 'REJECTED', reviewedBy: args.actorEmail, reviewedAt: new Date(), reviewNote: note },
    });
    if (res.count !== 1) return { ok: false as const, error: 'הבקשה כבר טופלה' };
    if (args.approve) {
      const prev = rev.savedProduct.activeRevisionId;
      if (prev) {
        await tx.printSavedProduct.update({ where: { id: rev.savedProductId }, data: { activeRevisionId: null } });
        await tx.printSavedRevision.update({ where: { id: prev }, data: { status: 'SUPERSEDED' } });
      }
      await tx.printSavedProduct.update({ where: { id: rev.savedProductId }, data: { activeRevisionId: rev.id } });
    }
    return { ok: true as const };
  });
}

export type ReorderResult = { ok: true; orderId: string; quote: PrintQuote } | { ok: false; error: string };

/**
 * הזמנה ממוצר קבוע: רק מהגרסה המאושרת, רק כמות והערות משתנות. התמחור לפי גרסת התבנית
 * שאושרה במפרט (המחיר שאושר אינו משתנה בדיעבד); הפריט שומר Snapshot וקישור לגרסת המפרט.
 */
export async function orderSaved(
  db: PrismaClient,
  args: { nurseryId: string; userId: string | null; savedProductId: string; quantity: number; notes?: string | null },
): Promise<ReorderResult> {
  const p = await db.printSavedProduct.findFirst({
    where: { id: args.savedProductId, nurseryId: args.nurseryId, isArchived: false },
    include: { activeRevision: { include: { templateVersion: { include: { template: true } } } } },
  });
  const rev = p?.activeRevision;
  if (!p || !rev || rev.status !== 'APPROVED') return { ok: false, error: 'למוצר אין מפרט מאושר' };
  if (!rev.templateVersion.template.isActive) return { ok: false, error: 'מוצר הדפוס הזה אינו זמין כרגע — פנו לבית הדפוס' };
  const fields = parseFields(rev.templateVersion.fields);
  const pricing = parsePricing(rev.templateVersion.pricing);
  if (!fields.ok || !pricing.ok) return { ok: false, error: 'הגדרת המוצר אינה תקינה — פנו לבית הדפוס' };
  const raw = ((rev.values as { raw?: CleanValues } | null)?.raw ?? {}) as CleanValues;
  const priced = quotePrint(pricing.value, fields.value, raw, args.quantity);
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
          templateVersionId: rev.templateVersionId,
          savedRevisionId: rev.id,
          title: `${rev.templateVersion.template.title} — ${p.name}`,
          quantity: q.quantity,
          unitPrice: q.unitPrice.toFixed(2),
          values: rev.values as Prisma.InputJsonValue,
          priceBreakdown: {
            breakdown: q.breakdown,
            setupFee: q.setupFee,
            quoteOnly: q.quoteOnly,
            version: rev.templateVersion.version,
            specRevision: rev.revision,
          } as unknown as Prisma.InputJsonValue,
        },
      },
    },
  });
  return { ok: true, orderId: order.id, quote: q };
}

export async function archiveSaved(db: PrismaClient, nurseryId: string, savedProductId: string): Promise<boolean> {
  const r = await db.printSavedProduct.updateMany({ where: { id: savedProductId, nurseryId }, data: { isArchived: true } });
  return r.count === 1;
}

/** שינויים בין שני מפרטים (לבית הדפוס בבקשת שינוי). */
export function specDiff(
  prev: { display?: Array<{ label: string; value: string }> } | null,
  next: { display?: Array<{ label: string; value: string }> } | null,
): Array<{ label: string; from: string; to: string }> {
  const a = new Map((prev?.display ?? []).map((d) => [d.label, d.value]));
  const b = new Map((next?.display ?? []).map((d) => [d.label, d.value]));
  const out: Array<{ label: string; from: string; to: string }> = [];
  for (const label of new Set([...a.keys(), ...b.keys()])) {
    const from = a.get(label) ?? '—';
    const to = b.get(label) ?? '—';
    if (from !== to) out.push({ label, from, to });
  }
  return out;
}
