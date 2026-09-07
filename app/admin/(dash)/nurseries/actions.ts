'use server';

import { revalidatePath } from 'next/cache';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireUser, hashPassword } from '@/lib/auth';
import { parseOpeningHoursText } from '@/lib/theme';

export interface NurseryFormState {
  ok?: boolean;
  error?: string;
}

const SUBDOMAIN_RE = /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/;
const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

function s(formData: FormData, key: string): string | null {
  const v = String(formData.get(key) || '').trim();
  return v || null;
}

export async function createNursery(
  _prev: NurseryFormState,
  formData: FormData,
): Promise<NurseryFormState> {
  await requireUser(['SUPER_ADMIN']);

  const name = String(formData.get('name') || '').trim();
  const subdomain = String(formData.get('subdomain') || '').trim().toLowerCase();
  const ownerEmail = String(formData.get('ownerEmail') || '').trim().toLowerCase();
  const ownerPassword = String(formData.get('ownerPassword') || '');
  const logoUrl = String(formData.get('logoUrl') || '').trim() || null;

  if (!name || !subdomain || !ownerEmail) {
    return { error: 'שם, תת-דומיין ואימייל בעלים הם שדות חובה' };
  }
  if (!SUBDOMAIN_RE.test(subdomain)) {
    return { error: 'תת-דומיין לא תקין (אותיות אנגלית קטנות, ספרות ומקפים)' };
  }

  const existing = await prisma.nursery.findUnique({ where: { subdomain } });
  if (existing) return { error: 'תת-הדומיין כבר תפוס' };

  const nursery = await prisma.nursery.create({
    data: { name, subdomain, ownerEmail, logoUrl },
  });

  if (ownerPassword) {
    if (ownerPassword.length < 8) {
      return { error: 'המשתלה נוצרה, אך הסיסמה קצרה מ-8 תווים - לא נוצר משתמש בעלים' };
    }
    const passwordHash = await hashPassword(ownerPassword);
    await prisma.user.upsert({
      where: { email: ownerEmail },
      update: { passwordHash, role: 'NURSERY_OWNER', nurseryId: nursery.id },
      create: {
        email: ownerEmail,
        passwordHash,
        role: 'NURSERY_OWNER',
        nurseryId: nursery.id,
      },
    });
  }

  revalidatePath('/admin/nurseries');
  return { ok: true };
}

/**
 * עדכון פרטי משתלה. `scope`:
 * - סופר-אדמין: כל השדות (כולל תת-דומיין, דומיין מותאם, אימייל בעלים).
 * - בעל משתלה: רק המשתלה שלו, ורק שדות פרופיל/עיצוב (לא זהות/ניתוב).
 */
export async function updateNursery(
  _prev: NurseryFormState,
  formData: FormData,
): Promise<NurseryFormState> {
  const user = await requireUser(['SUPER_ADMIN', 'NURSERY_OWNER']);
  const id = String(formData.get('id') || '');
  if (!id) return { error: 'מזהה חסר' };

  const isSuper = user.role === 'SUPER_ADMIN';
  if (!isSuper && user.nurseryId !== id) {
    return { error: 'אין הרשאה לערוך משתלה זו' };
  }

  const name = String(formData.get('name') || '').trim();
  if (!name) return { error: 'שם המשתלה הוא שדה חובה' };

  const primaryColorRaw = s(formData, 'primaryColor');
  if (primaryColorRaw && !HEX_RE.test(primaryColorRaw)) {
    return { error: 'צבע ראשי חייב להיות קוד hex (למשל #16a34a)' };
  }
  const accentColorRaw = s(formData, 'accentColor');
  if (accentColorRaw && !HEX_RE.test(accentColorRaw)) {
    return { error: 'צבע משני חייב להיות קוד hex' };
  }

  const heroLayout = String(formData.get('heroLayout') || 'centered');
  const themeConfig = {
    hero: {
      layout: ['centered', 'split', 'image'].includes(heroLayout) ? heroLayout : 'centered',
      headline: s(formData, 'heroHeadline'),
      subheadline: s(formData, 'heroSubheadline'),
      imageUrl: s(formData, 'heroImageUrl'),
      ctaText: s(formData, 'heroCtaText'),
      ctaHref: s(formData, 'heroCtaHref'),
    },
    colors: {
      primary: primaryColorRaw ?? '#16a34a',
      accent: accentColorRaw ?? primaryColorRaw ?? '#16a34a',
    },
    stickyHeader: formData.get('stickyHeader') === 'on',
  };

  const openingHoursText = String(formData.get('openingHoursText') || '');
  const openingHours = parseOpeningHoursText(openingHoursText);

  const data: Prisma.NurseryUpdateInput = {
    name,
    logoUrl: s(formData, 'logoUrl'),
    phoneNumber: s(formData, 'phoneNumber'),
    whatsappNumber: s(formData, 'whatsappNumber'),
    contactEmail: s(formData, 'contactEmail'),
    aboutText: s(formData, 'aboutText'),
    addressLine: s(formData, 'addressLine'),
    city: s(formData, 'city'),
    mapLink: s(formData, 'mapLink'),
    facebookUrl: s(formData, 'facebookUrl'),
    instagramUrl: s(formData, 'instagramUrl'),
    tiktokUrl: s(formData, 'tiktokUrl'),
    youtubeUrl: s(formData, 'youtubeUrl'),
    primaryColor: primaryColorRaw ?? undefined,
    openingHours: openingHours.length
      ? (openingHours as unknown as Prisma.InputJsonValue)
      : Prisma.JsonNull,
    themeConfig: themeConfig as unknown as Prisma.InputJsonValue,
  };

  if (isSuper) {
    const subdomain = String(formData.get('subdomain') || '').trim().toLowerCase();
    if (subdomain && !SUBDOMAIN_RE.test(subdomain)) {
      return { error: 'תת-דומיין לא תקין' };
    }
    if (subdomain) {
      const clash = await prisma.nursery.findFirst({
        where: { subdomain, NOT: { id } },
        select: { id: true },
      });
      if (clash) return { error: 'תת-הדומיין כבר תפוס' };
      data.subdomain = subdomain;
    }
    data.customDomain = s(formData, 'customDomain')?.toLowerCase() ?? null;
    const ownerEmail = String(formData.get('ownerEmail') || '').trim().toLowerCase();
    if (ownerEmail) data.ownerEmail = ownerEmail;
  }

  try {
    await prisma.nursery.update({ where: { id }, data });
  } catch {
    return { error: 'שגיאה בשמירה (ייתכן שהדומיין המותאם כבר תפוס)' };
  }

  revalidatePath('/admin/nurseries');
  revalidatePath(`/admin/nurseries/${id}`);
  revalidatePath('/admin/settings');
  return { ok: true };
}

export async function toggleNurseryActive(formData: FormData): Promise<void> {
  await requireUser(['SUPER_ADMIN']);
  const id = String(formData.get('id') || '');
  const nursery = await prisma.nursery.findUnique({ where: { id }, select: { isActive: true } });
  if (!nursery) return;
  await prisma.nursery.update({ where: { id }, data: { isActive: !nursery.isActive } });
  revalidatePath('/admin/nurseries');
}
