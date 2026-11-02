/**
 * מנוע תבניות דפוס (נספח א, PT-02/03/07) — לוגיקה טהורה, משותפת לשרת ולטופס בדפדפן.
 *
 * - הגדרת שדות (סכמה) ותמחור נשמרות בגרסת תבנית; גרסה שפורסמה אינה משתנה (trigger ב-DB).
 * - ולידציה וחישוב מחיר רצים בשרת מול הגרסה השמורה — הדפדפן רק מציג; שדה מוסתר נזרק,
 *   ולא מקבלים מחיר מהלקוח (א.4, א.9).
 */
import { parsePriceTiers, unitPriceFor, type PriceTier } from '@/lib/print-pricing';
import { parseSizeCm } from '@/lib/print-preflight';

export const FIELD_TYPES = ['text', 'textarea', 'number', 'select', 'multiselect', 'boolean'] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: 'טקסט קצר',
  textarea: 'טקסט ארוך',
  number: 'מספר',
  select: 'בחירה יחידה',
  multiselect: 'בחירה מרובה',
  boolean: 'כן / לא',
};

export interface FieldOption {
  value: string;
  label: string;
  /** תוספת מחיר ליחידה (₪), יכולה להיות שלילית */
  priceDelta: number;
  /** תוספת קבועה לסך ההזמנה (₪) */
  fixedAdd?: number;
  /** תוספת באחוזים על כל המחיר, כולל הקמה ותוספות */
  percentAdd?: number;
  /** בחירה באפשרות מעבירה לבדיקת צוות */
  requiresQuote?: boolean;
  help?: string;
}

/** ערך "התאמה אישית" בשדה בחירה; הטקסט נשמר ב-`{key}__custom` */
export const CUSTOM_VALUE = '__custom';
export const customKey = (key: string) => `${key}__custom`;
/** מפתח שמור: הערך של שדה זה קובע את מידות המוצר לבדיקת הקובץ */
export const SIZE_KEY = 'size';

export interface ShowIf {
  field: string;
  /** ערך שמפעיל את השדה: ערך אפשרות (בחירה), או 'true'/'false' (כן/לא) */
  equals: string;
}

export interface TemplateField {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  help?: string;
  maxLength?: number;
  min?: number;
  max?: number;
  options?: FieldOption[];
  /** בשדה בחירה: מוסיף אפשרות "התאמה אישית" עם תיבת טקסט (מעביר לבדיקת צוות) */
  allowCustom?: boolean;
  showIf?: ShowIf;
}

export interface TemplatePricing {
  /** מחיר בסיס ליחידה */
  basePrice: number;
  tiers: PriceTier[];
  /** עלות הקמה חד-פעמית להזמנה */
  setupFee: number;
  minQuantity: number;
  /** אין תמחור דטרמיניסטי — ההזמנה היא בקשת הצעת מחיר (א.9) */
  quoteOnly: boolean;
  /** כמויות מוגדרות מראש (כפתורים). כמות אחרת עוברת לבדיקת צוות */
  quantityOptions: number[];
  allowCustomQuantity: boolean;
}

const KEY_RE = /^[a-z][a-z0-9_]{0,39}$/;
const MAX_FIELDS = 40;
const MAX_CUSTOM = 200;
const DEFAULT_MAX = { text: 120, textarea: 2000 } as const;

type Result<T> = { ok: true; value: T } | { ok: false; errors: string[] };

const num = (v: unknown): number | undefined => {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
};

// ---------- הגדרת תבנית (בידי הסופר-אדמין) ----------

