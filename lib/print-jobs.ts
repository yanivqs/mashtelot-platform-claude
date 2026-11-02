import { Prisma, type PrismaClient } from '@prisma/client';
import {
  describeValues,
  missingForSubmit,
  parseFields,
  parsePricing,
  quotePrint,
  sizeFromValues,
  validateValues,
  type PrintQuote,
  type RawValues,
} from '@/lib/print-template';
import { checkResolution } from '@/lib/print-preflight';

/**
 * עבודות דפוס: כל הזמנה מהמחשבון יוצרת עבודה (PrintSavedProduct) עם מפרט נעול וגרפיקה, וממנה מזמינים שוב.
 * מחיר מיידי — המפרט מאושר מיד (החלטת בעלים); בדיקת צוות — המפרט ממתין לאישור בית הדפוס.
 * גרפיקה, הגהה, קובץ ייצור ושחרור נשארים ידניים (lib/print-release.ts). מקבל את ה-DB כפרמטר (בר-בדיקה).
 */

export const INSTANT_REVIEWER = 'אישור אוטומטי: מחיר מיידי';

const MAX_NAME = 80;

/** שם ברירת מחדל: שם המוצר ועיקר המפרט ("קופסת עציץ · A4 · כרומו"). */
export function defaultJobName(title: string, display: Array<{ value: string }>): string {
  const parts = display.slice(0, 2).map((d) => d.value).filter((v) => v.length <= 24);
  return [title, ...parts].join(' · ').slice(0, MAX_NAME);
}

export type JobOrderResult =
  | { ok: true; orderId: string; savedProductId: string; name: string; quote: PrintQuote }
  | { ok: false; error?: string; fieldErrors?: Record<string, string>; missing?: string[] };

export async function createJobOrder(
  db: PrismaClient,
  args: {
    nurseryId: string;
    userId: string | null;
    actorEmail: string | null;
    templateVersionId: string;
    values: RawValues;
    quantity: number;
    notes?: string | null;
    /** קובץ שהועלה במחשבון */
    fileId?: string | null;
    /** "אין לי קובץ, אני צריך גם עיצוב" — גובר על קובץ */
    needsDesign?: boolean;
    name?: string | null;
  },
): Promise<JobOrderResult> {
  const v = await db.printTemplateVersion.findUnique({ where: { id: args.templateVersionId }, include: { template: true } });
  if (!v || v.status !== 'PUBLISHED' || !v.template.isActive) return { ok: false, error: 'המוצר אינו זמין להזמנה — רעננו את הדף' };
  const fields = parseFields(v.fields);
  const pricing = parsePricing(v.pricing);
  if (!fields.ok || !pricing.ok) return { ok: false, error: 'הגדרת המוצר אינה תקינה — פנו לבית הדפוס' };

  const needsDesign = args.needsDesign === true;
  const fileId = needsDesign ? null : args.fileId || null;
  const file = fileId ? await db.printFile.findFirst({ where: { id: fileId, nurseryId: args.nurseryId, kind: 'ARTWORK' } }) : null;
  if (fileId && !file) return { ok: false, error: 'הקובץ לא נמצא — העלו אותו שוב' };

  const checked = validateValues(fields.value, args.values);
  if (!checked.ok) return { ok: false, fieldErrors: checked.errors };
  const missing = missingForSubmit(pricing.value, fields.value, args.values, args.quantity, {
    required: v.template.requiresArtwork,
    hasFile: Boolean(file),
    needsDesign,
  });
  if (missing.length) return { ok: false, missing };

  const lowResolution = file ? checkResolution(file, sizeFromValues(fields.value, checked.values)).status === 'low' : false;
  const priced = quotePrint(pricing.value, fields.value, checked.values, args.quantity, { needsDesign, lowResolution });
  if (!priced.ok) return { ok: false, error: priced.error };
  const q = priced.quote;

  const display = describeValues(fields.value, checked.values);
  const name = (args.name ?? '').trim().slice(0, MAX_NAME) || defaultJobName(v.template.title, display);
  const values = { raw: checked.values, display } as unknown as Prisma.InputJsonValue;

  return db.$transaction(async (tx) => {
    const job = await tx.printSavedProduct.create({ data: { nurseryId: args.nurseryId, templateId: v.templateId, name } });
    const rev = await tx.printSavedRevision.create({
      data: {
        savedProductId: job.id,
        nurseryId: args.nurseryId,
        revision: 1,
        templateVersionId: v.id,
        values,
        submittedBy: args.actorEmail,
        status: q.quoteOnly ? 'SUBMITTED' : 'APPROVED',
        ...(q.quoteOnly ? {} : { reviewedAt: new Date(), reviewedBy: INSTANT_REVIEWER }),
      },
    });
    if (!q.quoteOnly) await tx.printSavedProduct.update({ where: { id: job.id }, data: { activeRevisionId: rev.id } });
    if (file) {
      const artwork = await tx.printArtwork.create({ data: { nurseryId: args.nurseryId, savedProductId: job.id } });
      await tx.printArtworkVersion.create({ data: { artworkId: artwork.id, nurseryId: args.nurseryId, version: 1, fileId: file.id, createdBy: args.actorEmail } });
    }
    const order = await tx.printOrder.create({
      data: {
        nurseryId: args.nurseryId,
        orderedById: args.userId,
        status: q.quoteOnly ? 'QUOTE_REQUESTED' : 'NEW',
        quoteStatus: q.quoteOnly ? 'NEW' : null,
        reviewReasons: q.reasons,
        needsDesign,
        totalAmount: q.total.toFixed(2),
        notes: args.notes?.trim().slice(0, 2000) || null,
        items: {
          create: {
            templateVersionId: v.id,
            savedRevisionId: rev.id,
            title: name,
            quantity: q.quantity,
            unitPrice: q.unitPrice.toFixed(4),
            values,
            priceBreakdown: priceSnapshot(q, v.version),
          },
        },
      },
    });
    return { ok: true as const, orderId: order.id, savedProductId: job.id, name, quote: q };
  });
}

