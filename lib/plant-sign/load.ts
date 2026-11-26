import type { PrismaClient } from '@prisma/client';
import { buildSignSource, SIGN_NURSERY_SELECT, SIGN_PRODUCT_SELECT, signSocials } from './data';
import type { SignSource } from './source';

/** מקורות השלטים למוצרי-צמח של המשתלה, לפי הסדר שהתבקש (מוצר שאינו שלה / אינו צמח — מושמט) */
export async function loadSignSources(db: PrismaClient, nurseryId: string, productIds: string[]): Promise<SignSource[]> {
  if (!productIds.length) return [];
  const [products, nursery, channels] = await Promise.all([
    db.nurseryProduct.findMany({
      where: { id: { in: productIds }, nurseryId, deletedAt: null, plantId: { not: null } },
      select: SIGN_PRODUCT_SELECT,
    }),
    db.nursery.findUnique({ where: { id: nurseryId }, select: SIGN_NURSERY_SELECT }),
    db.nurseryChannel.findMany({ where: { nurseryId, isEnabled: true }, select: { provider: true } }),
  ]);
  if (!nursery) return [];
  const socials = signSocials(channels.map((c) => c.provider));
  const byId = new Map(products.map((p) => [p.id, p]));
  return productIds.flatMap((id) => {
    const p = byId.get(id);
    const src = p ? buildSignSource({ product: p, nursery, socials }) : null;
    return src ? [src] : [];
  });
}
