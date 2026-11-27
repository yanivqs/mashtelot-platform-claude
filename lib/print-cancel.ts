import type { Prisma, PrismaClient, PrintOrderStatus } from '@prisma/client';
import { storageDriver } from '@/lib/print-storage';

/**
 * ביטול ומחיקה של הזמנות דפוס.
 * - המשתלה מבטלת בעצמה רק לפני תחילת הייצור; ההזמנה נשארת בבית הדפוס ומסומנת "בוטלה ע"י המשתלה".
 * - בית הדפוס (סופר-אדמין) מוחק לצמיתות בכל שלב: ההזמנה, הפריטים, השלטים והקבצים — גם אצל המשתלה.
 */

const CANCELLABLE: PrintOrderStatus[] = ['NEW', 'QUOTE_REQUESTED'];

export function canNurseryCancel(o: {
  status: string;
  releasedAt: Date | null;
  productionStatus: string;
  cancelledBy?: string | null;
}): boolean {
  return CANCELLABLE.includes(o.status as PrintOrderStatus) && !o.releasedAt && o.productionStatus === 'PENDING';
}

/** הזמנה שבוטלה בידי המשתלה — לא מוצגת לה עוד */
export function cancelledByNursery(o: { status: string; cancelledBy: string | null }): boolean {
  return o.status === 'CANCELLED' && Boolean(o.cancelledBy);
}

type Tx = Prisma.TransactionClient;

/** העבודות שההזמנה שייכת אליהן (דרך המפרט או ישירות) */
async function jobsOfOrder(tx: Tx, orderId: string): Promise<string[]> {
  const items = await tx.printOrderItem.findMany({
    where: { printOrderId: orderId },
    select: { savedProductId: true, savedRevision: { select: { savedProductId: true } } },
  });
  return [...new Set(items.flatMap((i) => [i.savedProductId, i.savedRevision?.savedProductId].filter((x): x is string => Boolean(x))))];
}

function ordersOfJobWhere(jobId: string): Prisma.PrintOrderWhereInput {
  return { items: { some: { OR: [{ savedProductId: jobId }, { savedRevision: { savedProductId: jobId } }] } } };
}

export async function cancelNurseryOrder(
  db: PrismaClient,
  args: { nurseryId: string; orderId: string; actorEmail: string | null },
): Promise<{ ok: true; archivedJobs: string[] } | { ok: false; error: string }> {
  return db.$transaction(async (tx) => {
    const order = await tx.printOrder.findFirst({
      where: { id: args.orderId, nurseryId: args.nurseryId },
      select: { id: true, quoteStatus: true },
    });
    if (!order) return { ok: false as const, error: 'ההזמנה לא נמצאה' };
    // בדיקה ועדכון בפעולה אחת — בלי מרוץ מול שחרור לייצור באותו רגע
    const r = await tx.printOrder.updateMany({
      where: { id: order.id, nurseryId: args.nurseryId, status: { in: CANCELLABLE }, releasedAt: null, productionStatus: 'PENDING' },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelledBy: args.actorEmail ?? 'nursery',
        ...(order.quoteStatus && order.quoteStatus !== 'APPROVED' ? { quoteStatus: 'REJECTED' as const } : {}),
      },
    });
    if (r.count !== 1) return { ok: false as const, error: 'ההזמנה כבר בייצור — לביטול פנו לבית הדפוס' };

    // עבודה שלא נשארה לה הזמנה שלא בוטלה בידי המשתלה — יורדת מהרשימה
    const archivedJobs: string[] = [];
    for (const jobId of await jobsOfOrder(tx, order.id)) {
      const left = await tx.printOrder.count({
        where: { ...ordersOfJobWhere(jobId), NOT: { status: 'CANCELLED', cancelledBy: { not: null } } },
      });
      if (left === 0) {
        await tx.printSavedProduct.updateMany({ where: { id: jobId, nurseryId: args.nurseryId }, data: { isArchived: true } });
        archivedJobs.push(jobId);
      }
    }
    return { ok: true as const, archivedJobs };
  });
}

