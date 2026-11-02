import type { Prisma, PrismaClient } from '@prisma/client';
import { describeValues, parseFields, validateValues, type RawValues } from '@/lib/print-template';

/**
 * עבודות דפוס קודמות: הסופר-אדמין מוסיף למשתלה עבודות שהודפסו בעבר, עם פרטי ההזמנה, והמשתלה רואה אותן
 * ב"העבודות שלי" ומזמינה שוב. עבודה מקושרת למוצר מהקטלוג מתומחרת במחירון; עבודה בלי מוצר עוברת להצעת מחיר.
 * הזמנה מיובאת היא היסטוריה בלבד: לא מופיעה בתור ההזמנות ולא עוברת ייצור. מקבל את ה-DB כפרמטר (בר-בדיקה).
 */

const MAX_NAME = 80;
export const IMPORT_REVIEW_REASON = 'עבודה מהדפסה קודמת: נדרשת הצעת מחיר';
const IMPORT_NOTE = 'עבודה קודמת שנוספה בידי בית הדפוס';

/** תאריך יום מטופס (YYYY-MM-DD) שאינו בעתיד. הצהריים ב-UTC, כדי שהיום לא יזוז באזור זמן אחר. */
export function parsePastDate(v: unknown, now = new Date()): Date | null {
  const s = String(v ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) return null;
  return d.getTime() > now.getTime() + 24 * 60 * 60 * 1000 ? null : d;
}

export interface ImportedOrderInput {
  date: Date;
  quantity: number;
  /** סכום ההזמנה; ריק — לא מוצג מחיר */
  price: number | null;
}

function orderError(o: ImportedOrderInput): string | null {
  if (!Number.isInteger(o.quantity) || o.quantity < 1) return 'כמות לא תקינה';
  if (o.price !== null && (!Number.isFinite(o.price) || o.price < 0)) return 'מחיר לא תקין';
  return null;
}

const orderData = (nurseryId: string, savedProductId: string, title: string, display: unknown, o: ImportedOrderInput): Prisma.PrintOrderCreateInput => ({
  nursery: { connect: { id: nurseryId } },
  imported: true,
  status: 'DELIVERED',
  totalAmount: (o.price ?? 0).toFixed(2),
  notes: IMPORT_NOTE,
  createdAt: o.date,
  items: {
    create: {
      savedProduct: { connect: { id: savedProductId } },
      title,
      quantity: o.quantity,
      unitPrice: ((o.price ?? 0) / o.quantity).toFixed(4),
      values: { display } as Prisma.InputJsonValue,
    },
  },
});

export type ImportResult = { ok: true; savedProductId: string } | { ok: false; error?: string; fieldErrors?: Record<string, string> };

export async function createImportedJob(
  db: PrismaClient,
  args: {
    nurseryId: string;
    actorEmail: string | null;
    name: string;
    description?: string | null;
    /** מוצר מהקטלוג, אם העבודה שייכת לאחד */
    templateId?: string | null;
    values?: RawValues;
    order: ImportedOrderInput;
  },
): Promise<ImportResult> {
  const name = args.name.trim().slice(0, MAX_NAME);
  if (!name) return { ok: false, error: 'יש לתת שם לעבודה' };
  const err = orderError(args.order);
  if (err) return { ok: false, error: err };
  if (!(await db.nursery.count({ where: { id: args.nurseryId } }))) return { ok: false, error: 'המשתלה לא נמצאה' };
  const description = args.description?.trim().slice(0, 2000) || null;

  let revision: { templateVersionId: string; values: Prisma.InputJsonValue } | null = null;
  let display: Array<{ label: string; value: string }> = [];
  if (args.templateId) {
    const v = await db.printTemplateVersion.findFirst({ where: { templateId: args.templateId, status: 'PUBLISHED' } });
    if (!v) return { ok: false, error: 'למוצר אין גרסה מפורסמת' };
    const fields = parseFields(v.fields);
    if (!fields.ok) return { ok: false, error: 'הגדרת המוצר אינה תקינה' };
    const checked = validateValues(fields.value, args.values ?? {});
    if (!checked.ok) return { ok: false, fieldErrors: checked.errors };
    display = describeValues(fields.value, checked.values);
    revision = { templateVersionId: v.id, values: { raw: checked.values, display } as unknown as Prisma.InputJsonValue };
  }

  const id = await db.$transaction(async (tx) => {
    const job = await tx.printSavedProduct.create({
      data: { nurseryId: args.nurseryId, templateId: args.templateId || null, name, description, importedAt: new Date(), importedBy: args.actorEmail },
    });
    if (revision) {
      const rev = await tx.printSavedRevision.create({
        data: {
          savedProductId: job.id,
          nurseryId: args.nurseryId,
          revision: 1,
          ...revision,
          status: 'APPROVED',
          submittedBy: args.actorEmail,
          reviewedAt: new Date(),
          reviewedBy: args.actorEmail,
          reviewNote: IMPORT_NOTE,
        },
      });
      await tx.printSavedProduct.update({ where: { id: job.id }, data: { activeRevisionId: rev.id } });
    }
    await tx.printOrder.create({ data: orderData(args.nurseryId, job.id, name, display, args.order) });
    return job.id;
  });
  return { ok: true, savedProductId: id };
}

export async function addImportedOrder(db: PrismaClient, savedProductId: string, order: ImportedOrderInput): Promise<{ ok: boolean; error?: string; nurseryId?: string }> {
  const err = orderError(order);
  if (err) return { ok: false, error: err };
  const job = await db.printSavedProduct.findFirst({ where: { id: savedProductId, importedAt: { not: null } }, include: { activeRevision: true } });
  if (!job) return { ok: false, error: 'העבודה לא נמצאה' };
  const display = (job.activeRevision?.values as { display?: unknown } | null)?.display ?? [];
  await db.printOrder.create({ data: orderData(job.nurseryId, job.id, job.name, display, order) });
  return { ok: true, nurseryId: job.nurseryId };
}

