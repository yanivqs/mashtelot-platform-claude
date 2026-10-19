import 'server-only';
import type { PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { pickZone } from '@/lib/shipping-zones';

export { normalizeCityName } from '@/lib/shipping-zones';

export interface ResolvedShippingZone {
  id: string;
  name: string;
  shippingPrice: number;
  freeShippingThreshold: number | null;
}

/** אזור המשלוח המתאים לעיר/מיקוד אצל משתלה, אם קיים (מיקוד תואם גובר על העיר — lib/shipping-zones.ts). */
export async function resolveShippingZone(
  nurseryId: string,
  city: string,
  postcode?: string | null,
  db: PrismaClient = prisma,
): Promise<ResolvedShippingZone | null> {
  const zones = await db.shippingZone.findMany({
    where: { nurseryId, isEnabled: true },
    include: { cities: true, postcodes: true },
    orderBy: { sortOrder: 'asc' },
  });
  const match = pickZone(
    zones.map((z) => ({ zone: z, cities: z.cities.map((c) => c.cityName), postcodes: z.postcodes.map((p) => p.prefix) })),
    city,
    postcode,
  );
  if (!match) return null;
  const z = match.zone;
  return {
    id: z.id,
    name: z.name,
    shippingPrice: Number(z.shippingPrice),
    freeShippingThreshold: z.freeShippingThreshold !== null ? Number(z.freeShippingThreshold) : null,
  };
}

/** האם למשתלה מוגדר לפחות אזור משלוח פעיל אחד (קובע אם שלב המשלוח מוצג ב-checkout). */
export async function hasAnyShippingZone(nurseryId: string): Promise<boolean> {
  const count = await prisma.shippingZone.count({ where: { nurseryId, isEnabled: true } });
  return count > 0;
}