/** בדיקה ונרמול של הגדרת שדות. מפתחות יציבים וייחודיים; תנאי מפנה רק לשדה קודם מסוג בחירה/כן-לא. */
export function parseFields(json: unknown): Result<TemplateField[]> {
  if (!Array.isArray(json)) return { ok: false, errors: ['הגדרת השדות אינה רשימה'] };
  if (json.length > MAX_FIELDS) return { ok: false, errors: [`עד ${MAX_FIELDS} שדות בתבנית`] };
  const errors: string[] = [];
  const out: TemplateField[] = [];
  const seen = new Map<string, TemplateField>();

  json.forEach((raw, i) => {
    const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const at = `שדה ${i + 1}`;
    const key = String(r.key ?? '').trim();
    const label = String(r.label ?? '').trim();
    const type = String(r.type ?? '') as FieldType;
    if (!KEY_RE.test(key)) errors.push(`${at}: מפתח חייב להתחיל באות אנגלית קטנה ולהכיל רק a-z, 0-9, _`);
    else if (seen.has(key)) errors.push(`${at}: המפתח "${key}" כבר קיים`);
    if (!label || label.length > 80) errors.push(`${at}: יש לתת תווית (עד 80 תווים)`);
    if (!FIELD_TYPES.includes(type)) errors.push(`${at}: סוג שדה לא מוכר`);

    const field: TemplateField = { key, label, type, required: r.required === true };
    const help = String(r.help ?? '').trim();
    if (help) field.help = help.slice(0, 200);

    if (type === 'text' || type === 'textarea') {
      const maxLength = num(r.maxLength);
      if (maxLength !== undefined) {
        if (!Number.isInteger(maxLength) || maxLength < 1 || maxLength > DEFAULT_MAX[type]) {
          errors.push(`${at}: אורך מקסימלי בין 1 ל-${DEFAULT_MAX[type]}`);
        } else field.maxLength = maxLength;
      }
    }
    if (type === 'number') {
      const min = num(r.min);
      const max = num(r.max);
      if (Number.isNaN(min) || Number.isNaN(max)) errors.push(`${at}: מינימום/מקסימום לא תקינים`);
      if (min !== undefined && !Number.isNaN(min)) field.min = min;
      if (max !== undefined && !Number.isNaN(max)) field.max = max;
      if (field.min !== undefined && field.max !== undefined && field.min > field.max) errors.push(`${at}: מינימום גדול ממקסימום`);
    }
    if (type === 'select' || type === 'multiselect') {
      const opts = Array.isArray(r.options) ? r.options : [];
      const values = new Set<string>();
      const options: FieldOption[] = [];
      for (const o of opts) {
        const oo = (o && typeof o === 'object' ? o : {}) as Record<string, unknown>;
        const value = String(oo.value ?? '').trim();
        const olabel = String(oo.label ?? value).trim();
        const delta = num(oo.priceDelta) ?? 0;
        if (!value || value.length > 60) {
          errors.push(`${at}: ערך אפשרות חסר או ארוך מדי`);
          continue;
        }
        if (values.has(value)) errors.push(`${at}: האפשרות "${value}" מופיעה פעמיים`);
        if (Number.isNaN(delta)) errors.push(`${at}: תוספת מחיר לא תקינה באפשרות "${value}"`);
        values.add(value);
        const fixedAdd = num(oo.fixedAdd) ?? 0;
        const percentAdd = num(oo.percentAdd) ?? 0;
        if (Number.isNaN(fixedAdd)) errors.push(`${at}: תוספת קבועה לא תקינה באפשרות "${value}"`);
        if (Number.isNaN(percentAdd) || percentAdd <= -100) errors.push(`${at}: תוספת אחוזים לא תקינה באפשרות "${value}"`);
        const option: FieldOption = { value, label: olabel || value, priceDelta: Number.isNaN(delta) ? 0 : delta };
        if (fixedAdd && !Number.isNaN(fixedAdd)) option.fixedAdd = fixedAdd;
        if (percentAdd && !Number.isNaN(percentAdd)) option.percentAdd = percentAdd;
        if (oo.requiresQuote === true) option.requiresQuote = true;
        const ohelp = String(oo.help ?? '').trim();
        if (ohelp) option.help = ohelp.slice(0, 200);
        options.push(option);
      }
      if (options.length === 0 && r.allowCustom !== true) errors.push(`${at}: לשדה בחירה צריך לפחות אפשרות אחת`);
      field.options = options;
      if (r.allowCustom === true) field.allowCustom = true;
    }

    const showIf = r.showIf as Record<string, unknown> | undefined;
    if (showIf && String(showIf.field ?? '')) {
      const ref = seen.get(String(showIf.field));
      const equals = String(showIf.equals ?? '');
      if (!ref) errors.push(`${at}: תנאי התצוגה מפנה לשדה שאינו קיים לפניו`);
      else if (ref.type === 'boolean' && !['true', 'false'].includes(equals)) errors.push(`${at}: תנאי על כן/לא חייב להיות true או false`);
      else if ((ref.type === 'select' || ref.type === 'multiselect') && !ref.options?.some((o) => o.value === equals)) {
        errors.push(`${at}: תנאי התצוגה מפנה לאפשרות שאינה קיימת`);
      } else if (!['boolean', 'select', 'multiselect'].includes(ref.type)) {
        errors.push(`${at}: אפשר להתנות רק בשדה בחירה או כן/לא`);
      } else field.showIf = { field: ref.key, equals };
    }

    if (KEY_RE.test(key) && !seen.has(key)) seen.set(key, field);
    out.push(field);
  });

  return errors.length ? { ok: false, errors } : { ok: true, value: out };
}

