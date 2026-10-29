'use server';

import { revalidatePath } from 'next/cache';
import { auditAsCurrentUser } from '@/lib/audit-actor';
import { prisma } from '@/lib/prisma';
import { requireNurseryAction } from '@/lib/nursery-scope';
import { assertOwnedBy } from '@/lib/ownership';
import { isSafeLink, normalizeAnnouncement } from '@/lib/theme';
import type { Prisma } from '@prisma/client';

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

  const coupon = await prisma.coupon.create({
    data: { nurseryId, code, discountPct: pct.toFixed(2), startsAt, endsAt, usageLimit, perCustomerLimit, minOrderAmount },
  });
  await auditAsCurrentUser({ nurseryId, action: 'coupon.created', entityType: 'Coupon', entityId: coupon.id, metadata: { code, discountPct: pct, usageLimit, perCustomerLimit } });
  revalidatePath('/admin/marketing');
  return { ok: true };
}

export async function toggleCoupon(formData: FormData): Promise<void> {
  const id = String(formData.get('id') || '');
  await assertOwnsCoupon(id);
  const row = await prisma.coupon.findUnique({ where: { id }, select: { isActive: true, nurseryId: true, code: true } });
  await prisma.coupon.update({ where: { id }, data: { isActive: !row!.isActive } });
  await auditAsCurrentUser({ nurseryId: row!.nurseryId, action: row!.isActive ? 'coupon.disabled' : 'coupon.enabled', entityType: 'Coupon', entityId: id, metadata: { code: row!.code } });
  revalidatePath('/admin/marketing');
}

export async function deleteCoupon(formData: FormData): Promise<void> {
  const id = String(formData.get('id') || '');
  await assertOwnsCoupon(id);
  const gone = await prisma.coupon.delete({ where: { id } });
  await auditAsCurrentUser({ nurseryId: gone.nurseryId, action: 'coupon.deleted', entityType: 'Coupon', entityId: id, metadata: { code: gone.code } });
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

  const promo = await prisma.promotion.create({
    data: { nurseryId, title, popupText, triggerType: 'ON_LOAD' },
  });
  await auditAsCurrentUser({ nurseryId, action: 'promotion.created', entityType: 'Promotion', entityId: promo.id, metadata: { title } });
  revalidatePath('/admin/marketing');
  return { ok: true };
}

export async function togglePromotion(formData: FormData): Promise<void> {
  const id = String(formData.get('id') || '');
  await assertOwnsPromotion(id);
  const row = await prisma.promotion.findUnique({ where: { id }, select: { isActive: true, nurseryId: true } });
  await prisma.promotion.update({ where: { id }, data: { isActive: !row!.isActive } });
  await auditAsCurrentUser({ nurseryId: row!.nurseryId, action: row!.isActive ? 'promotion.disabled' : 'promotion.enabled', entityType: 'Promotion', entityId: id });
  revalidatePath('/admin/marketing');
}

export async function deletePromotion(formData: FormData): Promise<void> {
  const id = String(formData.get('id') || '');
  await assertOwnsPromotion(id);
  const gonePromo = await prisma.promotion.delete({ where: { id } });
  await auditAsCurrentUser({ nurseryId: gonePromo.nurseryId, action: 'promotion.deleted', entityType: 'Promotion', entityId: id });
  revalidatePath('/admin/marketing');
}

/**
 * הודעת סטיקי בראש החנות (נשמרת ב-themeConfig.announcement; שאר העיצוב לא משתנה).
 * קישור — רק לנתיב באתר או https.
 */
export async function saveAnnouncement(_prev: MarketingState, formData: FormData): Promise<MarketingState> {
  const nurseryId = await resolveNurseryId();
  const text = String(formData.get('text') || '').trim();
  const href = String(formData.get('href') || '').trim();
  const enabled = formData.get('enabled') === 'on';
  if (enabled && !text) return { error: 'יש להזין טקסט להודעה' };
  if (text.length > 140) return { error: 'הטקסט ארוך מדי (עד 140 תווים)' };
  if (href && !isSafeLink(href)) return { error: 'קישור לא תקין — נתיב באתר (מתחיל ב-/) או כתובת https' };

  const announcement = normalizeAnnouncement({
    enabled,
    text,
    href,
    linkText: String(formData.get('linkText') || ''),
    tone: formData.get('tone'),
  });
  const nursery = await prisma.nursery.findUniqueOrThrow({ where: { id: nurseryId }, select: { themeConfig: true, subdomain: true } });
  const themeConfig = { ...((nursery.themeConfig ?? {}) as Record<string, unknown>), announcement };
  await prisma.nursery.update({ where: { id: nurseryId }, data: { themeConfig: themeConfig as unknown as Prisma.InputJsonValue } });
  await auditAsCurrentUser({ nurseryId, action: 'announcement.updated', entityType: 'Nursery', entityId: nurseryId, metadata: { enabled: announcement.enabled, text: announcement.text, href: announcement.href } });
  revalidatePath('/admin/marketing');
  revalidatePath(`/${nursery.subdomain}`, 'layout');
  return { ok: true };
}
