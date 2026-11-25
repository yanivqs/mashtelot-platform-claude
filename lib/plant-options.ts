/**
 * אפשרויות מוגדרות מראש לשדות הבוטניים שמזינים מסננים בחנות (אור, השקיה, עונת פריחה).
 * במקום טקסט חופשי — בחירה מרשימה (אור, השקיה) וסימון עונות (עונת פריחה), כדי למנוע שגיאות הקלדה.
 * הניסוחים תואמים את מילות המפתח של המסננים ב-lib/plant-facets.ts (נבדק ב-plant-options.test.ts).
 * ללא תלות בשרת — משותף לטפסים ולפעולות השרת.
 */

export const LIGHT_OPTIONS = [
  'שמש מלאה',
  'שמש מלאה עד צל חלקי',
  'צל חלקי',
  'צל חלקי עד צל מלא',
  'צל מלא',
  'אור עקיף (צמח בית)',
] as const;

export const WATER_OPTIONS = ['מועטה', 'מועטה-בינונית', 'בינונית', 'בינונית-מרובה', 'מרובה'] as const;

export const SEASONS = [
  { key: 'spring', label: 'אביב', keywords: ['אביב'] },
  { key: 'summer', label: 'קיץ', keywords: ['קיץ'] },
  { key: 'autumn', label: 'סתיו', keywords: ['סתיו'] },
  { key: 'winter', label: 'חורף', keywords: ['חורף'] },
] as const;

/** ערך שנשמר כשכל ארבע העונות מסומנות */
export const ALL_YEAR = 'כל השנה';
const ALL_YEAR_KEYWORDS = [ALL_YEAR, 'רוב השנה'];
const WARM_SEASONS = 'בעונות החמות';

export type ChoiceField = 'light' | 'water' | 'floweringSeason';

/** אילו שדות הם בחירה: select = אפשרות אחת מרשימה, seasons = סימון עונות */
export const CHOICE_FIELDS: Record<ChoiceField, { kind: 'select'; options: readonly string[] } | { kind: 'seasons' }> = {
  light: { kind: 'select', options: LIGHT_OPTIONS },
  water: { kind: 'select', options: WATER_OPTIONS },
  floweringSeason: { kind: 'seasons' },
};

export function isChoiceField(field: string): field is ChoiceField {
  return field in CHOICE_FIELDS;
}

/** העונות שמופיעות בטקסט (גם ערכים ישנים חופשיים: "באביב ובקיץ", "רוב השנה"). */
export function seasonsFromText(text: string | null | undefined): string[] {
  const v = (text ?? '').trim();
  if (!v) return [];
  if (ALL_YEAR_KEYWORDS.some((k) => v.includes(k))) return SEASONS.map((s) => s.label);
  if (v.includes(WARM_SEASONS)) return ['אביב', 'קיץ', 'סתיו'];
  return SEASONS.filter((s) => s.keywords.some((k) => v.includes(k))).map((s) => s.label);
}

/** רשימת עונות → ערך לשמירה, בסדר קבוע. כל ארבע = "כל השנה". */
export function formatSeasons(labels: string[]): string | null {
  const set = new Set(labels.map((l) => l.trim()));
  const ordered = SEASONS.filter((s) => set.has(s.label)).map((s) => s.label);
  if (ordered.length === 0) return null;
  if (ordered.length === SEASONS.length) return ALL_YEAR;
  return ordered.join(', ');
}

/** שם השדה הנסתר שמחזיק את הערך המקורי (כדי לא לשנות ערך ישן כשהעונות לא שונו). */
export const origInputName = (name: string) => `${name}__orig`;

/**
 * קריאת עונות מטופס: תיבות סימון בשם `name` (+ שדה נסתר ריק באותו שם כדי שהשדה ייחשב "נשלח").
 * אם העונות המסומנות זהות לעונות שבערך המקורי — מוחזר הערך המקורי כמו שהוא (ללא שינוי מיותר).
 */
export function readSeasons(form: { getAll(k: string): unknown[]; get(k: string): unknown }, name: string): string | null {
  const checked = form.getAll(name).map((v) => String(v ?? '').trim()).filter(Boolean);
  const formatted = formatSeasons(checked);
  const orig = form.get(origInputName(name));
  if (orig != null) {
    const o = String(orig).trim();
    if (o && formatSeasons(seasonsFromText(o)) === formatted) return o;
  }
  return formatted;
}
