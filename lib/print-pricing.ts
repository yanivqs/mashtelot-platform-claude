/**
 * תמחור מוצרי דפוס (טהור, ללא תלות בשרת): מחיר בסיס ליחידה, מדרגות כמות
 * ("מ-500 יח׳ — 1.50 ₪ ליח׳") ותוספות גימור ליחידה (למינציה, UV וכו').
 */

export interface PriceTier {
  minQty: number;
  unitPrice: number;
}

/** קריאת מדרגות מחיר מ-JSON (מסנן ערכים לא תקינים, ממיין לפי כמות). */
export function parsePriceTiers(json: unknown): PriceTier[] {
  if (!Array.isArray(json)) return [];
  const tiers: PriceTier[] = [];
  for (const row of json) {
    if (!row || typeof row !== 'object') continue;
    const minQty = Number((row as Record<string, unknown>).minQty);
    const unitPrice = Number((row as Record<string, unknown>).unitPrice);
    if (Number.isInteger(minQty) && minQty > 0 && Number.isFinite(unitPrice) && unitPrice > 0) {
      tiers.push({ minQty, unitPrice });
    }
  }
  // כמות כפולה — נשארת האחרונה
  const byQty = new Map(tiers.map((t) => [t.minQty, t]));
  return [...byQty.values()].sort((a, b) => a.minQty - b.minQty);
}

/** מחיר ליחידה לכמות נתונה: המדרגה הגבוהה ביותר שהכמות הגיעה אליה, אחרת מחיר הבסיס. */
export function unitPriceFor(basePrice: number, tiers: PriceTier[], quantity: number): number {
  let price = basePrice;
  for (const t of tiers) {
    if (quantity >= t.minQty) price = t.unitPrice;
  }
  return price;
}

export interface SelectedOption {
  name: string;
  extraPrice: number;
}

/** מחיר יחידה סופי (מדרגה + תוספות) וסה"כ לשורה. */
export function printLinePrice(
  basePrice: number,
  tiers: PriceTier[],
  quantity: number,
  options: SelectedOption[] = [],
): { unitPrice: number; total: number } {
  const extras = options.reduce((sum, o) => sum + o.extraPrice, 0);
  const unitPrice = round2(unitPriceFor(basePrice, tiers, quantity) + extras);
  return { unitPrice, total: round2(unitPrice * quantity) };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