export async function updateImportedJob(db: PrismaClient, savedProductId: string, data: { name: string; description?: string | null }): Promise<{ ok: boolean; error?: string; nurseryId?: string }> {
  const name = data.name.trim().slice(0, MAX_NAME);
  if (!name) return { ok: false, error: 'יש לתת שם לעבודה' };
  const job = await db.printSavedProduct.findFirst({ where: { id: savedProductId, importedAt: { not: null } } });
  if (!job) return { ok: false, error: 'העבודה לא נמצאה' };
  await db.printSavedProduct.update({ where: { id: job.id }, data: { name, description: data.description?.trim().slice(0, 2000) || null } });
  return { ok: true, nurseryId: job.nurseryId };
}

/** גרפיקה של עבודה שכבר הודפסה נחשבת מאושרת: בהזמנה חוזרת לא צריך הגהה נוספת. גרסה קודמת מוחלפת. */
export async function addImportedArtwork(db: PrismaClient, args: { savedProductId: string; fileId: string; actorEmail: string | null }): Promise<{ ok: boolean; error?: string }> {
  const job = await db.printSavedProduct.findFirst({ where: { id: args.savedProductId, importedAt: { not: null } } });
  if (!job) return { ok: false, error: 'העבודה לא נמצאה' };
  const file = await db.printFile.findFirst({ where: { id: args.fileId, nurseryId: job.nurseryId, kind: 'ARTWORK' } });
  if (!file) return { ok: false, error: 'הקובץ לא נמצא' };
  await db.$transaction(async (tx) => {
    const artwork = (await tx.printArtwork.findFirst({ where: { savedProductId: job.id } })) ?? (await tx.printArtwork.create({ data: { nurseryId: job.nurseryId, savedProductId: job.id } }));
    await tx.printArtworkVersion.updateMany({ where: { artworkId: artwork.id, status: { in: ['UPLOADED', 'PROOF_SENT', 'APPROVED'] } }, data: { status: 'SUPERSEDED' } });
    const last = await tx.printArtworkVersion.findFirst({ where: { artworkId: artwork.id }, orderBy: { version: 'desc' }, select: { version: true } });
    await tx.printArtworkVersion.create({
      data: {
        artworkId: artwork.id,
        nurseryId: job.nurseryId,
        version: (last?.version ?? 0) + 1,
        fileId: file.id,
        status: 'APPROVED',
        approvedAt: new Date(),
        approvedBy: args.actorEmail,
        approvalMethod: 'PHONE',
        decisionNote: IMPORT_NOTE,
        createdBy: args.actorEmail,
      },
    });
  });
  return { ok: true };
}

/** מחיקת עבודה שנוספה בטעות. עבודה שהמשתלה כבר הזמינה ממנה לא נמחקת. */
export async function deleteImportedJob(db: PrismaClient, savedProductId: string): Promise<{ ok: boolean; error?: string; nurseryId?: string }> {
  const job = await db.printSavedProduct.findFirst({ where: { id: savedProductId, importedAt: { not: null } } });
  if (!job) return { ok: false, error: 'העבודה לא נמצאה' };
  const realOrders = await db.printOrder.count({
    where: { imported: false, items: { some: { OR: [{ savedProductId: job.id }, { savedRevision: { savedProductId: job.id } }] } } },
  });
  if (realOrders > 0) return { ok: false, error: 'המשתלה כבר הזמינה מהעבודה הזו, ולכן אי אפשר למחוק אותה' };
  await db.$transaction([
    db.printOrder.deleteMany({ where: { imported: true, items: { some: { savedProductId: job.id } } } }),
    db.printSavedProduct.update({ where: { id: job.id }, data: { activeRevisionId: null } }),
    db.printSavedProduct.delete({ where: { id: job.id } }),
  ]);
  return { ok: true, nurseryId: job.nurseryId };
}

/** הזמנה חוזרת של עבודה בלי מוצר מהקטלוג: אין מחירון, ולכן נפתחת בקשת הצעת מחיר. */
export async function reorderImportedJob(
  db: PrismaClient,
  args: { nurseryId: string; userId: string | null; savedProductId: string; quantity: number; notes?: string | null },
): Promise<{ ok: true; orderId: string } | { ok: false; error: string }> {
  if (!Number.isInteger(args.quantity) || args.quantity < 1) return { ok: false, error: 'כמות לא תקינה' };
  const job = await db.printSavedProduct.findFirst({ where: { id: args.savedProductId, nurseryId: args.nurseryId, isArchived: false, templateId: null, importedAt: { not: null } } });
  if (!job) return { ok: false, error: 'העבודה לא נמצאה' };
  const order = await db.printOrder.create({
    data: {
      nurseryId: args.nurseryId,
      orderedById: args.userId,
      status: 'QUOTE_REQUESTED',
      quoteStatus: 'NEW',
      reviewReasons: [IMPORT_REVIEW_REASON],
      totalAmount: '0.00',
      notes: args.notes?.trim().slice(0, 2000) || null,
      items: {
        create: {
          savedProductId: job.id,
          title: job.name,
          quantity: args.quantity,
          unitPrice: '0.0000',
          values: { display: job.description ? [{ label: 'תיאור', value: job.description }] : [] } as Prisma.InputJsonValue,
        },
      },
    },
  });
  return { ok: true, orderId: order.id };
}
