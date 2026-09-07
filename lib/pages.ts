import { cache } from 'react';
import { prisma } from '@/lib/prisma';
import { isModuleEnabled } from '@/lib/module-access';

/** עמוד סטטי מפורסם לפי slug, או null (כולל בדיקת מודול static_pages). */
export const getPublishedPage = cache(async (nurseryId: string, slug: string) => {
  if (!(await isModuleEnabled(nurseryId, 'static_pages'))) return null;
  return prisma.staticPage.findFirst({
    where: { nurseryId, slug: slug.toLowerCase(), isPublished: true },
  });
});

/** עמודים מפורסמים לתפריט החנות (אם המודול פעיל). */
export const getNavPages = cache(async (nurseryId: string) => {
  if (!(await isModuleEnabled(nurseryId, 'static_pages'))) return [];
  return prisma.staticPage.findMany({
    where: { nurseryId, isPublished: true, showInNav: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    select: { slug: true, title: true },
  });
});