export function priceSnapshot(q: PrintQuote, version: number, extra: Record<string, unknown> = {}): Prisma.InputJsonValue {
  return {
    breakdown: q.breakdown,
    setupFee: q.setupFee,
    fixedAdds: q.fixedAdds,
    percent: q.percent,
    minCharges: q.minCharges,
    perUnit: q.perUnit,
    quoteOnly: q.quoteOnly,
    version,
    ...extra,
  } as unknown as Prisma.InputJsonValue;
}

export async function renameJob(db: PrismaClient, nurseryId: string, savedProductId: string, name: string): Promise<boolean> {
  const clean = name.trim().slice(0, MAX_NAME);
  if (!clean) return false;
  const r = await db.printSavedProduct.updateMany({ where: { id: savedProductId, nurseryId }, data: { name: clean } });
  return r.count === 1;
}

// ---------- הצעת מחיר ----------

/** הצעה שנשלחה ועבר תוקפה. התוקף מחושב בשרת בכל בקשה; אין סטטוס שמור. */
export function isQuoteExpired(o: { quoteValidUntil: Date | null }, now = new Date()): boolean {
  return Boolean(o.quoteValidUntil && o.quoteValidUntil.getTime() < now.getTime());
}

/** בית הדפוס שולח הצעה: המחיר נקבע, וההזמנה ממתינה לתשובת המשתלה. */
export async function sendQuote(
  db: PrismaClient,
  args: { orderId: string; total: number; validUntil?: Date | null; adminNotes?: string | null },
): Promise<{ ok: boolean; error?: string; nurseryId?: string }> {
  if (!Number.isFinite(args.total) || args.total <= 0) return { ok: false, error: 'יש להזין סכום גדול מ-0' };
  const order = await db.printOrder.findUnique({ where: { id: args.orderId }, include: { items: true } });
  if (!order || order.status !== 'QUOTE_REQUESTED') return { ok: false, error: 'ההזמנה אינה ממתינה להצעת מחיר' };
  const units = order.items.reduce((s, i) => s + i.quantity, 0) || 1;
  const done = await db.$transaction(async (tx) => {
    const r = await tx.printOrder.updateMany({
      where: { id: args.orderId, status: 'QUOTE_REQUESTED' },
      data: {
        quoteStatus: 'SENT',
        totalAmount: args.total.toFixed(2),
        quoteValidUntil: args.validUntil ?? null,
        ...(args.adminNotes !== undefined ? { adminNotes: args.adminNotes?.trim().slice(0, 2000) || null } : {}),
      },
    });
    if (r.count !== 1) return false;
    for (const it of order.items) await tx.printOrderItem.update({ where: { id: it.id }, data: { unitPrice: (args.total / units).toFixed(4) } });
    return true;
  });
  return done ? { ok: true, nurseryId: order.nurseryId } : { ok: false, error: 'ההזמנה עודכנה במקביל — רעננו' };
}