/** draft: טיוטה נשמרת גם לפני שהוגדר מחיר. בפרסום הבדיקה מלאה. */
export function parsePricing(json: unknown, opts: { draft?: boolean } = {}): Result<TemplatePricing> {
  const r = (json && typeof json === 'object' ? json : {}) as Record<string, unknown>;
  const errors: string[] = [];
  const basePrice = num(r.basePrice) ?? 0;
  const setupFee = num(r.setupFee) ?? 0;
  const minQuantity = num(r.minQuantity) ?? 1;
  const quoteOnly = r.quoteOnly === true;
  if (Number.isNaN(basePrice) || basePrice < 0) errors.push('מחיר בסיס לא תקין');
  const tiers = parsePriceTiers(r.tiers);
  // בלי מחיר בסיס — כמות שלא מגיעה לאף מדרגה עוברת לבדיקת צוות ("אין מחירון לכמות זו")
  if (!opts.draft && !quoteOnly && basePrice <= 0 && tiers.length === 0) errors.push('יש להגדיר מחיר בסיס או מדרגות מחיר (או לסמן "הצעת מחיר בלבד")');
  if (Number.isNaN(setupFee) || setupFee < 0) errors.push('עלות הקמה לא תקינה');
  if (!Number.isInteger(minQuantity) || minQuantity < 1) errors.push('כמות מינימום חייבת להיות מספר שלם 1 ומעלה');
  const quantityOptions = Array.isArray(r.quantityOptions) ? [...new Set(r.quantityOptions.map(Number))] : [];
  if (quantityOptions.some((q) => !Number.isInteger(q) || q < 1)) errors.push('כמויות מוגדרות חייבות להיות מספרים שלמים 1 ומעלה');
  if (quantityOptions.some((q) => q < minQuantity)) errors.push('כמות מוגדרת קטנה מכמות המינימום');
  const allowCustomQuantity = r.allowCustomQuantity !== false;
  if (!allowCustomQuantity && quantityOptions.length === 0) errors.push('בלי כמות חופשית צריך להגדיר לפחות כמות אחת');
  if (errors.length) return { ok: false, errors };
  quantityOptions.sort((a, b) => a - b);
  return { ok: true, value: { basePrice, tiers, setupFee, minQuantity, quoteOnly, quantityOptions, allowCustomQuantity } };
}

// ---------- מילוי והזמנה (בידי בעל המשתלה; נבדק מחדש בשרת) ----------

export type RawValues = Record<string, unknown>;
export type FieldValue = string | number | boolean | string[];
export type CleanValues = Record<string, FieldValue>;

const cleanCustom = (v: unknown) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_CUSTOM);