export interface DeletedOrderSummary {
  nurseryId: string;
  total: number;
  items: string[];
  plantSigns: number;
  files: number;
  deletedJobs: string[];
}

/** קבצים שאף רשומה כבר לא מפנה אליהם — מוחקים את השורות ומחזירים את מפתחות האחסון */
async function dropOrphanFiles(tx: Tx, fileIds: string[]): Promise<string[]> {
  if (!fileIds.length) return [];
  const orphans = await tx.printFile.findMany({
    where: { id: { in: fileIds }, productionOf: { none: {} }, artworkOf: { none: {} }, proofOf: { none: {} } },
    select: { id: true, storageKey: true },
  });
  if (orphans.length) await tx.printFile.deleteMany({ where: { id: { in: orphans.map((f) => f.id) } } });
  return orphans.map((f) => f.storageKey);
}

/** קבצי הגרפיקה וההגהות של גרפיקות */
async function artworkFileIds(tx: Tx, where: Prisma.PrintArtworkWhereInput): Promise<string[]> {
  const versions = await tx.printArtworkVersion.findMany({ where: { artwork: where }, select: { fileId: true, proofFileId: true } });
  return versions.flatMap((v) => [v.fileId, ...(v.proofFileId ? [v.proofFileId] : [])]);
}

export async function deletePrintOrder(
  db: PrismaClient,
  orderId: string,
): Promise<{ ok: true; summary: DeletedOrderSummary } | { ok: false; error: string }> {
  const res = await db.$transaction(async (tx) => {
    const order = await tx.printOrder.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        nurseryId: true,
        totalAmount: true,
        productionFileId: true,
        _count: { select: { plantSigns: true } },
        items: {
          select: {
            printProduct: { select: { title: true } },
            templateVersion: { select: { template: { select: { title: true } } } },
            savedProduct: { select: { name: true } },
          },
        },
      },
    });
    if (!order) return { ok: false as const, error: 'ההזמנה לא נמצאה' };

    const jobs = await jobsOfOrder(tx, order.id);
    const fileIds = [
      ...(order.productionFileId ? [order.productionFileId] : []),
      ...(await artworkFileIds(tx, { printOrderId: order.id })),
    ];

    // ההזמנה — יחד איתה (cascade): הפריטים, הגרפיקה של ההזמנה, השלטים
    await tx.printOrder.delete({ where: { id: order.id } });

    // עבודה שלא נשארה לה אף הזמנה — נמחקת גם היא (המפרטים והגרפיקה שלה)
    const deletedJobs: string[] = [];
    for (const jobId of jobs) {
      if ((await tx.printOrder.count({ where: ordersOfJobWhere(jobId) })) > 0) continue;
      fileIds.push(...(await artworkFileIds(tx, { savedProductId: jobId })));
      await tx.printSavedProduct.update({ where: { id: jobId }, data: { activeRevisionId: null } });
      await tx.printSavedProduct.delete({ where: { id: jobId } });
      deletedJobs.push(jobId);
    }

    const keys = await dropOrphanFiles(tx, [...new Set(fileIds)]);
    const summary: DeletedOrderSummary = {
      nurseryId: order.nurseryId,
      total: Number(order.totalAmount),
      items: order.items.map((i) => i.savedProduct?.name ?? i.templateVersion?.template.title ?? i.printProduct?.title ?? '—'),
      plantSigns: order._count.plantSigns,
      files: keys.length,
      deletedJobs,
    };
    return { ok: true as const, summary, keys };
  });
  if (!res.ok) return res;

  // אחרי שהמחיקה נשמרה: הקבצים באחסון. כשל — רק נרשם (הרשומות כבר נמחקו)
  const driver = storageDriver();
  await Promise.all(
    res.keys.map((k) =>
      driver.remove(k).catch((e) => {
        console.error('print file storage remove failed', k, e);
      }),
    ),
  );
  return { ok: true, summary: res.summary };
}
