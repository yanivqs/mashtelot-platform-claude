'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';

async function resolveNurseryId(): Promise<string> {
  const user = await requireUser(['NURSERY_OWNER', 'SUPER_ADMIN']);
  if (user.nurseryId) return user.nurseryId;
  if (user.role === 'SUPER_ADMIN') {
    const first = await prisma.nursery.findFirst({ orderBy: { createdAt: 'asc' } });
    if (first) return first.id;
  }
  throw new Error('אין משתלה משויכת');
}

async function assertOwnsCoupon(id: string): Promise<void> {
  const nurseryId = await resolveNurseryId();
  const row = await prisma.coupon.findUnique({ where: { id }, select: { nurseryId: true } });
  if (!row || row.nurseryId !== nurseryId) throw new Error('אין הרשאה');
}

async function assertOwnsPromotion(id: string): Promise<void> {
  const nurseryId = await resolveNurseryId();
  const row = await prisma.promotion.findUnique({ where: { id }, select: { nurseryId: true } });
  if (!row || row.nurseryId !== nurseryId) throw new Error('אין הרשאה');
}

export interface MarketingState {
  ok?: boolean;
  error?: string;
}

export async function createCoupon(
  _prev: MarketingState,
  formData: FormData,
): Promise<MarketingState> {
  const nurseryId = await resolveNurseryId();
  const code = String(formData.get('code') || '').trim().toUpperCase();
  const pct = Number(String(formData.get('discountPct') || ''));

  if (!code) return { error: 'יש להזין קוד קופון' };
  if (!Number.isFinite(pct) || pct <= 0 || pct > 100) {
    return { error: 'אחוז הנחה חייב להיות בין 1 ל-100' };
  }

  const exists = await prisma.coupon.findFirst({ where: { nurseryId, code } });
  if (exists) return { error: 'קוד קופון זה כבר קיים' };

  await prisma.coupon.create({ data: { nurseryId, code, discountPct: pct.toFixed(2) } });
  revalidatePath('/admin/marketing');
  return { ok: true };
}

export async function toggleCoupon(formData: FormData): Promise<void> {
  const id = String(formData.get('id') || '');
  await assertOwnsCoupon(id);
  const row = await prisma.coupon.findUnique({ where: { id }, select: { isActive: true } });
  await prisma.coupon.update({ where: { id }, data: { isActive: !row!.isActive } });
  revalidatePath('/admin/marketing');
}

export async function deleteCoupon(formData: FormData): Promise<void> {
  const id = String(formData.get('id') || '');
  await assertOwnsCoupon(id);
  await prisma.coupon.delete({ where: { id } });
  revalidatePath('/admin/marketing');
}

export async function createPromotion(
  _prev: MarketingState,
  formData: FormData,
): Promise<MarketingState> {
  const nurseryId = await resolveNurseryId();
  const title = String(formData.get('title') || '').trim();
  const popupText = String(formData.get('popupText') || '').trim();

  if (!title) return { error: 'יש להזין כותרת' };
  if (!popupText) return { error: 'יש להזין טקסט לפופאפ' };

  await prisma.promotion.create({
    data: { nurseryId, title, popupText, triggerType: 'ON_LOAD' },
  });
  revalidatePath('/admin/marketing');
  return { ok: true };
}

export async function togglePromotion(formData: FormData): Promise<void> {
  const id = String(formData.get('id') || '');
  await assertOwnsPromotion(id);
  const row = await prisma.promotion.findUnique({ where: { id }, select: { isActive: true } });
  await prisma.promotion.update({ where: { id }, data: { isActive: !row!.isActive } });
  revalidatePath('/admin/marketing');
}

export async function deletePromotion(formData: FormData): Promise<void> {
  const id = String(formData.get('id') || '');
  await assertOwnsPromotion(id);
  await prisma.promotion.delete({ where: { id } });
  revalidatePath('/admin/marketing');
}
