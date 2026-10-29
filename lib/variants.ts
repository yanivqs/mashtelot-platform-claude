/**
 * וריאנטים (§7.01, R02-03) — לוגיקה טהורה, בטוחה לייבוא ברכיבי לקוח.
 *
 * מחיר וריאנט אופציונלי: ריק = יורש ממחיר המוצר (החלטת בעלים). מחיר לפני הנחה:
 * לווריאנט עם מחיר משלו — רק שלו; לווריאנט שיורש מחיר — שלו, ואם אין, של המוצר.
 */
import { availableQuantity } from '@/lib/stock';

type Num = number | string | { toString(): string } | null | undefined;
const num = (v: Num): number | null => (v === null || v === undefined || v === '' ? null : Number(v.toString()));

export interface VariantLike {
  id: string;
  name: string;
  option1?: string | null;
  option2?: string | null;
  colorHex?: string | null;
  price: Num;
  compareAtPrice: Num;
  stockQuantity: number;
  reservedQuantity: number;
  imageUrls?: string[] | null;
  isDefault: boolean;
  isActive: boolean;
  sortOrder: number;
}

export interface ProductPriceLike {
  price: Num;
  compareAtPrice: Num;
}

export function effectivePrice(v: Pick<VariantLike, 'price'>, p: ProductPriceLike): number {
  return num(v.price) ?? num(p.price) ?? 0;
}

export function effectiveCompareAt(v: Pick<VariantLike, 'price' | 'compareAtPrice'>, p: ProductPriceLike): number | null {
  const own = num(v.compareAtPrice);
  if (num(v.price) !== null) return own;
  return own ?? num(p.compareAtPrice);
}

/** וריאנטים פעילים, ברירת המחדל ראשונה ואחר כך לפי סדר. */
export function activeVariants<V extends VariantLike>(variants: V[]): V[] {
  return variants
    .filter((v) => v.isActive)
    .sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.sortOrder - b.sortOrder);
}

/** האם יש בחירה אמיתית ללקוח (יותר מווריאנט פעיל אחד). */
export function hasChoice(variants: VariantLike[]): boolean {
  return activeVariants(variants).length > 1;
}

export interface PriceSummary {
  min: number;
  max: number;
  /** מחיר לפני הנחה — רק כשיש מחיר אחיד */
  compareAt: number | null;
  /** יש לפחות וריאנט פעיל עם מלאי זמין */
  inStock: boolean;
}

export function priceSummary(variants: VariantLike[], p: ProductPriceLike): PriceSummary {
  const active = activeVariants(variants);
  if (active.length === 0) {
    const price = num(p.price) ?? 0;
    return { min: price, max: price, compareAt: num(p.compareAtPrice), inStock: false };
  }
  const prices = active.map((v) => effectivePrice(v, p));
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const compareAt = min === max ? effectiveCompareAt(active[0]!, p) : null;
  return {
    min,
    max,
    compareAt: compareAt !== null && compareAt > min ? compareAt : null,
    inStock: active.some((v) => availableQuantity(v) > 0),
  };
}

/** שם לתצוגה בעגלה/הזמנה: "ורד אדום — עציץ 4 ליטר" (וריאנט בלי שם → שם המוצר בלבד). */
export function lineTitle(productTitle: string, variantName: string | null | undefined): string {
  const v = variantName?.trim();
  return v ? `${productTitle} — ${v}` : productTitle;
}

/** תמונות לווריאנט: תמונות הווריאנט קודם, ואחריהן תמונת המוצר (ללא כפילויות). */
export function variantImages(v: Pick<VariantLike, 'imageUrls'> | null | undefined, productImage: string | null): string[] {
  const out = [...(v?.imageUrls ?? []).filter(Boolean)];
  if (productImage && !out.includes(productImage)) out.push(productImage);
  return out;
}

/** שם התצוגה של וריאנט משני הצירים: "גדול / כתום" (ציר ריק מושמט). */
export function composeVariantName(option1: string | null | undefined, option2: string | null | undefined): string {
  return [option1, option2].map((s) => s?.trim() ?? '').filter(Boolean).join(' / ');
}

export interface OptionValue {
  value: string;
  /** דוגמית צבע — רק בציר הצבע */
  colorHex: string | null;
}

