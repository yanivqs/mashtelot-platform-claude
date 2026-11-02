import { cache } from 'react';
import { prisma } from '@/lib/prisma';
import { isModuleEnabled } from '@/lib/module-access';

/** The promotion to surface as a storefront popup for a tenant, if any. */
export const getActivePromotion = cache(async (nurseryId: string) => {
  if (!(await isModuleEnabled(nurseryId, 'popups'))) return null;
  return prisma.promotion.findFirst({
    where: { nurseryId, isActive: true, popupText: { not: null } },
    orderBy: { createdAt: 'desc' },
  });
});
