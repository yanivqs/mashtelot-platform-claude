import type { PrismaClient } from '@prisma/client';
import { registerFile } from '@/lib/print-artwork';
import { newStorageKey, storageDriver } from '@/lib/print-storage';
import { setProductionFile } from '@/lib/print-production';
import { renderSignsPdf } from './pdf';
import type { SignData } from './types';

/**
 * בית הדפוס: הפקת PDF לדפוס מה-Snapshot של השלטים בהזמנה, שמירתו כקובץ ייצור של ההזמנה
 * (נכנס לשער השחרור הקיים). הזמנה ששוחררה — קובץ הייצור נעול.
 */
export async function generatePlantSignsPdf(
  db: PrismaClient,
  orderId: string,
  actorEmail: string | null,
): Promise<{ ok: true; fileId: string; pages: number; warnings: string[] } | { ok: false; error: string }> {
  const order = await db.printOrder.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      nurseryId: true,
      releasedAt: true,
      nursery: { select: { name: true } },
      plantSigns: { orderBy: { sortOrder: 'asc' }, select: { data: true, quantity: true } },
    },
  });
  if (!order) return { ok: false, error: 'ההזמנה לא נמצאה' };
  if (!order.plantSigns.length) return { ok: false, error: 'אין שלטי צמחים בהזמנה הזו' };
  if (order.releasedAt) return { ok: false, error: 'ההזמנה כבר שוחררה — קובץ הייצור נעול' };

  const shortId = order.id.slice(0, 8);
  const { pdf, warnings } = await renderSignsPdf(
    order.plantSigns.map((s) => ({ data: s.data as unknown as SignData, quantity: s.quantity })),
    { title: `${order.nursery.name} · הזמנה ${shortId}` },
  );

  const key = newStorageKey(order.nurseryId, 'PRODUCTION');
  await storageDriver().write(key, pdf, 'application/pdf');
  const reg = await registerFile(db, {
    nurseryId: order.nurseryId,
    kind: 'PRODUCTION',
    storageKey: key,
    originalName: `plant-signs-${shortId}.pdf`,
    bytes: pdf,
    actorEmail,
  });
  if (!reg.ok) {
    await storageDriver().remove(key);
    return { ok: false, error: reg.error };
  }
  const set = await setProductionFile(db, order.id, reg.fileId);
  if (!set.ok) return { ok: false, error: set.error };
  return { ok: true, fileId: reg.fileId, pages: order.plantSigns.length, warnings };
}
