'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { normalizeCityName } from '@/lib/shipping';

async function resolveNurseryId(): Promise<string> {
  const user = await requireUser(['NURSERY_OWNER', 'SUPER_ADMIN']);
  if (user.nurseryId) return user.nurseryId;
  if (user.role === 'SUPER_ADMIN') {
    const first = await prisma.nursery.findFirst({ orderBy: { createdAt: 'asc' } });
    if (first) return first.id;
  }
  throw new Error('אין משתלה משויכת');
}

async function assertOwnsZone(id: string): Promise<void> {
  const nurseryId = await resolveNurseryId();
  const row = await prisma.shippingZone.findUnique({ where: { id }, select: { nurseryId: true } });
  if (!row || row.nurseryId !== nurseryId) throw new Error('אין הרשאה');
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
}

export async function createZone(
  _prev: ShippingZoneState,
  formData: FormData,
): Promise<ShippingZoneState> {
  const nurseryId = await resolveNurseryId();
  const name = String(formData.get('name') || '').trim();
  const price = Number(String(formData.get('shippingPrice') || ''));
  const thresholdRaw = String(formData.get('freeShippingThreshold') || '').trim();
  const cities = parseCities(String(formData.get('cities') || ''));

  if (!name) return { error: 'יש להזין שם לאזור' };
  if (!Number.isFinite(price) || price < 0) return { error: 'מחיר משלוח לא תקין' };
  if (cities.length === 0) return { error: 'יש להזין לפחות עיר אחת (שורה לכל עיר)' };

  let freeShippingThreshold: string | null = null;
  if (thresholdRaw) {
    const t = Number(thresholdRaw);
    if (!Number.isFinite(t) || t < 0) return { error: 'סף למשלוח חינם לא תקין' };
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
      },
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'יצירת אזור המשלוח נכשלה' };
  }

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