/** האם השדה מוצג בהינתן הערכים (כולל שרשרת תנאים). */
export function isVisible(field: TemplateField, fields: TemplateField[], values: RawValues, depth = 0): boolean {
  if (!field.showIf) return true;
  if (depth > MAX_FIELDS) return false;
  const ref = fields.find((f) => f.key === field.showIf!.field);
  if (!ref || !isVisible(ref, fields, values, depth + 1)) return false;
  const v = values[ref.key];
  if (ref.type === 'boolean') return String(v === true || v === 'true' || v === 'on') === field.showIf.equals;
  if (ref.type === 'multiselect') return Array.isArray(v) && v.map(String).includes(field.showIf.equals);
  return String(v ?? '') === field.showIf.equals;
}

/** ולידציה ונרמול ערכים. שדות מוסתרים וערכים לא מוכרים נזרקים. */
export function validateValues(fields: TemplateField[], raw: RawValues): { ok: true; values: CleanValues } | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const values: CleanValues = {};
  for (const f of fields) {
    if (!isVisible(f, fields, raw)) continue;
    const v = raw[f.key];
    switch (f.type) {
      case 'text':
      case 'textarea': {
        const s = String(v ?? '').replace(/\r\n/g, '\n').trim();
        const max = f.maxLength ?? DEFAULT_MAX[f.type];
        if (f.required && !s) errors[f.key] = 'שדה חובה';
        else if (s.length > max) errors[f.key] = `עד ${max} תווים`;
        else if (f.type === 'text' && /\n/.test(s)) errors[f.key] = 'שורה אחת בלבד';
        else if (s) values[f.key] = s;
        break;
      }
      case 'number': {
        const s = String(v ?? '').trim();
        if (!s) {
          if (f.required) errors[f.key] = 'שדה חובה';
          break;
        }
        const n = Number(s);
        if (!Number.isFinite(n)) errors[f.key] = 'מספר לא תקין';
        else if (f.min !== undefined && n < f.min) errors[f.key] = `מינימום ${f.min}`;
        else if (f.max !== undefined && n > f.max) errors[f.key] = `מקסימום ${f.max}`;
        else values[f.key] = n;
        break;
      }
      case 'select': {
        const s = String(v ?? '');
        if (!s) {
          if (f.required) errors[f.key] = 'יש לבחור';
        } else if (s === CUSTOM_VALUE && f.allowCustom) {
          const text = cleanCustom(raw[customKey(f.key)]);
          if (!text) errors[f.key] = 'יש לפרט את ההתאמה האישית';
          else {
            values[f.key] = s;
            values[customKey(f.key)] = text;
          }
        } else if (!f.options?.some((o) => o.value === s)) errors[f.key] = 'בחירה לא תקינה';
        else values[f.key] = s;
        break;
      }
      case 'multiselect': {
        const arr = (Array.isArray(v) ? v : v === undefined || v === null || v === '' ? [] : [v]).map(String);
        const uniq = [...new Set(arr)];
        const hasCustom = Boolean(f.allowCustom) && uniq.includes(CUSTOM_VALUE);
        const text = hasCustom ? cleanCustom(raw[customKey(f.key)]) : '';
        if (uniq.some((s) => !(s === CUSTOM_VALUE && f.allowCustom) && !f.options?.some((o) => o.value === s))) errors[f.key] = 'בחירה לא תקינה';
        else if (f.required && uniq.length === 0) errors[f.key] = 'יש לבחור לפחות אפשרות אחת';
        else if (hasCustom && !text) errors[f.key] = 'יש לפרט את ההתאמה האישית';
        else if (uniq.length) {
          values[f.key] = uniq;
          if (hasCustom) values[customKey(f.key)] = text;
        }
        break;
      }
      case 'boolean': {
        const b = v === true || v === 'true' || v === 'on';
        if (f.required && !b) errors[f.key] = 'יש לאשר';
        else values[f.key] = b;
        break;
      }
    }
  }
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, values };
}

export interface PriceLine {
  label: string;
  /** ליחידה */
  amount: number;
}

