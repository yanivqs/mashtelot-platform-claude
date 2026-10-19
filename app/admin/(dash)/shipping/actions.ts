'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireNurseryAction } from '@/lib/nursery-scope';
import { assertOwnedBy } from '@/lib/ownership';
import { normalizeCityName, parsePostcodePrefixes } from '@/lib/shipping-zones';
import { recordAudit } from '@/lib/audit';

/** הקשר המשתלה של המשתמש המחובר בלבד + אכיפת המודול (C-P1-01). */
async function resolveNurseryId(): Promise<string> {
  return (await requireNurseryAction({ all: ['shipping'] })).nurseryId;
}

async function assertOwnsZone(id: string): Promise<void> {
  await assertOwnedBy(prisma, 'shippingZone', id, await resolveNurseryId());
}

function parseCities(text: string): { cityName: string; normalizedCityName: string }[] {
  const seen = new Set<string>();
  const rows: { cityName: string; normalizedCityName: string }[] = [];
  for (const line of text.split('\n')) {
    const cityName = line.trim();
    if (!cityName) continue;
    const normalizedCityName = normalizeCityName(cityName);
    if (seen.has(normalizedCityName)) continue;
    seen.add(normalizedCityName);
    rows.push({ cityName, normalizedCityName });
  }
  return rows;
}

export interface ShippingZoneState {
  ok?: boolean;
  error?: string;
  /** UX-01: הערכים שנשלחו — React 19 מאפס את הטופס, והם חוזרים כ-defaultValue בשגיאה */
  values?: Record<string, string>;
}

export async function createZone(
  _prev: ShippingZoneState,
  formData: FormData,
): Promise<ShippingZoneState> {
  const nurseryId = await resolveNurseryId();
  const values = Object.fromEntries(['name', 'shippingPrice', 'freeShippingThreshold', 'cities', 'postcodes'].map((k) => [k, String(formData.get(k) || '')]));
  const fail = (error: string): ShippingZoneState => ({ error, values });
  const name = String(formData.get('name') || '').trim();
  const price = Number(String(formData.get('shippingPrice') || ''));
  const thresholdRaw = String(formData.get('freeShippingThreshold') || '').trim();
  const cities = parseCities(String(formData.get('cities') || ''));
  const postcodes = parsePostcodePrefixes(String(formData.get('postcodes') || ''));

  if (!name) return fail('יש להזין שם לאזור');
  if (!Number.isFinite(price) || price < 0) return fail('מחיר משלוח לא תקין');
  if (!postcodes.ok) return fail(postcodes.error);
  if (cities.length === 0 && postcodes.value.length === 0) return fail('יש להזין לפחות עיר אחת או מיקוד אחד');

  let freeShippingThreshold: string | null = null;
  if (thresholdRaw) {
    const t = Number(thresholdRaw);
    if (!Number.isFinite(t) || t < 0) return fail('סף למשלוח חינם לא תקין');
    freeShippingThreshold = t.toFixed(2);
  }

  try {
    await prisma.shippingZone.create({
      data: {
        nurseryId,
        name,
        shippingPrice: price.toFixed(2),
        freeShippingThreshold,
        cities: { create: cities },
        postcodes: { create: postcodes.value.map((prefix) => ({ prefix })) },
      },
    });
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'יצירת אזור המשלוח נכשלה');
  }

  revalidatePath('/admin/shipping');
  return { ok: true };
}

/** עדכון רשימת המיקודים של אזור קיים (מחליפה את הרשימה). אזור חייב להישאר עם עיר או מיקוד. */
export async function updateZonePostcodes(_prev: ShippingZoneState, formData: FormData): Promise<ShippingZoneState> {
  const { nurseryId, user } = await requireNurseryAction({ all: ['shipping'] });
  const id = String(formData.get('id') || '');
  await assertOwnedBy(prisma, 'shippingZone', id, nurseryId);
  const postcodes = parsePostcodePrefixes(String(formData.get('postcodes') || ''));
  if (!postcodes.ok) return { error: postcodes.error, values: { postcodes: String(formData.get('postcodes') || '') } };
  const cityCount = await prisma.shippingZoneCity.count({ where: { shippingZoneId: id } });
  if (cityCount === 0 && postcodes.value.length === 0) return { error: 'לאזור ללא ערים חייב להיות לפחות מיקוד אחד' };
  await prisma.$transaction([
    prisma.shippingZonePostcode.deleteMany({ where: { shippingZoneId: id } }),
    prisma.shippingZonePostcode.createMany({ data: postcodes.value.map((prefix) => ({ shippingZoneId: id, prefix })) }),
  ]);
  await recordAudit({ nurseryId, actorEmail: user.email, action: 'shipping.zone_postcodes_updated', entityType: 'ShippingZone', entityId: id, metadata: { count: postcodes.value.length } });
  revalidatePath('/admin/shipping');
  return { ok: true };
}

export async function toggleZone(formData: FormData): Promise<void> {
  const id = String(formData.get('id') || '');
  await assertOwnsZone(id);
  const row = await prisma.shippingZone.findUnique({ where: { id }, select: { isEnabled: true } });
  await prisma.shippingZone.update({ where: { id }, data: { isEnabled: !row!.isEnabled } });
  revalidatePath('/admin/shipping');
}

export async function deleteZone(formData: FormData): Promise<void> {
  const id = String(formData.get('id') || '');
  await assertOwnsZone(id);
  await prisma.shippingZone.delete({ where: { id } });
  revalidatePath('/admin/shipping');
}
