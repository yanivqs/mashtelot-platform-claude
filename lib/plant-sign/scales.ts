/**
 * שלט צמח: תרגום ערכי האור וההשקיה (טקסט חופשי בקטלוג) לאיורים — סולם של 4 שמשות ו-3 טיפות.
 * ללא תלות בשרת — משותף לתצוגה המקדימה, לעורך ולהפקת ה-PDF.
 */

/** שלבי האור: 0 שמש מלאה, 1 חצי שמש, 2 אור מסונן, 3 צל */
export const LIGHT_STEPS = ['שמש מלאה', 'חצי שמש', 'אור מסונן', 'צל'] as const;

export interface LightScale {
  /** טווח השלבים הפעילים [מ, עד]; null — לא זוהה */
  range: [number, number] | null;
  title: string;
  note: string;
}

export interface WaterScale {
  /** כמות הטיפות: 1–3 בקפיצות של חצי; 0 — לא זוהה */
  amount: number;
  title: string;
  note: string;
}

const UNKNOWN_NOTE = 'לפי הנחיות המשתלה';

/** כל הטווחים האפשריים — לבחירה ידנית בעורך */
export const LIGHT_RANGES: Array<[number, number]> = [
  [0, 0],
  [0, 1],
  [0, 2],
  [0, 3],
  [1, 1],
  [1, 2],
  [1, 3],
  [2, 2],
  [2, 3],
  [3, 3],
];

const LIGHT_TITLES: Record<string, string> = {
  '0-0': 'שמש מלאה',
  '0-1': 'שמש עד חצי צל',
  '0-2': 'שמש עד אור מסונן',
  '0-3': 'שמש עד צל',
  '1-1': 'חצי צל',
  '1-2': 'חצי צל, אור בהיר',
  '1-3': 'חצי צל עד צל',
  '2-2': 'אור בהיר מסונן',
  '2-3': 'אור מסונן עד צל',
  '3-3': 'צל',
};

const LIGHT_NOTES: Record<string, string> = {
  '0-0': 'אוהב שמש ישירה לאורך רוב היום.',
  '0-1': 'שמש ישירה, או חצי יום שמש.',
  '0-2': 'גמיש: משמש ישירה ועד אור בהיר ללא שמש.',
  '0-3': 'גמיש מאוד — מתאים כמעט לכל מיקום.',
  '1-1': 'כמה שעות שמש ביום, עדיף שמש בוקר.',
  '1-2': 'שמש חלקית או אור רב ללא שמש ישירה.',
  '1-3': 'מעדיף מקום מוצל חלקית עד מוצל.',
  '2-2': 'מעדיף אור רב ללא שמש ישירה.',
  '2-3': 'מתאים לאור עקיף ולפינות מוצלות.',
  '3-3': 'מתאים למקומות מוצלים.',
};

export const lightKey = (r: [number, number]) => `${r[0]}-${r[1]}`;
export const lightTitle = (r: [number, number]) => LIGHT_TITLES[lightKey(r)] ?? LIGHT_STEPS[r[0]];

const has = (v: string, words: string[]) => words.some((w) => v.includes(w));

/** הטווח מתוך ניסוח חופשי ("קרינת שמש ישירה או הצללה חלקית" → [0, 1]). */
export function lightRange(text: string | null | undefined): [number, number] | null {
  const v = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!v) return null;
  const steps = new Set<number>();
  const noDirect = has(v, ['ללא קרינת', 'ללא שמש', 'בלי שמש']);
  if (noDirect) steps.add(2);
  if (!noDirect && has(v, ['שמש מלאה', 'שמש ישירה', 'אור מלא', 'קרינת שמש'])) steps.add(0);
  if (has(v, ['חצי יום', 'שמש חלקית', 'הצללה חלקית', 'צל חלקי', 'הצללה קלה', 'הצללה עם', 'חצי צל'])) steps.add(1);
  if (has(v, ['אור עקיף', 'מקום מואר', 'אור בהיר', 'מסונן', 'אור מלא בבית'])) steps.add(2);
  if (has(v, ['צל מלא', 'הצללה מלאה', 'חלקית-מלאה', 'חלקית עד מלאה', 'צל עמוק'])) steps.add(3);
  if (/^צל$/.test(v)) steps.add(3);
  if (!steps.size) return null;
  const list = [...steps];
  return [Math.min(...list), Math.max(...list)];
}

