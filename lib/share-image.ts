import 'server-only';
import { cache } from 'react';
import type { Nursery } from '@prisma/client';
import { HOME_KEY } from '@/lib/page-builder-admin';
import { getLiveLayout } from '@/lib/page-builder';
import { getNurseryTheme } from '@/lib/theme';

/**
 * התמונה שמוצגת בשיתוף החנות בוואטסאפ ובפייסבוק (og:image):
 * תמונת ה-Hero בדף הבית, ואם אין — הלוגו של המשתלה.
 */
export const getStoreShareImage = cache(async (nursery: Nursery): Promise<string | null> => {
  const blocks = await getLiveLayout(nursery.id, HOME_KEY);
  const hero = blocks?.find((b) => b.type === 'hero');
  if (hero?.type === 'hero') {
    const image = hero.variant === 'image' ? hero.imageUrl : hero.variant === 'carousel' ? hero.slides.find((s) => s.imageUrl)?.imageUrl : '';
    if (image) return image;
  }
  const theme = getNurseryTheme(nursery);
  return theme.hero.imageUrl || theme.carousel.slides.find((s) => s.imageUrl)?.imageUrl || nursery.logoUrl || null;
});
