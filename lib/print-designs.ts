/**
 * מוצר דפוס עם מאגר דוגמאות (כרטיסי ברכה): בעל המשתלה בוחר דוגמאות ואת הכמות מכל אחת.
 * חוק (החלטות בעלים 2026-11-19): הדוגמאות בכפולות של 8; הכמות מכל דוגמא בקפיצות של 200;
 * סך הכול לפחות 3,200 כרטיסים. ברירת המחדל: 400 מכל דוגמא כשנבחרו עד 8, ו-200 מ-16 ומעלה.
 * טהור — משותף לשרת, לדפדפן ולבדיקות.
 */
export interface DesignRule {
  /** הדוגמאות נבחרות בכפולות של מספר זה */
  packSize: number;
  /** כמות ברירת מחדל לכל דוגמא כשנבחרה חבילה אחת בלבד (וגם: מינימום ההזמנה = packSize × זה) */
  firstPackPerDesign: number;
  /** כמות ברירת מחדל לכל דוגמא מהחבילה השנייה ומעלה, וגם הקפיצה בבחירת הכמות */
  perDesign: number;
}

export const GREETING_CARDS_RULE: DesignRule = { packSize: 8, firstPackPerDesign: 400, perDesign: 200 };

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
  return packSize && firstPackPerDesign && perDesign ? { packSize, firstPackPerDesign, perDesign } : null;
}

/** מינימום כרטיסים בהזמנה */
export const minTotal = (rule: DesignRule) => rule.packSize * rule.firstPackPerDesign;

/** הכמות שמוצעת לכל דוגמא, לפי מספר הדוגמאות שנבחרו */
export const defaultPerDesign = (rule: DesignRule, count: number) => (count <= rule.packSize ? rule.firstPackPerDesign : rule.perDesign);

/** הכמויות שאפשר לבחור לדוגמא: קפיצות של perDesign */
export function quantityChoices(rule: DesignRule, upTo = 10_000): number[] {
  const out: number[] = [];
  for (let q = rule.perDesign; q <= Math.min(upTo, MAX_PER_DESIGN); q += rule.perDesign) out.push(q);
  return out;
}

const fmt = (n: number) => n.toLocaleString('he-IL');

export type DesignOrderCheck = { ok: true; count: number; total: number } | { ok: false; count: number; total: number; error: string };

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
  const extra = count % pack;
  if (extra !== 0) {
    return {
      ok: false,
      count,
      total,
      error: `ניתן להזמין בכפולות של ${pack} דוגמאות בלבד. נבחרו ${count}: הסירו ${extra} ${extra === 1 ? 'דוגמא' : 'דוגמאות'} או הוסיפו עוד ${pack - extra}`,
    };
  }
  if (quantities.some((q) => !Number.isInteger(q) || q < rule.perDesign || q > MAX_PER_DESIGN || q % rule.perDesign !== 0)) {
    return { ok: false, count, total, error: `הכמות מכל דוגמא בקפיצות של ${fmt(rule.perDesign)} (לפחות ${fmt(rule.perDesign)})` };
  }
  const min = minTotal(rule);
  if (total < min) {
    return { ok: false, count, total, error: `סך הכול לפחות ${fmt(min)} כרטיסים (כרגע ${fmt(total)}). הגדילו את הכמות באחת הדוגמאות` };
  }
  return { ok: true, count, total };
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
