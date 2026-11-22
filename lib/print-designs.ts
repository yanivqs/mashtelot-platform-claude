/**
 * מוצר דפוס עם מאגר דוגמאות (כרטיסי ברכה): בעל המשתלה בוחר דוגמאות ואת הכמות מכל אחת.
 * חוק (החלטות בעלים 2026-11-19): הדוגמאות בכפולות של 8; הכמות מכל דוגמא בקפיצות של 200;
 * סך הכול לפחות 3,200 כרטיסים. ברירת המחדל: 200 מכל דוגמא (עדכון 2026-11-19); עם 8 דוגמאות בלבד
 * מציעים להגדיל ל-400 מכל אחת או להוסיף עוד 8 דוגמאות.
 * כרטיסי ברכה בינוניים (2026-11-22): לפחות 10 דוגמאות, כל מספר מ-10 ומעלה, 50 מכל דוגמא בקפיצות של 50.
 * כרטיסי ברכה מיוחדים ללא לוגו (2026-11-22): כל מספר דוגמאות, 20 מכל דוגמא בקפיצות של 20, לפחות 240 בסך הכול.
 * טהור — משותף לשרת, לדפדפן ולבדיקות.
 */
export interface DesignRule {
  /** מספר הדוגמאות המינימלי בהזמנה (וגם הכפולה, אלא אם designMultiple קובע אחרת) */
  packSize: number;
  /** מספר הדוגמאות חייב להתחלק במספר זה; 1 — כל מספר מ-packSize ומעלה. ברירת מחדל: packSize */
  designMultiple?: number;
  /** הכמות לכל דוגמא שנדרשת כשנבחרה חבילה אחת בלבד (מינימום ההזמנה = packSize × זה) */
  firstPackPerDesign: number;
  /** כמות ברירת מחדל לכל דוגמא מהחבילה השנייה ומעלה, וגם הקפיצה בבחירת הכמות */
  perDesign: number;
  /** מינימום כרטיסים בסך הכול, כשאינו packSize × firstPackPerDesign */
  minTotal?: number;
}

export const GREETING_CARDS_RULE: DesignRule = { packSize: 8, firstPackPerDesign: 400, perDesign: 200 };
export const GREETING_CARDS_MEDIUM_RULE: DesignRule = { packSize: 10, designMultiple: 1, firstPackPerDesign: 50, perDesign: 50 };
export const GREETING_CARDS_LARGE_RULE: DesignRule = { packSize: 12, designMultiple: 2, firstPackPerDesign: 26, perDesign: 26 };
export const GREETING_CARDS_SPECIAL_LOGO_RULE: DesignRule = { packSize: 6, designMultiple: 1, firstPackPerDesign: 65, perDesign: 65 };
export const GREETING_CARDS_SPECIAL_PLAIN_RULE: DesignRule = { packSize: 1, firstPackPerDesign: 20, perDesign: 20, minTotal: 240 };

/** הכפולה של מספר הדוגמאות */
export const designMultiple = (rule: DesignRule) => rule.designMultiple ?? rule.packSize;

/** הכמות הגדולה ביותר לדוגמא אחת */
export const MAX_PER_DESIGN = 20_000;

const posInt = (v: unknown, max: number): number | null => {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= max ? n : null;
};

/** null — המוצר אינו מוצר דוגמאות (מחשבון רגיל). */
export function parseDesignRule(json: unknown): DesignRule | null {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return null;
  const o = json as Record<string, unknown>;
  const packSize = posInt(o.packSize, 100);
  const firstPackPerDesign = posInt(o.firstPackPerDesign, 1_000_000);
  const perDesign = posInt(o.perDesign, 1_000_000);
  if (!packSize || !firstPackPerDesign || !perDesign) return null;
  const multiple = o.designMultiple === undefined || o.designMultiple === null ? null : posInt(o.designMultiple, 100);
  const rule: DesignRule = multiple === null || multiple === packSize ? { packSize, firstPackPerDesign, perDesign } : { packSize, designMultiple: multiple, firstPackPerDesign, perDesign };
  const total = o.minTotal === undefined || o.minTotal === null || o.minTotal === '' ? null : posInt(o.minTotal, 10_000_000);
  return total !== null && total !== packSize * firstPackPerDesign ? { ...rule, minTotal: total } : rule;
}

/** מינימום כרטיסים בהזמנה */
export const minTotal = (rule: DesignRule) => rule.minTotal ?? rule.packSize * rule.firstPackPerDesign;

/** הכמות שמוצעת לכל דוגמא שנבחרה */
export const defaultPerDesign = (rule: DesignRule) => rule.perDesign;

/** הכמויות שאפשר לבחור לדוגמא: קפיצות של perDesign */
export function quantityChoices(rule: DesignRule, upTo = 10_000): number[] {
  const out: number[] = [];
  for (let q = rule.perDesign; q <= Math.min(upTo, MAX_PER_DESIGN); q += rule.perDesign) out.push(q);
  return out;
}

const fmt = (n: number) => n.toLocaleString('he-IL');

/**
 * short — חבילה אחת שסך הכמות בה מתחת למינימום: אפשר להגדיל את הכמות מכל דוגמא ל-firstPackPerDesign
 * או להוסיף עוד חבילת דוגמאות.
 */
export type DesignOrderCheck = { ok: true; count: number; total: number } | { ok: false; count: number; total: number; error: string; short?: boolean };