/** בית הדפוס: סימון "בטיפול", דחיית הבקשה או עדכון הערות פנימיות. */
export async function updateQuote(
  db: PrismaClient,
  args: { orderId: string; intent: 'progress' | 'reject' | 'notes'; adminNotes?: string | null },
): Promise<{ ok: boolean; error?: string; nurseryId?: string }> {
  const notes = args.adminNotes !== undefined ? { adminNotes: args.adminNotes?.trim().slice(0, 2000) || null } : {};
  const data: Prisma.PrintOrderUpdateManyMutationInput =
    args.intent === 'progress' ? { quoteStatus: 'IN_PROGRESS', ...notes } : args.intent === 'reject' ? { quoteStatus: 'REJECTED', status: 'CANCELLED', ...notes } : notes;
  const r = await db.printOrder.updateMany({ where: { id: args.orderId, status: 'QUOTE_REQUESTED' }, data });
  if (r.count !== 1) return { ok: false, error: 'ההזמנה אינה ממתינה להצעת מחיר' };
  const o = await db.printOrder.findUnique({ where: { id: args.orderId }, select: { nurseryId: true } });
  return { ok: true, nurseryId: o?.nurseryId };
}

/** המשתלה מאשרת או דוחה הצעה שנשלחה אליה. אישור הופך את הבקשה להזמנה; הצעה שפג תוקפה נחסמת. */
export async function decideQuote(
  db: PrismaClient,
  args: { orderId: string; nurseryId: string; approve: boolean },
  now = new Date(),
): Promise<{ ok: boolean; error?: string }> {
  const o = await db.printOrder.findFirst({ where: { id: args.orderId, nurseryId: args.nurseryId } });
  if (!o || o.status !== 'QUOTE_REQUESTED' || o.quoteStatus !== 'SENT') return { ok: false, error: 'אין הצעה שממתינה לתשובה — רעננו' };
  if (args.approve && isQuoteExpired(o, now)) return { ok: false, error: 'תוקף ההצעה פג — פנו לבית הדפוס להצעה חדשה' };
  const r = await db.printOrder.updateMany({
    where: { id: o.id, status: 'QUOTE_REQUESTED', quoteStatus: 'SENT' },
    data: args.approve ? { status: 'NEW', quoteStatus: 'APPROVED' } : { status: 'CANCELLED', quoteStatus: 'REJECTED' },
  });
  return r.count === 1 ? { ok: true } : { ok: false, error: 'ההצעה עודכנה במקביל — רעננו' };
}

// ---------- קבצים ----------

const MAX_THUMBNAIL = 150 * 1024;

/**
 * שמירת תמונה קטנה שנוצרה בדפדפן. התוכן מגיע מהלקוח, לכן נשמר רק JPEG עד 150KB, ומוגש כ-image/jpeg
 * עם nosniff ובדיקת הרשאה. תמונה לא תקינה נזרקת בשקט: העבודה תציג אייקון.
 */
export async function saveThumbnail(db: PrismaClient, fileId: string, dataUrl: string | null | undefined): Promise<boolean> {
  const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl ?? '');
  if (!m) return false;
  const bytes = Buffer.from(m[1]!, 'base64');
  if (bytes.length < 4 || bytes.length > MAX_THUMBNAIL || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) return false;
  await db.printFileThumbnail.upsert({ where: { fileId }, create: { fileId, bytes }, update: { bytes } });
  return true;
}

const DRAFT_FILE_DAYS = 7;

/** קובץ שהועלה במחשבון ולא שויך להזמנה נמחק אחרי 7 ימים (מהמשימה היומית). */
export async function removeOrphanDraftFiles(
  db: PrismaClient,
  removeFromStorage: (key: string) => Promise<unknown>,
  now = new Date(),
): Promise<number> {
  const before = new Date(now.getTime() - DRAFT_FILE_DAYS * 24 * 60 * 60 * 1000);
  const orphans = await db.printFile.findMany({
    where: { kind: 'ARTWORK', createdAt: { lt: before }, artworkOf: { none: {} }, proofOf: { none: {} }, productionOf: { none: {} } },
    select: { id: true, storageKey: true },
    take: 200,
  });
  for (const f of orphans) {
    await removeFromStorage(f.storageKey);
    await db.printFile.delete({ where: { id: f.id } });
  }
  return orphans.length;
}
