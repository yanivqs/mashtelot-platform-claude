'use server';

import { revalidatePath } from 'next/cache';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireUser, hashPassword } from '@/lib/auth';
import { parseOpeningHoursText, normalizeCarousel, HERO_LAYOUTS, type HeroLayout } from '@/lib/theme';
import { MODULE_KEYS } from '@/lib/modules';
import { syncMasterCategoriesToNursery } from '@/lib/category-provision';
import { nurseryActionScope } from '@/lib/nursery-scope';
import { isModuleEnabled, getModuleConfig } from '@/lib/module-access';
import { resolveDesignUpdate } from '@/lib/design-lock';
import { isEmailTaken } from '@/lib/account';

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
  // S-21: לא משייכים מחדש משתמש קיים (בעלים של משתלה אחרת / סופר-אדמין)
  if (ownerPassword && (await isEmailTaken(prisma, ownerEmail))) {
    return { error: 'האימייל כבר משויך למשתמש קיים — יש לבחור אימייל אחר לבעלים' };
  }

  const nursery = await prisma.nursery.create({
    data: { name, subdomain, ownerEmail, logoUrl },
  });
  await syncMasterCategoriesToNursery(nursery.id);

  if (ownerPassword) {
    if (ownerPassword.length < 8) {
      return { error: 'המשתלה נוצרה, אך הסיסמה קצרה מ-8 תווים - לא נוצר משתמש בעלים' };
    }
    const passwordHash = await hashPassword(ownerPassword);
    try {
      await prisma.user.create({
        data: { email: ownerEmail, passwordHash, role: 'NURSERY_OWNER', nurseryId: nursery.id },
      });
    } catch {
      // מרוץ: האימייל נתפס בין הבדיקה ליצירה — לא דורסים
      return { error: 'המשתלה נוצרה, אך האימייל כבר משויך למשתמש קיים — לא נוצר משתמש בעלים' };
    }
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
  // R06: גם עובד (לא כותב תוכן — נאכף ב-nurseryActionScope) עורך את פרטי המשתלה
  const user = await requireUser(['SUPER_ADMIN', 'NURSERY_OWNER', 'NURSERY_STAFF']);
  const id = String(formData.get('id') || '');
  if (!id) return { error: 'מזהה חסר' };

  const isSuper = user.role === 'SUPER_ADMIN';
  if (!isSuper) {
    // בעלים: רק המשתלה שלו, ורק כשהיא פעילה (C-P1-01)
    const scope = await nurseryActionScope();
    if (!scope.ok) return { error: scope.error };
    if (scope.nurseryId !== id) return { error: 'אין הרשאה לערוך משתלה זו' };
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

  const heroLayoutRaw = String(formData.get('heroLayout') || 'centered') as HeroLayout;
  const heroLayout = HERO_LAYOUTS.includes(heroLayoutRaw) ? heroLayoutRaw : 'centered';

  let slidesJson: unknown = [];
  try {
    slidesJson = JSON.parse(String(formData.get('carouselSlides') || '[]'));
  } catch {
    return { error: 'נתוני הקרוסלה לא תקינים' };
  }
  const carousel = normalizeCarousel({
    slides: slidesJson,
    intervalSec: formData.get('carouselInterval'),
  });
  if (heroLayout === 'carousel' && carousel.slides.length === 0) {
    return { error: 'בפריסת קרוסלה יש להעלות לפחות תמונה אחת' };
  }

  const themeConfig = {
    hero: {
      layout: heroLayout,
      headline: s(formData, 'heroHeadline'),
      subheadline: s(formData, 'heroSubheadline'),
      imageUrl: s(formData, 'heroImageUrl'),
      ctaText: s(formData, 'heroCtaText'),
      ctaHref: s(formData, 'heroCtaHref'),
    },
    carousel,
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
    contactEmail: s(formData, 'contactEmail'),
    aboutText: s(formData, 'aboutText'),
    addressLine: s(formData, 'addressLine'),
    city: s(formData, 'city'),
    mapLink: s(formData, 'mapLink'),
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
    if (!isSuper) await keepLockedDesignFields(id, data);
    await prisma.nursery.update({ where: { id }, data });
  } catch {
    return { error: 'שגיאה בשמירה (ייתכן שהדומיין המותאם כבר תפוס)' };
  }

  revalidatePath('/admin/nurseries');
  revalidatePath(`/admin/nurseries/${id}`);
  revalidatePath('/admin/settings');
  return { ok: true };
}

/**
 * בעלים ללא מודול "שליטה בעיצוב" (או ללא הרשאת קרוסלה) אינו רשאי לשנות את העיצוב.
 * הטופס שולח את הערכים הקיימים כשדות נסתרים, אבל השרת לא סומך עליהם: שומרים את
 * הערכים השמורים במקום ערכי הטופס (C-P1-01, אפיון §3.02, §16 קבלה).
 */
async function keepLockedDesignFields(id: string, data: Prisma.NurseryUpdateInput): Promise<void> {
  const current = await prisma.nursery.findUnique({
    where: { id },
    select: { themeConfig: true, primaryColor: true },
  });
  if (!current) return;
  const designEnabled = await isModuleEnabled(id, 'design');
  const carouselAllowed = designEnabled && (await getModuleConfig(id, 'design')).carousel !== false;
  const next = resolveDesignUpdate(
    { themeConfig: data.themeConfig, primaryColor: (data.primaryColor as string | null | undefined) ?? null },
    { themeConfig: current.themeConfig, primaryColor: current.primaryColor },
    { designEnabled, carouselAllowed },
  );
  data.themeConfig =
    next.themeConfig === null || next.themeConfig === undefined
      ? Prisma.JsonNull
      : (next.themeConfig as Prisma.InputJsonValue);
  if (!designEnabled) data.primaryColor = next.primaryColor;
}

const DESIGN_FLAGS = ['colors', 'hero', 'carousel', 'popup', 'sticky'] as const;

/** שיוך מודולים למשתלה (סופר-אדמין). טופס אחד לכל המודולים. */
export async function setNurseryModules(
  _prev: NurseryFormState,
  formData: FormData,
): Promise<NurseryFormState> {
  await requireUser(['SUPER_ADMIN']);
  const nurseryId = String(formData.get('nurseryId') || '');
  if (!nurseryId) return { error: 'מזהה חסר' };

  for (const key of MODULE_KEYS) {
    const isEnabled = formData.get(`mod_${key}`) === 'on';

    const config: Record<string, unknown> = {};
    if (key === 'sales') {
      config.mode = formData.get('sales_mode') === 'QUOTE' ? 'QUOTE' : 'ONLINE';
    }
    if (key === 'design') {
      for (const flag of DESIGN_FLAGS) config[flag] = formData.get(`design_${flag}`) === 'on';
    }
    const hasConfig = Object.keys(config).length > 0;

    await prisma.nurseryModule.upsert({
      where: { nurseryId_moduleKey: { nurseryId, moduleKey: key } },
      update: {
        isEnabled,
        config: hasConfig ? (config as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
      create: {
        nurseryId,
        moduleKey: key,
        isEnabled,
        config: hasConfig ? (config as Prisma.InputJsonValue) : undefined,
      },
    });
  }

  revalidatePath(`/admin/nurseries/${nurseryId}`);
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