/** בדיקת ההזמנה לפי החוק: מספר הדוגמאות, הכמות מכל אחת והסכום. מחזירה את ההודעה שמסבירה מה לתקן. */
export function checkDesignOrder(rule: DesignRule, quantities: readonly number[]): DesignOrderCheck {
  const pack = rule.packSize;
  const count = quantities.length;
  const total = quantities.reduce((s, q) => s + (Number.isFinite(q) ? q : 0), 0);
  if (count < pack) {
    return {
      ok: false,
      count,
      total,
      error: count === 0 ? `יש לבחור לפחות ${pack} דוגמאות לביצוע הזמנה` : `יש לבחור לפחות ${pack} דוגמאות לביצוע הזמנה (נבחרו ${count}, חסרות ${pack - count})`,
    };
  }
  const mult = designMultiple(rule);
  const extra = mult > 1 ? count % mult : 0;
  if (extra !== 0) {
    return {
      ok: false,
      count,
      total,
      error: `ניתן להזמין בכפולות של ${mult} דוגמאות בלבד. נבחרו ${count}: הסירו ${extra} ${extra === 1 ? 'דוגמא' : 'דוגמאות'} או הוסיפו עוד ${mult - extra}`,
    };
  }
  if (quantities.some((q) => !Number.isInteger(q) || q < rule.perDesign || q > MAX_PER_DESIGN || q % rule.perDesign !== 0)) {
    return { ok: false, count, total, error: `הכמות מכל דוגמא בקפיצות של ${fmt(rule.perDesign)} (לפחות ${fmt(rule.perDesign)})` };
  }
  const min = minTotal(rule);
  if (total < min && count === pack && rule.minTotal === undefined) {
    return {
      ok: false,
      count,
      total,
      short: true,
      error: `מינימום הזמנה לכרטיסים היא ${fmt(min)} יח'. יש להוסיף עוד ${pack} דוגמאות או לחילופין להגדיל כמות ל-${fmt(rule.firstPackPerDesign)} יח' לדוגמא`,
    };
  }
  if (total < min) {
    return { ok: false, count, total, error: `סך הכול לפחות ${fmt(min)} כרטיסים (כרגע ${fmt(total)}). הוסיפו דוגמאות או הגדילו את הכמות באחת הדוגמאות` };
  }
  return { ok: true, count, total };
}

/** הסבר החוק למשתלה, בראש דף המוצר */
export function describeRule(rule: DesignRule): string {
  const mult = designMultiple(rule);
  const min = fmt(minTotal(rule));
  if (rule.minTotal !== undefined && rule.packSize === 1) {
    return `בוחרים דוגמאות כרצונכם, ${fmt(rule.perDesign)} יח' מכל דוגמא (אפשר להגדיל בקפיצות של ${fmt(rule.perDesign)}). מינימום הזמנה ${min} כרטיסים בסך הכול.`;
  }
  if (rule.firstPackPerDesign === rule.perDesign) {
    const multiple = mult > 1 ? ` בכפולות של ${mult}` : '';
    return `בוחרים לפחות ${rule.packSize} דוגמאות${multiple}, ${fmt(rule.perDesign)} יח' מכל דוגמא (אפשר להגדיל בקפיצות של ${fmt(rule.perDesign)}). מינימום הזמנה ${min} כרטיסים.`;
  }
  return `בוחרים דוגמאות בכפולות של ${mult}, ${fmt(rule.perDesign)} יח' מכל דוגמא (אפשר להגדיל בכל דוגמא). מינימום הזמנה ${min} כרטיסים: ${rule.packSize * 2} דוגמאות ומעלה, או ${rule.packSize} דוגמאות של ${fmt(rule.firstPackPerDesign)} יח'.`;
}

/** תחילית התווית של שורת הדוגמאות במפרט — כדי להבדיל אותה משדות התבנית */
export const DESIGNS_LABEL_PREFIX = 'דוגמאות (';

/** הדוגמאות שנבחרו והכמות מכל אחת, כפי שנשמרות במפרט ובהזמנה (values.designs) */
export interface ChosenDesigns {
  ids: string[];
  codes: string[];
  quantities: number[];
}

/** הדוגמאות והכמויות מתוך מפרט שמור. תומך גם בצורה הראשונה (כמות אחידה perDesign). */
export function storedDesignItems(stored: unknown): Array<{ id: string; quantity: number }> {
  const s = stored as { ids?: unknown; quantities?: unknown; perDesign?: unknown } | null | undefined;
  const ids = Array.isArray(s?.ids) ? s.ids.filter((x): x is string => typeof x === 'string') : [];
  const qs = Array.isArray(s?.quantities) ? s.quantities.map(Number) : [];
  return ids.map((id, i) => ({ id, quantity: qs[i] ?? Number(s?.perDesign) }));
}

/** שורת התצוגה בהזמנה: מה להדפיס ובאיזו כמות. */
export function describeDesigns(designs: ReadonlyArray<{ code: string; title: string; quantity: number }>): { label: string; value: string } {
  const total = designs.reduce((s, d) => s + d.quantity, 0);
  return {
    label: `${DESIGNS_LABEL_PREFIX}${designs.length}, סה"כ ${fmt(total)} יח')`,
    value: designs.map((d) => `${d.code} ${d.title} ×${fmt(d.quantity)}`).join(' · '),
  };
}
