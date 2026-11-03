'use server';

import { revalidatePath } from 'next/cache';
import type { Prisma } from '@prisma/client';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { recordAudit } from '@/lib/audit';

/** הסופר-אדמין קובע אם החנות מציגה את דף הבית שעיצב, גם כשהמודול לא משויך. הדגל נשמר בהגדרות המודול. */
export async function setManagedHomeAction(nurseryId: string, on: boolean): Promise<void> {
  const user = await requireUser(['SUPER_ADMIN']);
  const nursery = await prisma.nursery.findUnique({ where: { id: nurseryId }, select: { subdomain: true } });
  if (!nursery) return;
  const key = { nurseryId_moduleKey: { nurseryId, moduleKey: 'page_builder' } };
  const row = await prisma.nurseryModule.findUnique({ where: key, select: { config: true } });
  const config = { ...((row?.config as Record<string, unknown> | null) ?? {}), platformManaged: on } as Prisma.InputJsonValue;
  await prisma.nurseryModule.upsert({
    where: key,
    create: { nurseryId, moduleKey: 'page_builder', isEnabled: false, config },
    update: { config },
  });
  await recordAudit({ nurseryId, actorEmail: user.email, action: on ? 'page_layout.managed_enabled' : 'page_layout.managed_disabled', entityType: 'Nursery', entityId: nurseryId });
  revalidatePath(`/${nursery.subdomain}`);
  revalidatePath(`/admin/nurseries/${nurseryId}/home-design`);
}
