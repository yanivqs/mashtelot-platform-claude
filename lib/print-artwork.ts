import { createHash } from 'crypto';
import type { PrintFileKind, PrismaClient } from '@prisma/client';
import { MAX_PRINT_FILE_BYTES, ACCEPTED_LABEL, safeFileName, sniffPrintFile } from '@/lib/print-file-sniff';

/**
 * גרפיקה, הגהה ואישור (PT-05, נספח א.7–א.8). מקבל את ה-DB כפרמטר (בר-בדיקה).
 * - כל העלאה = גרסה חדשה ונעולה; הגרסאות הקודמות מוחלפות (אישור ישן לא עובר לגרסה החדשה).
 * - בית הדפוס מצרף הגהה לגרסה → המשתלה מאשרת/דוחה את הגרסה הזו בלבד, או שבית הדפוס מסמן
 *   אישור טלפוני (עם הערה — החלטת בעלים). אישור רק לגרסה האחרונה, ומותנה בסטטוס.
 */

export type Subject = { savedProductId: string } | { printOrderId: string };

export type FileResult = { ok: true; fileId: string } | { ok: false; error: string };

/** רישום קובץ שהועלה: בדיקת גודל, סוג לפי התוכן וחתימת SHA-256. קובץ לא תקין לא נרשם. */
export async function registerFile(
  db: PrismaClient,
  args: { nurseryId: string; kind: PrintFileKind; storageKey: string; originalName: string; bytes: Buffer | null; actorEmail: string | null },
): Promise<FileResult> {
  const b = args.bytes;
  if (!b || b.length === 0) return { ok: false, error: 'הקובץ לא הגיע לאחסון — נסו שוב' };
  if (b.length > MAX_PRINT_FILE_BYTES) return { ok: false, error: 'הקובץ גדול מ-50MB' };
  const sniff = sniffPrintFile(new Uint8Array(b.buffer, b.byteOffset, Math.min(b.length, 65536)));
  if (!sniff) return { ok: false, error: `סוג קובץ לא נתמך — ${ACCEPTED_LABEL}` };
  const f = await db.printFile.create({
    data: {
      nurseryId: args.nurseryId,
      kind: args.kind,
      storageKey: args.storageKey,
      originalName: safeFileName(args.originalName, sniff.ext),
      mimeType: sniff.mimeType,
      sizeBytes: b.length,
      sha256: createHash('sha256').update(b).digest('hex'),
      widthPx: sniff.widthPx ?? null,
      heightPx: sniff.heightPx ?? null,
      uploadedBy: args.actorEmail,
    },
  });
  return { ok: true, fileId: f.id };
}

/** האם הנושא (מוצר קבוע / הזמנה) שייך למשתלה. */
export async function ownsSubject(db: PrismaClient, nurseryId: string, s: Subject): Promise<boolean> {
  if ('savedProductId' in s) return (await db.printSavedProduct.count({ where: { id: s.savedProductId, nurseryId } })) === 1;
  return (await db.printOrder.count({ where: { id: s.printOrderId, nurseryId } })) === 1;
}

export type VersionResult = { ok: true; versionId: string; version: number } | { ok: false; error: string };