export function lightScale(
  text: string | null | undefined,
  override?: { range?: [number, number] | null; note?: string | null } | null,
): LightScale {
  const range = override?.range !== undefined ? override.range : lightRange(text);
  if (!range) return { range: null, title: 'אור', note: override?.note?.trim() || (text ?? '').trim().slice(0, 80) || UNKNOWN_NOTE };
  const title = lightTitle(range);
  const original = (text ?? '').trim();
  // ניסוח הקטלוג מחליף את ההסבר רק כשהוא מוסיף הסתייגות (אזור, עונה, בבית) — לא כשהוא חוזר על הכותרת
  const qualified = has(original, ['באזור', 'בבית', 'בקיץ', 'בחורף', 'באביב', 'קריר', 'חמים', 'לכל היותר', 'במקומות', 'בחוץ', 'בצעירות']);
  const note = override?.note?.trim() || (qualified && original.length <= 80 ? original : LIGHT_NOTES[lightKey(range)]!);
  return { range, title, note };
}

const WATER_TITLES: Record<string, string> = {
  '1': 'השקיה מועטה',
  '1.5': 'השקיה מועטה-בינונית',
  '2': 'השקיה בינונית',
  '2.5': 'השקיה בינונית-מרובה',
  '3': 'השקיה מרובה',
};

const WATER_NOTES: Record<string, string> = {
  '1': 'חסכוני במים. להשקות רק כשהאדמה יבשה.',
  '1.5': 'להשקות כשהאדמה מתייבשת לעומק של כמה ס"מ.',
  '2': 'להשקות כשהשכבה העליונה של האדמה מתייבשת.',
  '2.5': 'לשמור על אדמה לחה מעט, ולהגביר השקיה בקיץ.',
  '3': 'אוהב אדמה לחה באופן קבוע.',
};

/** כל הכמויות האפשריות — לבחירה ידנית בעורך */
export const WATER_AMOUNTS = [1, 1.5, 2, 2.5, 3] as const;
export const waterTitle = (amount: number) => WATER_TITLES[String(amount)] ?? 'השקיה';

/** כמות הטיפות מתוך ניסוח חופשי ("מועטה-בינונית" → 1.5). מה שאחרי "אך" — הסתייגות, לא נספר. */
export function waterAmount(text: string | null | undefined): number {
  const v = (text ?? '').split(/\sאך\s|,\sאך\s/)[0]!.trim();
  if (!v) return 0;
  const found: number[] = [];
  if (has(v, ['מועטה', 'נמוכה', 'חסכוני', 'ללא השקיה'])) found.push(1);
  if (v.includes('בינונית')) found.push(2);
  if (has(v, ['מרובה', 'גבוהה'])) found.push(3);
  if (!found.length) return 0;
  return (Math.min(...found) + Math.max(...found)) / 2;
}

export function waterScale(
  text: string | null | undefined,
  override?: { amount?: number | null; note?: string | null } | null,
): WaterScale {
  const amount = override?.amount != null ? override.amount : waterAmount(text);
  if (!amount) return { amount: 0, title: 'השקיה', note: override?.note?.trim() || (text ?? '').trim().slice(0, 80) || UNKNOWN_NOTE };
  const original = (text ?? '').trim();
  const title = waterTitle(amount);
  const generic = /^(מועטה|נמוכה|בינונית|מרובה|גבוהה|מועטה-בינונית|בינונית-מועטה|בינונית-מרובה|מועטה, חסכוני במים)$/.test(original);
  const note = override?.note?.trim() || (original && !generic && original.length <= 80 ? original : WATER_NOTES[String(amount)]!);
  return { amount, title, note };
}
