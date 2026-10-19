/**
 * סנכרון מהקטלוג המרכזי (§6, R02-02) — לוגיקה טהורה.
 *
 * מוצר מקושר נעוץ לגרסה של הפריט המרכזי (catalog_revisions). התצוגה בחנות = נתוני הגרסה
 * הנעוצה + שדות שנשמרו מקומית (catalog_overrides). גרסה חדשה = "עדכון ממתין" — בעל המשתלה
 * מאשר או דוחה לכל שדה. שדה שנדחה נשמר מקומית ואינו מוצע עוד (החלטת בעלים Q1-א) עד שמוחזר.
 */

export type CatalogKind = 'plant' | 'supply';

export const PLANT_SYNC_FIELDS = {
  hebrewName: 'שם עברי',
  latinName: 'שם לטיני',
  nickname: 'כינוי',
  family: 'משפחה',
  description: 'תיאור',
  notes: 'הערות',
  origin: 'מוצא',
  native: 'צמח בר / מקומי',
  plantType: 'סוג צמח',
  light: 'אור',
  water: 'השקיה',
  flowering: 'פריחה',
  floweringSeason: 'עונת פריחה',
  flowerColor: 'צבע פריחה',
  foliage: 'עלווה',
  evergreen: 'ירוק עד',
  height: 'גובה',
  spacing: 'מרווח שתילה',
  growthRate: 'קצב גדילה',
  climateZones: 'אזורי אקלים',
  resistance: 'עמידות',
  coastal: 'עמידות לחוף',
  care: 'טיפול',
  uniqueness: 'ייחודיות',
  imageUrl: 'תמונה',
} as const;

export const SUPPLY_SYNC_FIELDS = {
  title: 'שם',
  brand: 'מותג',
  category: 'קטגוריה',
  description: 'תיאור',
  imageUrl: 'תמונה',
} as const;

export function syncFields(kind: CatalogKind): Record<string, string> {
  return kind === 'plant' ? PLANT_SYNC_FIELDS : SUPPLY_SYNC_FIELDS;
}

export type ContentData = Record<string, unknown>;
export type Overrides = Record<string, unknown>;

export function asObject(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

/**
 * התוכן המקומי של פריט: הגרסה הנעוצה + שדות מקומיים, רק על שדות התוכן הידועים.
 * בלי גרסה (מוצר ישן/מותאם) — הנתונים החיים נשארים כפי שהם.
 */
export function localizeItem<T extends Record<string, unknown>>(
  live: T,
  kind: CatalogKind,
  revisionData: unknown,
  overrides: unknown,
): T {
  const rev = asObject(revisionData);
  if (Object.keys(rev).length === 0) return live;
  const ov = asObject(overrides);
  const out: Record<string, unknown> = { ...live };
  for (const field of Object.keys(syncFields(kind))) {
    if (field in ov) out[field] = ov[field];
    else if (field in rev) out[field] = rev[field];
  }
  return out as T;
}

export interface FieldDiff {
  field: string;
  label: string;
  from: unknown;
  to: unknown;
}

const norm = (v: unknown) => (v === undefined || v === '' ? null : v);

/** שינויים בין הגרסה הנעוצה לחדשה — בלי שדות שנשמרו מקומית (אינם מוצעים לסנכרון). */
export function diffRevisions(kind: CatalogKind, from: unknown, to: unknown, overrides: unknown): FieldDiff[] {
  const a = asObject(from);
  const b = asObject(to);
  const ov = asObject(overrides);
  const fields = syncFields(kind);
  const out: FieldDiff[] = [];
  for (const [field, label] of Object.entries(fields)) {
    if (field in ov) continue;
    if (JSON.stringify(norm(a[field])) !== JSON.stringify(norm(b[field]))) {
      out.push({ field, label, from: norm(a[field]), to: norm(b[field]) });
    }
  }
  return out;
}

export interface SyncPlan {
  overrides: Overrides;
  accepted: string[];
  rejected: string[];
}

/**
 * החלת החלטה: מעבר לגרסה החדשה; שדה שנדחה נשמר מקומית עם הערך שהוצג עד כה (מהגרסה הנעוצה).
 * שדות שלא שונו או שכבר מקומיים — לא נוגעים.
 */
export function planSync(
  kind: CatalogKind,
  pinned: unknown,
  latest: unknown,
  overrides: unknown,
  rejectFields: string[],
): SyncPlan {
  const diffs = diffRevisions(kind, pinned, latest, overrides);
  const changed = new Set(diffs.map((d) => d.field));
  const reject = new Set(rejectFields.filter((f) => changed.has(f)));
  const ov: Overrides = { ...asObject(overrides) };
  const pin = asObject(pinned);
  for (const f of reject) ov[f] = pin[f] ?? null;
  return {
    overrides: ov,
    accepted: diffs.map((d) => d.field).filter((f) => !reject.has(f)),
    rejected: [...reject],
  };
}

/** החזרת שדה לסנכרון: הסרתו מהשדות המקומיים. */
export function restoreField(overrides: unknown, field: string): Overrides {
  const ov: Overrides = { ...asObject(overrides) };
  delete ov[field];
  return ov;
}

/** תצוגה טקסטואלית קצרה של ערך שדה (להשוואה במסך). */
export function displayValue(field: string, v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  const s = String(v);
  if (field === 'imageUrl') return s;
  return s.length > 300 ? `${s.slice(0, 300)}…` : s;
}
