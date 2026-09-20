import 'server-only';
import { prisma } from '@/lib/prisma';

/** נירמול שם עיר להשוואה (רווחים מיותרים + case, לא רלוונטי לעברית אך עדיין מנקה). */
export function normalizeCityName(city: string): string {
  return city.trim().toLowerCase().replace(/\s+/g, ' ');
}

export interface ResolvedShippingZone {
  id: string;
  name: string;
  shippingPrice: number;
  freeShippingThreshold: number | null;
}

/** אזור המשלוח המתאים לעיר נתונה אצל משתלה, אם קיים. */
export async function resolveShippingZone(
  nurseryId: string,
  city: string,
): Promise<ResolvedShippingZone | null> {
  const normalized = normalizeCityName(city);
  if (!normalized) return null;

  const match = await prisma.shippingZoneCity.findFirst({
    where: {
      normalizedCityName: normalized,
      zone: { nurseryId, isEnabled: true },
    },
    include: { zone: true },
  });
  if (!match) return null;

  return {
    id: match.zone.id,
    name: match.zone.name,
    shippingPrice: Number(match.zone.shippingPrice),
    freeShippingThreshold:
      match.zone.freeShippingThreshold !== null ? Number(match.zone.freeShippingThreshold) : null,
  };
}

/** האם למשתלה מוגדר לפחות אזור משלוח פעיל אחד (קובע אם שלב המשלוח מוצג ב-checkout). */
export async function hasAnyShippingZone(nurseryId: string): Promise<boolean> {
  const count = await prisma.shippingZone.count({ where: { nurseryId, isEnabled: true } });
  return count > 0;
}
