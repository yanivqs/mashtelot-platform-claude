/**
 * מאפייני סינון ("facets") של צמחים לחנות.
 *
 * ערכי המאגר הבוטני הם טקסט חופשי עם וריאציות רבות (למשל 26 ניסוחים שונים לתאורה),
 * ולכן רוב המאפיינים ממופים לקבוצות קנוניות לפי מילות מפתח. צמח יכול להשתייך ליותר
 * מקבוצה אחת ("קרינת שמש ישירה או הצללה חלקית" = שמש + חצי צל).
 * ללא תלות בשרת — טהור וניתן לבדיקה.
 */

export interface PlantFacetFields {
  plantType: string | null;
  light: string | null;
  water: string | null;
  floweringSeason: string | null;
  flowerColor: string | null;
  growthRate: string | null;
  evergreen: string | null;
  coastal: string | null;
  native: string | null;
}

export interface FacetBucket {
  key: string;
  label: string;
  keywords: string[];
}

export interface FacetDef {
  /** שם הפרמטר ב-URL */
  key: string;
  label: string;
  field: keyof PlantFacetFields;
  /** exact = כל ערך מובחן הוא אפשרות (לשדות עם מעט ערכים נקיים) */
  mode: 'exact' | 'buckets';
  buckets?: FacetBucket[];
}

export const PLANT_FACETS: FacetDef[] = [
  { key: 'type', label: 'סוג צמח', field: 'plantType', mode: 'exact' },
  {
    key: 'light',
    label: 'תאורה',
    field: 'light',
    mode: 'buckets',
    buckets: [
      { key: 'sun', label: 'שמש מלאה', keywords: ['שמש מלאה', 'שמש ישירה', 'אור מלא'] },
      {
        key: 'partial',
        label: 'הצללה חלקית',
        keywords: ['חלקית', 'חצי יום', 'צל חלקי', 'שמש חלקית', 'הצללה קלה', 'הצללה עם'],
      },
      {
        key: 'shade',
        label: 'צל',
        keywords: ['צל מלא', 'הצללה מלאה', 'חלקית-מלאה', 'אור עקיף', 'ללא קרינת', 'צל עמוק'],
      },
    ],
  },
  {
    key: 'water',
    label: 'השקיה',
    field: 'water',
    mode: 'buckets',
    buckets: [
      { key: 'low', label: 'מועטה / חסכוני במים', keywords: ['מועטה', 'נמוכה', 'חסכוני', 'ללא השקיה'] },
      { key: 'medium', label: 'בינונית', keywords: ['בינונית'] },
      { key: 'high', label: 'מרובה', keywords: ['מרובה', 'גבוהה'] },
    ],
  },
  {
    key: 'season',
    label: 'עונת פריחה',
    field: 'floweringSeason',
    mode: 'buckets',
    buckets: [
      { key: 'spring', label: 'אביב', keywords: ['אביב', 'רוב השנה', 'כל השנה'] },
      { key: 'summer', label: 'קיץ', keywords: ['קיץ', 'רוב השנה', 'כל השנה'] },
      { key: 'autumn', label: 'סתיו', keywords: ['סתיו', 'רוב השנה', 'כל השנה'] },
      { key: 'winter', label: 'חורף', keywords: ['חורף', 'רוב השנה', 'כל השנה'] },
    ],
  },
  {
    key: 'color',
    label: 'צבע פריחה',
    field: 'flowerColor',
    mode: 'buckets',
    buckets: [
      { key: 'white', label: 'לבן', keywords: ['לבן'] },
      { key: 'yellow', label: 'צהוב', keywords: ['צהוב'] },
      { key: 'orange', label: 'כתום', keywords: ['כתום'] },
      { key: 'red', label: 'אדום', keywords: ['אדום'] },
      { key: 'pink', label: 'ורוד', keywords: ['ורוד'] },
      { key: 'purple', label: 'סגול', keywords: ['סגול', 'ארגמן', 'לילך'] },
      { key: 'blue', label: 'כחול', keywords: ['כחול', 'תכלת'] },
      { key: 'multi', label: 'שלל צבעים', keywords: ['שלל צבעים', 'מגוון צבעים', 'צבעים שונים'] },
    ],
  },
  {
    key: 'growth',
    label: 'קצב גדילה',
    field: 'growthRate',
    mode: 'buckets',
    buckets: [
      { key: 'slow', label: 'איטי', keywords: ['איטי'] },
      { key: 'medium', label: 'בינוני', keywords: ['בינוני'] },
      { key: 'fast', label: 'מהיר', keywords: ['מהיר', 'נמרץ'] },
    ],
  },
  {
    key: 'foliage',
    label: 'עלווה',
    field: 'evergreen',
    mode: 'buckets',
    buckets: [
      { key: 'evergreen', label: 'ירוק-עד', keywords: ['ירוק-עד', 'ירוק עד'] },
      { key: 'deciduous', label: 'נשיר', keywords: ['נשיר'] },
      { key: 'seasonal', label: 'עונתי', keywords: ['עונתי'] },
    ],
  },
  {
    key: 'coastal',
    label: 'עמידות לחוף',
    field: 'coastal',
    mode: 'buckets',
    buckets: [{ key: 'yes', label: 'מתאים לגינה בקרבת הים', keywords: ['חוף', 'רסס ים'] }],
  },
  {
    key: 'native',
    label: 'מקור',
    field: 'native',
    mode: 'buckets',
    buckets: [{ key: 'yes', label: 'צמח ארץ-ישראלי', keywords: ['כן'] }],
  },
];