export async function addArtworkVersion(
  db: PrismaClient,
  args: { nurseryId: string; subject: Subject; fileId: string; actorEmail: string | null },
): Promise<VersionResult> {
  if (!(await ownsSubject(db, args.nurseryId, args.subject))) return { ok: false, error: 'לא נמצא' };
  // PT-06: אחרי שחרור לייצור הגרפיקה של ההזמנה נעולה
  if ('printOrderId' in args.subject) {
    const o = await db.printOrder.findUnique({ where: { id: args.subject.printOrderId }, select: { releasedAt: true } });
    if (o?.releasedAt) return { ok: false, error: 'ההזמנה כבר שוחררה לייצור — לשינוי פנו לבית הדפוס' };
  }
  const file = await db.printFile.findFirst({ where: { id: args.fileId, nurseryId: args.nurseryId, kind: 'ARTWORK' } });
  if (!file) return { ok: false, error: 'הקובץ לא נמצא' };
  return db.$transaction(async (tx) => {
    const where = 'savedProductId' in args.subject ? { savedProductId: args.subject.savedProductId } : { printOrderId: args.subject.printOrderId };
    const artwork = (await tx.printArtwork.findFirst({ where })) ?? (await tx.printArtwork.create({ data: { nurseryId: args.nurseryId, ...where } }));
    // גרסאות קודמות מוחלפות — אישור ישן לא חל על הקובץ החדש
    await tx.printArtworkVersion.updateMany({
      where: { artworkId: artwork.id, status: { in: ['UPLOADED', 'PROOF_SENT', 'APPROVED'] } },
      data: { status: 'SUPERSEDED' },
    });
    const last = await tx.printArtworkVersion.findFirst({ where: { artworkId: artwork.id }, orderBy: { version: 'desc' }, select: { version: true } });
    const v = await tx.printArtworkVersion.create({
      data: { artworkId: artwork.id, nurseryId: args.nurseryId, version: (last?.version ?? 0) + 1, fileId: file.id, createdBy: args.actorEmail },
    });
    return { ok: true as const, versionId: v.id, version: v.version };
  });
}

/** בית הדפוס מצרף הגהה לגרסה האחרונה שהועלתה. */
export async function attachProof(db: PrismaClient, args: { versionId: string; fileId: string; actorEmail: string | null }): Promise<{ ok: boolean; error?: string }> {
  const v = await db.printArtworkVersion.findUnique({ where: { id: args.versionId } });
  if (!v) return { ok: false, error: 'הגרסה לא נמצאה' };
  const file = await db.printFile.findFirst({ where: { id: args.fileId, nurseryId: v.nurseryId, kind: 'PROOF' } });
  if (!file) return { ok: false, error: 'קובץ ההגהה לא נמצא' };
  const r = await db.printArtworkVersion.updateMany({
    where: { id: v.id, status: 'UPLOADED' },
    data: { status: 'PROOF_SENT', proofFileId: file.id, proofSentAt: new Date(), proofSentBy: args.actorEmail },
  });
  return r.count === 1 ? { ok: true } : { ok: false, error: 'אפשר לצרף הגהה רק לגרסה שהועלתה ועדיין לא טופלה' };
}

export type DecideResult = { ok: true } | { ok: false; error: string };

/**
 * החלטה על הגהה: OWNER — בעל המשתלה (רק הגרסה של המשתלה שלו); PHONE — בית הדפוס בשם המשתלה,
 * עם הערה חובה (מי אישר ומתי). דחייה — הערה חובה. רק על גרסה במצב PROOF_SENT (גרסה שהוחלפה לא תאושר).
 */
export async function decideArtwork(
  db: PrismaClient,
  args: {
    versionId: string;
    approve: boolean;
    method: 'OWNER' | 'PHONE';
    /** חובה ל-OWNER: המשתלה של המשתמש */
    nurseryId?: string;
    actorEmail: string | null;
    note?: string | null;
  },
): Promise<DecideResult> {
  const note = args.note?.trim().slice(0, 1000) || null;
  if (args.method === 'PHONE' && !note) return { ok: false, error: 'באישור/דחייה טלפוניים יש לתעד עם מי דיברתם ומתי' };
  if (!args.approve && !note) return { ok: false, error: 'בדחייה יש לכתוב מה לתקן' };
  const v = await db.printArtworkVersion.findUnique({ where: { id: args.versionId } });
  if (!v || (args.method === 'OWNER' && v.nurseryId !== args.nurseryId)) return { ok: false, error: 'הגרסה לא נמצאה' };
  const r = await db.printArtworkVersion.updateMany({
    where: { id: v.id, status: 'PROOF_SENT' },
    data: args.approve
      ? { status: 'APPROVED', approvedAt: new Date(), approvedBy: args.actorEmail, approvalMethod: args.method, decisionNote: note }
      : { status: 'REJECTED', decisionNote: note, approvedBy: args.actorEmail, approvalMethod: args.method },
  });
  return r.count === 1 ? { ok: true } : { ok: false, error: 'ההגהה כבר טופלה או שהועלתה גרסה חדשה — רעננו' };
}
