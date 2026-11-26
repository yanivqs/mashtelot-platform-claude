import { Prisma, type PrismaClient } from '@prisma/client';
import {
  parseFields,
  parsePricing,
  quotePrint,
  validateValues,
  describeValues,
  type PrintQuote,
  type RawValues,
  type TemplatePricing,
} from '@/lib/print-template';
import { INSTANT_REVIEWER, priceSnapshot } from '@/lib/print-jobs';
import { loadSignSources } from './load';
import { signFromSource } from './source';

/**
 * שלטי צמחים כמוצר דפוס (print_templates.kind = 'PLANT_SIGN'):
 * המשתלה בוחרת צמחים מהמוצרים שלה וכמות לכל צמח; המחיר לפי סך השלטים (מחירון התבנית).
 * בהזמנה נשמר Snapshot נעול של כל שלט (print_plant_signs) — ה-PDF מופק ממנו בבית הדפוס.
 * מקבל את ה-DB כפרמטר (בר-בדיקה).
 */

export const PLANT_SIGN_KIND = 'PLANT_SIGN';
export const MAX_SIGN_PLANTS = 200;
export const MAX_COPIES_PER_PLANT = 1000;

/** הגרסה המפורסמת של מוצר השלטים הפעיל (הראשון לפי סדר), או null */
export async function findSignTemplate(db: PrismaClient) {
  const v = await db.printTemplateVersion.findFirst({
    where: { status: 'PUBLISHED', template: { kind: PLANT_SIGN_KIND, isActive: true } },
    orderBy: [{ template: { sortOrder: 'asc' } }, { template: { createdAt: 'asc' } }],
    include: { template: true },
  });
  if (!v) return null;
  const fields = parseFields(v.fields);
  const pricing = parsePricing(v.pricing);
  if (!fields.ok || !pricing.ok) return null;
  return { version: v, template: v.template, fields: fields.value, pricing: signPricing(pricing.value) };
}

/** בשלטים הכמות היא סך השלטים — חופשית תמיד (בלי רשימת כמויות שמעבירה להצעת מחיר) */
function signPricing(p: TemplatePricing): TemplatePricing {
  return { ...p, quantityOptions: [], allowCustomQuantity: true };
}

export interface SignLine {
  productId: string;
  quantity: number;
}

/** שורות מהדפדפן: [{ productId, quantity }] — ייחודיות, כמות שלמה בטווח */
export function parseSignLines(v: unknown): SignLine[] | null {
  if (!Array.isArray(v) || v.length === 0 || v.length > MAX_SIGN_PLANTS) return null;
  const seen = new Set<string>();
  const out: SignLine[] = [];
  for (const x of v) {
    const o = x as { productId?: unknown; quantity?: unknown } | null;
    if (!o || typeof o.productId !== 'string' || seen.has(o.productId)) return null;
    const q = Number(o.quantity);
    if (!Number.isInteger(q) || q < 1 || q > MAX_COPIES_PER_PLANT) return null;
    seen.add(o.productId);
    out.push({ productId: o.productId, quantity: q });
  }
  return out;
}

export function signsTotal(lines: SignLine[]): number {
  return lines.reduce((s, l) => s + l.quantity, 0);
}

export type SignQuoteResult = { ok: true; quote: PrintQuote; total: number } | { ok: false; error: string };

/** מחיר לפי סך השלטים (גם לתצוגה בדפדפן לפני ההזמנה) */
export async function quoteSigns(db: PrismaClient, args: { lines: SignLine[]; values: RawValues }): Promise<SignQuoteResult> {
  const t = await findSignTemplate(db);
  if (!t) return { ok: false, error: 'שלטי הצמחים אינם זמינים כרגע להזמנה' };
  const checked = validateValues(t.fields, args.values);
  if (!checked.ok) return { ok: false, error: Object.values(checked.errors)[0] ?? 'יש להשלים את פרטי ההזמנה' };
  const total = signsTotal(args.lines);
  const priced = quotePrint(t.pricing, t.fields, checked.values, total);
  if (!priced.ok) return { ok: false, error: priced.error };
  return { ok: true, quote: priced.quote, total };
}