export const FACET_KEYS = PLANT_FACETS.map((f) => f.key);

function clean(v: string | null | undefined): string {
  return (v ?? '').trim();
}

/** האם ערך השדה של הצמח מתאים לאפשרות הנבחרת בפאסט. */
export function plantMatchesFacet(
  plant: PlantFacetFields | null | undefined,
  facet: FacetDef,
  optionKey: string,
): boolean {
  if (!plant) return false;
  const value = clean(plant[facet.field]);
  if (!value) return false;
  if (facet.mode === 'exact') return value === optionKey;
  const bucket = facet.buckets?.find((b) => b.key === optionKey);
  if (!bucket) return false;
  return bucket.keywords.some((k) => value.includes(k));
}

/** מפתחות האפשרויות שהצמח שייך אליהן בפאסט נתון. */
export function plantFacetOptionKeys(
  plant: PlantFacetFields | null | undefined,
  facet: FacetDef,
): string[] {
  if (!plant) return [];
  const value = clean(plant[facet.field]);
  if (!value) return [];
  if (facet.mode === 'exact') return [value];
  return (facet.buckets ?? []).filter((b) => b.keywords.some((k) => value.includes(k))).map((b) => b.key);
}

export interface FacetOption {
  key: string;
  label: string;
  count: number;
}

/**
 * אפשרויות הפאסט עם ספירה, רק אלו שקיימות בפועל ברשימת הצמחים (count > 0).
 * קבוצות מוגדרות נשמרות בסדר ההגדרה; ערכים מדויקים ממוינים לפי א-ב.
 */
export function facetOptions(
  plants: Array<PlantFacetFields | null | undefined>,
  facet: FacetDef,
): FacetOption[] {
  const counts = new Map<string, number>();
  for (const plant of plants) {
    for (const key of plantFacetOptionKeys(plant, facet)) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  if (facet.mode === 'exact') {
    return [...counts]
      .map(([key, count]) => ({ key, label: key, count }))
      .sort((a, b) => a.label.localeCompare(b.label, 'he'));
  }
  return (facet.buckets ?? [])
    .filter((b) => (counts.get(b.key) ?? 0) > 0)
    .map((b) => ({ key: b.key, label: b.label, count: counts.get(b.key)! }));
}
