'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireNurseryAction } from '@/lib/nursery-scope';
import { assertOwnedBy } from '@/lib/ownership';

/** הקשר המשתלה של המשתמש המחובר בלבד + אכיפת המודול (C-P1-01). */
async function resolveNurseryId(): Promise<string> {
  return (await requireNurseryAction({ all: ['promotions'] })).nurseryId;
}

async function assertOwnsCoupon(id: string): Promise<void> {
  await assertOwnedBy(prisma, 'coupon', id, await resolveNurseryId());
}

async function assertOwnsPromotion(id: string): Promise<void> {
  await assertOwnedBy(prisma, 'promotion', id, await resolveNurseryId());
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
  const startsAtRaw = String(formData.get('startsAt') || '').trim();
  const endsAtRaw = String(formData.get('endsAt') || '').trim();
  const usageLimitRaw = String(formData.get('usageLimit') || '').trim();

  if (!code) return { error: 'יש להזין קוד קופון' };
  if (!Number.isFinite(pct) || pct <= 0 || pct > 100) {
    return { error: 'אחוז הנחה חייב להיות בין 1 ל-100' };
  }

  const startsAt = startsAtRaw ? new Date(startsAtRaw) : null;
  const endsAt = endsAtRaw ? new Date(endsAtRaw) : null;
  if (startsAt && Number.isNaN(startsAt.getTime())) return { error: 'תאריך תחילת תוקף לא תקין' };
  if (endsAt && Number.isNaN(endsAt.getTime())) return { error: 'תאריך סיום תוקף לא תקין' };
  if (startsAt && endsAt && startsAt > endsAt) {
    return { error: 'תאריך תחילת התוקף חייב להיות לפני תאריך הסיום' };
  }

  let usageLimit: number | null = null;
  if (usageLimitRaw) {
    usageLimit = Number(usageLimitRaw);
    if (!Number.isInteger(usageLimit) || usageLimit <= 0) {
      return { error: 'מגבלת שימושים חייבת להיות מספר שלם חיובי' };
    }
  }

  // §12.01: מגבלה ללקוח (לפי אימייל) ומינימום הזמנה — נאכפים בשרת ב-lib/order-service.ts
  const perCustomerRaw = String(formData.get('perCustomerLimit') || '').trim();
  let perCustomerLimit: number | null = null;
  if (perCustomerRaw) {
    perCustomerLimit = Number(perCustomerRaw);
    if (!Number.isInteger(perCustomerLimit) || perCustomerLimit <= 0) {
      return { error: 'מגבלה ללקוח חייבת להיות מספר שלם חיובי' };
    }
  }
  const minOrderRaw = String(formData.get('minOrderAmount') || '').trim();
  let minOrderAmount: string | null = null;
  if (minOrderRaw) {
    const n = Number(minOrderRaw);
    if (!Number.isFinite(n) || n < 0) return { error: 'מינימום הזמנה לא תקין' };
    minOrderAmount = n.toFixed(2);
  }

  const exists = await prisma.coupon.findFirst({ where: { nurseryId, code } });
  if (exists) return { error: 'קוד קופון זה כבר קיים' };

  await prisma.coupon.create({
    data: { nurseryId, code, discountPct: pct.toFixed(2), startsAt, endsAt, usageLimit, perCustomerLimit, minOrderAmount },
  });
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