export interface PrintQuote {
  /** אין מחיר מיידי: בקשת הצעת מחיר / בדיקת צוות */
  quoteOnly: boolean;
  /** הסיבות למעבר לבדיקת צוות (ריק במחיר מיידי) */
  reasons: string[];
  quantity: number;
  /** מדרגה + תוספות ליחידה, לפני הקמה ואחוזים */
  unitPrice: number;
  /** הסכום הכולל חלקי הכמות */
  perUnit: number;
  setupFee: number;
  /** סכום התוספות הקבועות שנבחרו */
  fixedAdds: number;
  /** סכום תוספות האחוזים שנבחרו */
  percent: number;
  total: number;
  breakdown: PriceLine[];
}

/** מצב הקובץ לעניין התמחור: סימון "צריך עיצוב", או קובץ ברזולוציה נמוכה */
export interface QuoteContext {
  needsDesign?: boolean;
  lowResolution?: boolean;
}

const round4 = (n: number) => Math.round(n * 10000) / 10000;

function chosenOptions(fields: TemplateField[], values: CleanValues): Array<{ field: TemplateField; option: FieldOption }> {
  const out: Array<{ field: TemplateField; option: FieldOption }> = [];
  for (const f of fields) {
    const v = values[f.key];
    if (v === undefined || !f.options) continue;
    const chosen = f.type === 'multiselect' && Array.isArray(v) ? v : f.type === 'select' ? [String(v)] : [];
    for (const c of chosen) {
      const option = f.options.find((x) => x.value === c);
      if (option) out.push({ field: f, option });
    }
  }
  return out;
}

/** הסיבות שמעבירות בקשה לבדיקת צוות, לפי הסדר באפיון (5.4). כל הסיבות נשמרות. */
export function reviewReasons(pricing: TemplatePricing, fields: TemplateField[], values: CleanValues, quantity: number, ctx: QuoteContext = {}): string[] {
  const reasons: string[] = [];
  if (pricing.quoteOnly) reasons.push('המוצר דורש בדיקת צוות');
  if (pricing.quantityOptions.length > 0 && !pricing.quantityOptions.includes(quantity)) reasons.push('כמות מותאמת אישית');
  if (!pricing.quoteOnly && unitPriceFor(pricing.basePrice, pricing.tiers, quantity) <= 0) reasons.push('אין מחירון לכמות זו');
  for (const f of fields) {
    const v = values[f.key];
    if (v === CUSTOM_VALUE || (Array.isArray(v) && v.includes(CUSTOM_VALUE))) reasons.push(`${f.label}: ערך מותאם אישית`);
  }
  for (const { field, option } of chosenOptions(fields, values)) {
    if (option.requiresQuote) reasons.push(`${field.label}: ${option.label}`);
  }
  if (ctx.needsDesign) reasons.push('נדרש עיצוב');
  else if (ctx.lowResolution) reasons.push('רזולוציית הקובץ נמוכה מ-300 DPI');
  return reasons;
}

/**
 * חישוב מחיר בשרת (5.2): total = round((הקמה + קבועות + (מדרגה + תוספות ליחידה) × כמות) × (1 + אחוזים/100)).
 * מעוגל לשקל שלם. סיבה כלשהי לבדיקת צוות — אין מחיר.
 */