export interface OptionMatrix<V> {
  /** ערכי הציר הראשון, לפי סדר הופעה */
  axis1: OptionValue[];
  /** ערכי הציר השני (ריק = ציר אחד) */
  axis2: OptionValue[];
  /** הווריאנט לשילוב (ציר שני ריק = '') */
  find(a1: string, a2: string): V | undefined;
}

const HEX_RE = /^#[0-9a-f]{6}$/i;

/**
 * מטריצת הבחירה בדף המוצר. ערך ציר ראשון: option1, ואם אין — השם (וריאנטים ישנים).
 * דוגמית הצבע שייכת לציר האחרון: לציר השני כשיש, אחרת לציר הראשון.
 */
export function optionMatrix<V extends Pick<VariantLike, 'name' | 'option1' | 'option2' | 'colorHex'>>(variants: V[]): OptionMatrix<V> {
  const a1 = (v: V) => (v.option1?.trim() || v.name.trim());
  const a2 = (v: V) => v.option2?.trim() ?? '';
  const twoAxes = variants.some((v) => a2(v));
  const hex = (v: V) => (v.colorHex && HEX_RE.test(v.colorHex) ? v.colorHex : null);
  const axis1: OptionValue[] = [];
  const axis2: OptionValue[] = [];
  for (const v of variants) {
    if (!axis1.some((o) => o.value === a1(v))) axis1.push({ value: a1(v), colorHex: twoAxes ? null : hex(v) });
    if (twoAxes && a2(v) && !axis2.some((o) => o.value === a2(v))) axis2.push({ value: a2(v), colorHex: hex(v) });
  }
  return { axis1, axis2, find: (x, y) => variants.find((v) => a1(v) === x && a2(v) === y) };
}

const SKU_RE = /^[A-Za-z0-9._\-/]{1,64}$/;
const BARCODE_RE = /^[0-9A-Za-z-]{1,64}$/;

export interface VariantInput {
  /** ערך הציר הראשון (למשל "גדול") */
  name: string;
  /** ערך הציר השני (למשל "כתום") */
  option2?: string | null;
  /** דוגמית צבע #RRGGBB */
  colorHex?: string | null;
  sku: string | null;
  barcode: string | null;
  price: number | null;
  compareAtPrice: number | null;
  stockQuantity: number;
  imageUrls: string[];
  isActive: boolean;
}

/** ולידציה לקלט וריאנט מהניהול. מחזיר הודעת שגיאה או null. */
export function validateVariantInput(v: VariantInput, opts: { isDefault: boolean; hasSiblings: boolean }): string | null {
  if (v.name.length > 80) return 'שם הווריאנט ארוך מדי (עד 80 תווים)';
  if ((v.option2?.length ?? 0) > 40) return 'ערך הציר השני ארוך מדי (עד 40 תווים)';
  if (v.option2?.trim() && !v.name.trim()) return 'כשיש ערך בציר השני (צבע), צריך גם ערך בציר הראשון (גודל)';
  if (v.colorHex && !HEX_RE.test(v.colorHex)) return 'צבע הדוגמית לא תקין';
  if (!opts.isDefault && !v.name.trim()) return 'יש לתת שם לווריאנט (למשל "עציץ 4 ליטר")';
  if (opts.isDefault && opts.hasSiblings && !v.name.trim()) return 'כשיש כמה וריאנטים, לכל אחד צריך שם — גם לברירת המחדל';
  if (v.sku && !SKU_RE.test(v.sku)) return 'SKU: אותיות באנגלית, ספרות ו- . _ - / בלבד';
  if (v.barcode && !BARCODE_RE.test(v.barcode)) return 'ברקוד: ספרות/אותיות באנגלית בלבד';
  if (v.price !== null && (!Number.isFinite(v.price) || v.price < 0)) return 'מחיר לא תקין';
  if (v.compareAtPrice !== null && (!Number.isFinite(v.compareAtPrice) || v.compareAtPrice < 0)) return 'מחיר לפני הנחה לא תקין';
  if (!Number.isInteger(v.stockQuantity) || v.stockQuantity < 0) return 'מלאי חייב להיות מספר שלם, 0 ומעלה';
  if (v.imageUrls.length > 8) return 'עד 8 תמונות לווריאנט';
  if (v.imageUrls.some((u) => !/^https:\/\//.test(u))) return 'כתובת תמונה לא תקינה';
  if (opts.isDefault && !v.isActive && !opts.hasSiblings) return 'אי אפשר להשבית את הווריאנט היחיד — השביתו את המוצר';
  return null;
}