export type SignOrderResult = { ok: true; orderId: string; quote: PrintQuote } | { ok: false; error: string };

export async function createPlantSignOrder(
  db: PrismaClient,
  args: {
    nurseryId: string;
    userId: string | null;
    actorEmail: string | null;
    lines: SignLine[];
    values: RawValues;
    notes?: string | null;
  },
): Promise<SignOrderResult> {
  const t = await findSignTemplate(db);
  if (!t) return { ok: false, error: 'שלטי הצמחים אינם זמינים כרגע להזמנה' };
  const checked = validateValues(t.fields, args.values);
  if (!checked.ok) return { ok: false, error: Object.values(checked.errors)[0] ?? 'יש להשלים את פרטי ההזמנה' };

  // רק מוצרי-צמח פעילים של המשתלה הזו; השלט נבנה מההגדרות השמורות במוצר
  const sources = await loadSignSources(
    db,
    args.nurseryId,
    args.lines.map((l) => l.productId),
  );
  if (sources.length !== args.lines.length) return { ok: false, error: 'חלק מהצמחים שנבחרו כבר אינם זמינים — רעננו את הדף' };
  const signs = args.lines.map((l, i) => ({ line: l, data: signFromSource(sources[i]!), sortOrder: i }));

  const total = signsTotal(args.lines);
  const priced = quotePrint(t.pricing, t.fields, checked.values, total);
  if (!priced.ok) return { ok: false, error: priced.error };
  const q = priced.quote;

  const plantsLabel = signs.length === 1 ? signs[0]!.data.hebrewName : `${signs.length} צמחים`;
  const name = `${t.template.title} · ${plantsLabel}`.slice(0, 80);
  const display = [
    {
      label: 'צמחים',
      value: signs
        .map((s) => `${s.data.hebrewName} ×${s.line.quantity}`)
        .join(', ')
        .slice(0, 1500),
    },
    ...describeValues(t.fields, checked.values),
  ];
  const values = { raw: checked.values, display, plantSigns: { count: signs.length, total } } as unknown as Prisma.InputJsonValue;

  return db.$transaction(async (tx) => {
    const job = await tx.printSavedProduct.create({ data: { nurseryId: args.nurseryId, templateId: t.template.id, name } });
    const rev = await tx.printSavedRevision.create({
      data: {
        savedProductId: job.id,
        nurseryId: args.nurseryId,
        revision: 1,
        templateVersionId: t.version.id,
        values,
        submittedBy: args.actorEmail,
        status: q.quoteOnly ? 'SUBMITTED' : 'APPROVED',
        ...(q.quoteOnly ? {} : { reviewedAt: new Date(), reviewedBy: INSTANT_REVIEWER }),
      },
    });
    if (!q.quoteOnly) await tx.printSavedProduct.update({ where: { id: job.id }, data: { activeRevisionId: rev.id } });
    const order = await tx.printOrder.create({
      data: {
        nurseryId: args.nurseryId,
        orderedById: args.userId,
        status: q.quoteOnly ? 'QUOTE_REQUESTED' : 'NEW',
        quoteStatus: q.quoteOnly ? 'NEW' : null,
        reviewReasons: q.reasons,
        totalAmount: q.total.toFixed(2),
        notes: args.notes?.trim().slice(0, 2000) || null,
        items: {
          create: {
            templateVersionId: t.version.id,
            savedRevisionId: rev.id,
            title: name,
            quantity: q.quantity,
            unitPrice: q.unitPrice.toFixed(4),
            values,
            priceBreakdown: priceSnapshot(q, t.version.version, { plants: signs.length }),
          },
        },
        plantSigns: {
          create: signs.map((s) => ({
            nurseryId: args.nurseryId,
            nurseryProductId: s.line.productId,
            quantity: s.line.quantity,
            sortOrder: s.sortOrder,
            data: s.data as unknown as Prisma.InputJsonValue,
          })),
        },
      },
    });
    return { ok: true as const, orderId: order.id, quote: q };
  });
}
