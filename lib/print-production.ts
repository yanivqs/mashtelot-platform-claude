import type { Prisma, PrismaClient } from '@prisma/client';
import { canMove, evaluateGate, type GateCheck, type GateInput, type ProductionStatus } from '@/lib/print-release';

/**
 * ייצור דפוס (PT-06): איסוף נתוני השער, אישור מפרט להזמנה חד-פעמית, קובץ ייצור, שחרור ומעברי מצב.
 * כל פעולה מותנית במצב הנוכחי (אין החלה כפולה); השחרור שומר Snapshot שאינו משתנה (trigger ב-DB).
 * מקבל את ה-DB כפרמטר (בר-בדיקה).
 */

const orderInclude = {
  productionFile: true,
  artworks: { include: { versions: true } },
  items: {
    include: {
      templateVersion: { include: { template: true } },
      savedRevision: { include: { savedProduct: { include: { artworks: { include: { versions: true } } } } } },
    },
  },
} satisfies Prisma.PrintOrderInclude;

type OrderForGate = Prisma.PrintOrderGetPayload<{ include: typeof orderInclude }>;

type Versions = Array<{ id: string; version: number; status: string; fileId: string }>;
const latestApproved = (versions: Versions | undefined) => {
  const latest = [...(versions ?? [])].sort((a, b) => b.version - a.version)[0];
  return latest?.status === 'APPROVED' ? latest : null;
};

function buildGate(o: OrderForGate, isPrintHouse: boolean): GateInput & { artworkFor: Map<string, { id: string; version: number; fileId: string } | null> } {
  const artworkFor = new Map<string, { id: string; version: number; fileId: string } | null>();
  const items = o.items.map((it) => {
    const approved = it.savedRevision
      ? latestApproved(it.savedRevision.savedProduct.artworks[0]?.versions)
      : latestApproved(o.artworks[0]?.versions);
    artworkFor.set(it.id, approved);
    return {
      title: it.title ?? 'מוצר דפוס',
      fromTemplate: Boolean(it.templateVersionId),
      savedRevisionStatus: it.savedRevision?.status ?? null,
      requiresArtwork: it.templateVersion?.template.requiresArtwork ?? false,
      approvedArtwork: approved ? { versionId: approved.id, version: approved.version } : null,
    };
  });
  return {
    items,
    orderSpecApproved: Boolean(o.specApprovedAt),
    productionFile: o.productionFile ? { id: o.productionFile.id, sha256: o.productionFile.sha256 } : null,
    isPrintHouse,
    status: o.productionStatus as ProductionStatus,
    artworkFor,
  };
}

export async function gateFor(db: PrismaClient, orderId: string, isPrintHouse: boolean): Promise<{ ok: boolean; checks: GateCheck[] } | null> {
  const o = await db.printOrder.findUnique({ where: { id: orderId }, include: orderInclude });
  if (!o) return null;
  return evaluateGate(buildGate(o, isPrintHouse));
}

type Result = { ok: true } | { ok: false; error: string };

/** בית הדפוס מאשר את מפרט ההזמנה החד-פעמית (אישור 1 מתוך 3). */
export async function approveOrderSpec(db: PrismaClient, orderId: string, actor: string | null): Promise<Result> {
  const r = await db.printOrder.updateMany({
    where: { id: orderId, productionStatus: 'PENDING', specApprovedAt: null, status: { not: 'QUOTE_REQUESTED' } },
    data: { specApprovedAt: new Date(), specApprovedBy: actor },
  });
  return r.count === 1 ? { ok: true } : { ok: false, error: 'אי אפשר לאשר מפרט להזמנה הזו כעת (כבר אושר, שוחרר, או ממתינה להצעת מחיר)' };
}

/** קובץ הייצור של ההזמנה — רק לפני שחרור; קובץ חדש מחליף קודם. */
export async function setProductionFile(db: PrismaClient, orderId: string, fileId: string): Promise<Result> {
  const o = await db.printOrder.findUnique({ where: { id: orderId }, select: { nurseryId: true } });
  if (!o) return { ok: false, error: 'ההזמנה לא נמצאה' };
  const f = await db.printFile.findFirst({ where: { id: fileId, nurseryId: o.nurseryId, kind: 'PRODUCTION' } });
  if (!f) return { ok: false, error: 'קובץ הייצור לא נמצא' };
  const r = await db.printOrder.updateMany({ where: { id: orderId, releasedAt: null }, data: { productionFileId: f.id } });
  return r.count === 1 ? { ok: true } : { ok: false, error: 'ההזמנה כבר שוחררה — קובץ הייצור נעול' };
}

