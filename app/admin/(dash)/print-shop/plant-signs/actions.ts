'use server';

import { revalidatePath } from 'next/cache';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { nurseryActionScope } from '@/lib/nursery-scope';
import { recordAudit } from '@/lib/audit';
import { loadSignSources } from '@/lib/plant-sign/load';
import { isEmptySettings, parseSignSettings } from '@/lib/plant-sign/data';
import { createPlantSignOrder, MAX_SIGN_PLANTS, parseSignLines } from '@/lib/plant-sign/order';
import type { SignSource } from '@/lib/plant-sign/source';

const MODULES = { all: ['print_shop', 'plant_catalog'] } as const;

/** נתוני השלט לצמחים שנוספו בעמוד (רק מוצרי-צמח של המשתלה) */
export async function loadSignSourcesAction(productIds: string[]): Promise<{ sources?: SignSource[]; error?: string }> {
  const scope = await nurseryActionScope({ all: [...MODULES.all] });
  if (!scope.ok) return { error: scope.error };
  const ids = Array.isArray(productIds) ? productIds.filter((x) => typeof x === 'string').slice(0, MAX_SIGN_PLANTS) : [];
  return { sources: await loadSignSources(prisma, scope.nurseryId, ids) };
}

/** שמירת העריכות של שלט למוצר — יופיעו גם בהזמנות הבאות */
export async function saveSignSettingsAction(productId: string, settings: unknown): Promise<{ ok?: boolean; error?: string }> {
  const scope = await nurseryActionScope({ all: [...MODULES.all] });
  if (!scope.ok) return { error: scope.error };
  const clean = parseSignSettings(settings);
  const res = await prisma.nurseryProduct.updateMany({
    where: { id: String(productId), nurseryId: scope.nurseryId, deletedAt: null, plantId: { not: null } },
    data: { signSettings: isEmptySettings(clean) ? Prisma.DbNull : (clean as Prisma.InputJsonValue) },
  });
  if (res.count !== 1) return { error: 'המוצר לא נמצא' };
  return { ok: true };
}

export interface SignOrderActionResult {
  ok?: boolean;
  orderId?: string;
  quoteOnly?: boolean;
  total?: number;
  error?: string;
}

/** הזמנת השלטים: הכול נבדק, נבנה ומתומחר מחדש בשרת */
export async function createPlantSignOrderAction(input: {
  lines: unknown;
  values: unknown;
  notes?: unknown;
}): Promise<SignOrderActionResult> {
  const scope = await nurseryActionScope({ all: [...MODULES.all] });
  if (!scope.ok) return { error: scope.error };
  const lines = parseSignLines(input.lines);
  if (!lines) return { error: 'רשימת השלטים אינה תקינה — רעננו את הדף' };
  const res = await createPlantSignOrder(prisma, {
    nurseryId: scope.nurseryId,
    userId: scope.user.id,
    actorEmail: scope.user.email,
    lines,
    values: input.values && typeof input.values === 'object' ? (input.values as Record<string, unknown>) : {},
    notes: typeof input.notes === 'string' ? input.notes : null,
  });
  if (!res.ok) return { error: res.error };
  await recordAudit({
    nurseryId: scope.nurseryId,
    actorEmail: scope.user.email,
    action: res.quote.quoteOnly ? 'print.quote_requested' : 'print.order_created',
    entityType: 'PrintOrder',
    entityId: res.orderId,
    metadata: { plantSigns: lines.length, quantity: res.quote.quantity, total: res.quote.total },
  });
  revalidatePath('/admin/print-shop/jobs');
  revalidatePath('/admin/print-orders');
  return { ok: true, orderId: res.orderId, quoteOnly: res.quote.quoteOnly, total: res.quote.total };
}