export function quotePrint(
  pricing: TemplatePricing,
  fields: TemplateField[],
  values: CleanValues,
  quantity: number,
  ctx: QuoteContext = {},
): { ok: true; quote: PrintQuote } | { ok: false; error: string } {
  if (!Number.isInteger(quantity) || quantity < 1) return { ok: false, error: 'כמות לא תקינה' };
  if (quantity < pricing.minQuantity) return { ok: false, error: `כמות מינימלית: ${pricing.minQuantity}` };
  if (!pricing.allowCustomQuantity && !pricing.quantityOptions.includes(quantity)) return { ok: false, error: 'יש לבחור כמות מהרשימה' };
  const reasons = reviewReasons(pricing, fields, values, quantity, ctx);
  if (reasons.length) {
    return { ok: true, quote: { quoteOnly: true, reasons, quantity, unitPrice: 0, perUnit: 0, setupFee: 0, fixedAdds: 0, percent: 0, total: 0, breakdown: [] } };
  }
  const breakdown: PriceLine[] = [{ label: 'מחיר ליחידה', amount: unitPriceFor(pricing.basePrice, pricing.tiers, quantity) }];
  let fixedAdds = 0;
  let percent = 0;
  for (const { field, option } of chosenOptions(fields, values)) {
    if (option.priceDelta !== 0) breakdown.push({ label: `${field.label}: ${option.label}`, amount: option.priceDelta });
    fixedAdds += option.fixedAdd ?? 0;
    percent += option.percentAdd ?? 0;
  }
  const unitPrice = round4(Math.max(0, breakdown.reduce((s, l) => s + l.amount, 0)));
  const total = Math.max(0, Math.round((pricing.setupFee + fixedAdds + unitPrice * quantity) * (1 + percent / 100)));
  return {
    ok: true,
    quote: { quoteOnly: false, reasons: [], quantity, unitPrice, perUnit: round4(total / quantity), setupFee: pricing.setupFee, fixedAdds, percent, total, breakdown },
  };
}

/** החוסרים שחוסמים שליחה (5.3). הרשימה מוצגת ללקוח; השרת בודק את אותם תנאים שוב. */
export function missingForSubmit(
  pricing: TemplatePricing,
  fields: TemplateField[],
  raw: RawValues,
  quantity: number,
  file: { required: boolean; hasFile: boolean; needsDesign: boolean },
): string[] {
  const missing: string[] = [];
  if (!Number.isInteger(quantity) || quantity < 1) missing.push('יש לבחור כמות');
  else if (quantity < pricing.minQuantity) missing.push(`כמות מינימלית: ${pricing.minQuantity}`);
  else if (!pricing.allowCustomQuantity && !pricing.quantityOptions.includes(quantity)) missing.push('יש לבחור כמות מהרשימה');
  const checked = validateValues(fields, raw);
  if (!checked.ok) {
    for (const f of fields) {
      const err = checked.errors[f.key];
      if (err) missing.push(`${f.label}: ${err}`);
    }
  }
  if (file.required && !file.hasFile && !file.needsDesign) missing.push('יש להעלות קובץ, או לסמן שצריך גם עיצוב');
  return missing;
}

/** מידות המוצר (ס"מ) לפי שדה המידה: תווית האפשרות שנבחרה, ערך מותאם אישית או טקסט חופשי. */
export function sizeFromValues(fields: TemplateField[], values: RawValues): [number, number] | null {
  const f = fields.find((x) => x.key === SIZE_KEY);
  if (!f || !isVisible(f, fields, values)) return null;
  const v = values[f.key];
  const first = Array.isArray(v) ? v[0] : v;
  if (first === undefined || first === null || first === '') return null;
  if (first === CUSTOM_VALUE) return parseSizeCm(String(values[customKey(f.key)] ?? ''));
  const option = f.options?.find((o) => o.value === String(first));
  return parseSizeCm(option ? option.label : String(first));
}

/** תצוגת ערכים שנשמרו בהזמנה (תווית: ערך), לפי הגדרת הגרסה. */
export function describeValues(fields: TemplateField[], values: CleanValues): Array<{ label: string; value: string }> {
  const out: Array<{ label: string; value: string }> = [];
  for (const f of fields) {
    const v = values[f.key];
    if (v === undefined) continue;
    const optLabel = (x: string) => (x === CUSTOM_VALUE ? `התאמה אישית: ${String(values[customKey(f.key)] ?? '')}` : (f.options?.find((o) => o.value === x)?.label ?? x));
    const text =
      f.type === 'boolean' ? (v ? 'כן' : 'לא')
      : Array.isArray(v) ? v.map(optLabel).join(', ')
      : f.type === 'select' ? optLabel(String(v))
      : String(v);
    out.push({ label: f.label, value: text });
  }
  return out;
}
