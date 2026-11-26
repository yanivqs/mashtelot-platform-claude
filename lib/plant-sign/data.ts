import type { Prisma } from '@prisma/client';
import { localizeProduct } from '@/lib/catalog-localize';
import { tenantOrigin, tenantUrl } from '@/lib/seo';
import { signFromSource, type SignSource } from './source';
import type { SignData, SignSettings, SignSocialLink } from './types';

/** השדות שנדרשים לשלט מתוך מוצר */
export const SIGN_PRODUCT_SELECT = {
  id: true,
  slug: true,
  customTitle: true,
  customDescription: true,
  customImageUrl: true,
  isActive: true,
  imageRequired: true,
  signSettings: true,
  catalogOverrides: true,
  catalogRevision: { select: { data: true } },
  plant: true,
} satisfies Prisma.NurseryProductSelect;

export type SignProduct = Prisma.NurseryProductGetPayload<{ select: typeof SIGN_PRODUCT_SELECT }>;

export interface SignNursery {
  name: string;
  logoUrl: string | null;
  subdomain: string;
  customDomain: string | null;
}

export const SIGN_NURSERY_SELECT = { name: true, logoUrl: true, subdomain: true, customDomain: true } satisfies Prisma.NurserySelect;

export { signSocialLinks } from './social';

const str = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);

export const SIGN_LIMITS = { description: 320, notes: 140, plantType: 60, note: 90 } as const;

/** קריאה בטוחה של sign_settings (JSON חופשי מה-DB או מהדפדפן) */
export function parseSignSettings(json: unknown): SignSettings {
  const o = json && typeof json === 'object' && !Array.isArray(json) ? (json as Record<string, unknown>) : {};
  const light = o.light && typeof o.light === 'object' ? (o.light as Record<string, unknown>) : null;
  const water = o.water && typeof o.water === 'object' ? (o.water as Record<string, unknown>) : null;
  const rawRange = light?.range;
  const range =
    Array.isArray(rawRange) && rawRange.length === 2 && rawRange.every((x) => Number.isInteger(x) && Number(x) >= 0 && Number(x) <= 3)
      ? ([Math.min(...(rawRange as number[])), Math.max(...(rawRange as number[]))] as [number, number])
      : undefined;
  const amount = water && typeof water.amount === 'number' && [1, 1.5, 2, 2.5, 3].includes(water.amount) ? water.amount : undefined;
  const out: SignSettings = {};
  const description = str(o.description, SIGN_LIMITS.description);
  const notes = str(o.notes, SIGN_LIMITS.notes);
  const plantType = str(o.plantType, SIGN_LIMITS.plantType);
  if (description) out.description = description;
  if (notes) out.notes = notes;
  if (plantType) out.plantType = plantType;
  const lightNote = light ? str(light.note, SIGN_LIMITS.note) : null;
  if (range || lightNote) out.light = { ...(range ? { range } : {}), ...(lightNote ? { note: lightNote } : {}) };
  const waterNote = water ? str(water.note, SIGN_LIMITS.note) : null;
  if (amount || waterNote) out.water = { ...(amount ? { amount } : {}), ...(waterNote ? { note: waterNote } : {}) };
  return out;
}

export function isEmptySettings(s: SignSettings): boolean {
  return Object.keys(s).length === 0;
}

/** מקור השלט ממוצר-צמח (עם הנתונים המקומיים של המשתלה), מהמשתלה ומהערוצים שלה */
export function buildSignSource(args: { product: SignProduct; nursery: SignNursery; socials: SignSocialLink[] }): SignSource | null {
  const p = localizeProduct(args.product);
  const plant = p.plant;
  if (!plant) return null;
  return {
    productId: p.id,
    hebrewName: plant.hebrewName,
    // שם הסוג באות גדולה (מוסכמה בוטנית): "lavandula dentata" → "Lavandula dentata"
    latinName: plant.latinName?.trim() ? plant.latinName.trim().replace(/^[a-z]/, (c) => c.toUpperCase()) : null,
    imageUrl: p.customImageUrl || plant.imageUrl || null,
    logoUrl: args.nursery.logoUrl || null,
    nurseryName: args.nursery.name,
    socials: args.socials,
    website: tenantOrigin(args.nursery).replace(/^https?:\/\//, ''),
    // כתובת קצרה לפי 8 תווי המזהה: QR פחות צפוף (קריא בהדפסה קטנה), ונשאר תקף גם אם שם המוצר או הכתובת שלו ישתנו
    qrUrl: tenantUrl(args.nursery, `/product/${p.id.slice(0, 8)}`),
    storeVisible: p.isActive && !p.imageRequired,
    plant: {
      description: plant.description,
      plantType: plant.plantType,
      uniqueness: plant.uniqueness,
      floweringSeason: plant.floweringSeason,
      flowerColor: plant.flowerColor,
      flowering: plant.flowering,
      height: plant.height,
      evergreen: plant.evergreen,
      coastal: plant.coastal,
      native: plant.native,
      growthRate: plant.growthRate,
      care: plant.care,
      light: plant.light,
      water: plant.water,
    },
    productDescription: p.customDescription,
    settings: parseSignSettings(p.signSettings),
  };
}

export function buildSignData(args: {
  product: SignProduct;
  nursery: SignNursery;
  socials: SignSocialLink[];
  settings?: SignSettings | null;
}): SignData | null {
  const src = buildSignSource(args);
  return src ? signFromSource(src, args.settings ?? src.settings) : null;
}
