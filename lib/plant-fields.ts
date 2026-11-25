import { PLANT_SYNC_FIELDS } from '@/lib/catalog-sync';
import { CHOICE_FIELDS, isChoiceField, readSeasons } from '@/lib/plant-options';

/**
 * השדות הבוטניים שבעל משתלה יכול למלא (צמח פרטי) או לשנות מקומית (צמח מהקטלוג).
 * ללא תלות בשרת — משותף לטפסים ולפעולות השרת.
 * תיאור ותמונה אינם כאן: למוצר יש תיאור ותמונה משלו (customDescription / customImageUrl).
 */
export type PlantField = Exclude<keyof typeof PLANT_SYNC_FIELDS, 'description' | 'imageUrl'>;

export interface PlantFieldDef {
  field: PlantField;
  label: string;
  long?: boolean;
  /** מזין מסנן בחנות — מוצגות הצעות מערכי הקטלוג */
  suggest?: boolean;
  placeholder?: string;
}

const def = (field: PlantField, extra: Omit<PlantFieldDef, 'field' | 'label'> = {}): PlantFieldDef => ({
  field,
  label: PLANT_SYNC_FIELDS[field],
  ...extra,
});

/** השדות העיקריים — מוצגים תמיד */
export const PLANT_MAIN_FIELDS: PlantFieldDef[] = [
  def('hebrewName'),
  def('latinName', { placeholder: 'Lavandula angustifolia' }),
  def('nickname'),
  def('plantType', { suggest: true }),
  // אור, השקיה ועונת פריחה — אפשרויות מוגדרות מראש (lib/plant-options.ts), לא טקסט חופשי
  def('light', { suggest: true }),
  def('water', { suggest: true }),
  def('flowering'),
  def('floweringSeason', { suggest: true }),
  def('flowerColor', { suggest: true }),
  def('height', { placeholder: "0.5-1 מ'" }),
  def('spacing'),
  def('growthRate', { suggest: true }),
  def('evergreen', { suggest: true }),
  def('coastal', { suggest: true }),
  def('native', { suggest: true }),
  def('care', { long: true }),
];

/** פרטים נוספים — בתוך "עוד פרטים" */
export const PLANT_MORE_FIELDS: PlantFieldDef[] = [
  def('family'),
  def('origin'),
  def('foliage'),
  def('climateZones'),
  def('resistance'),
  def('uniqueness', { long: true }),
  def('notes', { long: true }),
];

export const PLANT_EDIT_FIELDS: PlantFieldDef[] = [...PLANT_MAIN_FIELDS, ...PLANT_MORE_FIELDS];
export const PLANT_SUGGEST_FIELDS = PLANT_EDIT_FIELDS.filter((f) => f.suggest).map((f) => f.field);

/** שם השדה בטופס (קידומת — כדי לא להתנגש בשדות המוצר) */
export const plantInputName = (field: PlantField) => `plant_${field}`;

export type PlantFieldValues = Partial<Record<PlantField, string | null>>;

export interface FormLike {
  has(k: string): boolean;
  get(k: string): unknown;
  getAll(k: string): unknown[];
}

/** קריאת השדות מהטופס: רק שדות שנשלחו; ריק = null. עונת פריחה — מתיבות הסימון. */
export function parsePlantFields(form: FormLike): PlantFieldValues {
  const out: PlantFieldValues = {};
  for (const f of PLANT_EDIT_FIELDS) {
    const name = plantInputName(f.field);
    if (!form.has(name)) continue;
    if (isChoiceField(f.field) && CHOICE_FIELDS[f.field].kind === 'seasons') {
      out[f.field] = readSeasons(form, name);
      continue;
    }
    const v = String(form.get(name) ?? '').trim();
    out[f.field] = v ? v.slice(0, f.long ? 4000 : f.field === 'hebrewName' || f.field === 'latinName' ? 120 : 300) : null;
  }
  return out;
}

/** השוואת ערכים לצורך "שונה מקומית" (ריק = null, בלי רווחים בקצוות). */
export function sameValue(a: unknown, b: unknown): boolean {
  const n = (v: unknown) => (v == null ? '' : String(v).trim());
  return n(a) === n(b);
}
