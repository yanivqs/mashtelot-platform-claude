/** אותיות האלף-בית לסינון רשימות לפי אות ראשונה (ללא תלות בשרת). */

export const HEBREW_LETTERS = [
  'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט', 'י', 'כ',
  'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ', 'ק', 'ר', 'ש', 'ת',
] as const;

/** קבוצת "אחר" — שמות שמתחילים בספרה / אות לועזית. */
export const OTHER_LETTER = '#';

const FINAL_TO_REGULAR: Record<string, string> = { ך: 'כ', ם: 'מ', ן: 'נ', ף: 'פ', ץ: 'צ' };
const HEBREW_SET = new Set<string>(HEBREW_LETTERS);

/** האות הראשונה של שם לצורך סינון (מדלג על גרשיים/רווחים, מנרמל אותיות סופיות). */
export function firstLetter(name: string | null | undefined): string | null {
  if (!name) return null;
  const match = name.match(/[\p{L}\p{N}]/u);
  if (!match) return null;
  const ch = FINAL_TO_REGULAR[match[0]] ?? match[0];
  return HEBREW_SET.has(ch) ? ch : OTHER_LETTER;
}

/** אות תקינה מפרמטר URL (או null). */
export function parseLetter(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const v = raw.trim();
  return HEBREW_SET.has(v) || v === OTHER_LETTER ? v : null;
}
