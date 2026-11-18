/**
 * מוצר דפוס עם מאגר דוגמאות (כרטיסי ברכה): בעל המשתלה בוחר דוגמאות, והכמות נגזרת ממספרן.
 * חוק (החלטת בעלים 2026-11-19): כפולות של 8 בלבד. 8 דוגמאות — 400 מכל אחת (3,200);
 * 16 ומעלה — 200 מכל אחת (16 = 3,200, 24 = 4,800...). טהור — משותף לשרת, לדפדפן ולבדיקות.
 */
export interface DesignRule {
  /** הדוגמאות נבחרות בכפולות של מספר זה */
  packSize: number;
  /** כמות לכל דוגמא כשנבחרה חבילה אחת בלבד */
  firstPackPerDesign: number;
  /** כמות לכל דוגמא מהחבילה השנייה ומעלה */
  perDesign: number;
}

export const GREETING_CARDS_RULE: DesignRule = { packSize: 8, firstPackPerDesign: 400, perDesign: 200 };

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

export type DesignQuantity = { ok: true; count: number; perDesign: number; total: number } | { ok: false; count: number; error: string };

/** הכמות לפי מספר הדוגמאות, או ההודעה שמסבירה מה לתקן. */
export function designQuantity(rule: DesignRule, count: number): DesignQuantity {
  const pack = rule.packSize;
  if (!Number.isInteger(count) || count < pack) {
    const n = Number.isInteger(count) && count > 0 ? count : 0;
    return {
      ok: false,
      count: n,
      error: n === 0 ? `יש לבחור לפחות ${pack} דוגמאות לביצוע הזמנה` : `יש לבחור לפחות ${pack} דוגמאות לביצוע הזמנה (נבחרו ${n}, חסרות ${pack - n})`,
    };
  }
  const extra = count % pack;
  if (extra !== 0) {
    return {
      ok: false,
      count,
      error: `ניתן להזמין בכפולות של ${pack} דוגמאות בלבד. נבחרו ${count}: הסירו ${extra} ${extra === 1 ? 'דוגמא' : 'דוגמאות'} או הוסיפו עוד ${pack - extra}`,
    };
  }
  const perDesign = count === pack ? rule.firstPackPerDesign : rule.perDesign;
  return { ok: true, count, perDesign, total: perDesign * count };
}

/** תחילית התווית של שורת הדוגמאות במפרט — כדי להבדיל אותה משדות התבנית */
export const DESIGNS_LABEL_PREFIX = 'דוגמאות (';

/** הדוגמאות שנבחרו, כפי שנשמרות במפרט ובהזמנה (values.designs) */
export interface ChosenDesigns {
  ids: string[];
  codes: string[];
  perDesign: number;
}

/** שורת התצוגה בהזמנה: מה להדפיס ובאיזו כמות. */
export function describeDesigns(designs: ReadonlyArray<{ code: string; title: string }>, perDesign: number): { label: string; value: string } {
  return {
    label: `${DESIGNS_LABEL_PREFIX}${designs.length} × ${perDesign.toLocaleString('he-IL')} יח')`,
    value: designs.map((d) => `${d.code} ${d.title}`).join(' · '),
  };
}