/**
 * שחרור לייצור: השער נבדק בתוך הטרנזקציה, וה-Snapshot נשמר יחד עם המעבר (מותנה ב-PENDING —
 * שחרור כפול נדחה). ה-Snapshot: גרסת מפרט וגרסת גרפיקה לכל פריט, קובץ הייצור וחתימתו.
 */
export async function releaseOrder(db: PrismaClient, orderId: string, actor: string | null, isPrintHouse: boolean): Promise<Result | { ok: false; error: string; checks: GateCheck[] }> {
  return db.$transaction(async (tx) => {
    const o = await tx.printOrder.findUnique({ where: { id: orderId }, include: orderInclude });
    if (!o) return { ok: false as const, error: 'ההזמנה לא נמצאה' };
    if (o.status === 'QUOTE_REQUESTED' || o.status === 'CANCELLED') return { ok: false as const, error: 'אי אפשר לשחרר הזמנה שממתינה להצעת מחיר או בוטלה' };
    const g = buildGate(o, isPrintHouse);
    const gate = evaluateGate(g);
    if (!gate.ok) return { ok: false as const, error: 'שער השחרור לא עבר', checks: gate.checks };

    const snapshot = {
      checkedAt: new Date().toISOString(),
      specApproved: o.specApprovedAt ? { at: o.specApprovedAt.toISOString(), by: o.specApprovedBy } : null,
      productionFile: { id: o.productionFile!.id, sha256: o.productionFile!.sha256, name: o.productionFile!.originalName, sizeBytes: o.productionFile!.sizeBytes },
      items: o.items.map((it) => {
        const art = g.artworkFor.get(it.id);
        return {
          itemId: it.id,
          title: it.title,
          quantity: it.quantity,
          templateVersionId: it.templateVersionId,
          specRevision: it.savedRevision ? { id: it.savedRevision.id, revision: it.savedRevision.revision } : null,
          artwork: art ? { versionId: art.id, version: art.version, fileId: art.fileId } : null,
        };
      }),
    };
    const r = await tx.printOrder.updateMany({
      where: { id: orderId, productionStatus: 'PENDING', releasedAt: null },
      data: { productionStatus: 'RELEASED', releasedAt: new Date(), releasedBy: actor, releaseSnapshot: snapshot as unknown as Prisma.InputJsonValue },
    });
    if (r.count !== 1) return { ok: false as const, error: 'ההזמנה עודכנה במקביל — רעננו' };
    return { ok: true as const };
  });
}

/** מעבר מצב ייצור (לא שחרור). חסימה — הערה חובה. מותנה במצב הנוכחי. */
export async function moveProduction(db: PrismaClient, orderId: string, to: ProductionStatus, note?: string | null): Promise<Result> {
  const o = await db.printOrder.findUnique({ where: { id: orderId }, select: { productionStatus: true, releasedAt: true } });
  if (!o) return { ok: false, error: 'ההזמנה לא נמצאה' };
  const from = o.productionStatus as ProductionStatus;
  if (to === 'RELEASED' && from !== 'BLOCKED') return { ok: false, error: 'שחרור לייצור — רק דרך שער השחרור' };
  if (!canMove(from, to, Boolean(o.releasedAt))) return { ok: false, error: 'מעבר מצב לא חוקי' };
  const n = note?.trim().slice(0, 1000) || null;
  if (to === 'BLOCKED' && !n) return { ok: false, error: 'בחסימה יש לכתוב את הסיבה' };
  const r = await db.printOrder.updateMany({
    where: { id: orderId, productionStatus: from },
    data: { productionStatus: to, ...(to === 'BLOCKED' ? { productionNote: n } : {}) },
  });
  return r.count === 1 ? { ok: true } : { ok: false, error: 'ההזמנה עודכנה במקביל — רעננו' };
}

/** הזמנה שגרפיקה שלה כבר נעולה בשחרור — אין להעלות לה גרסאות חדשות. */
export async function isOrderReleased(db: PrismaClient, orderId: string): Promise<boolean> {
  const o = await db.printOrder.findUnique({ where: { id: orderId }, select: { releasedAt: true } });
  return Boolean(o?.releasedAt);
}
