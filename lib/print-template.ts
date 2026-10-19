/**
 * מנוע תבניות דפוס (נספח א, PT-02/03/07) — לוגיקה טהורה, משותפת לשרת ולטופס בדפדפן.
 *
 * - הגדרת שדות (סכמה) ותמחור נשמרות בגרסת תבנית; גרסה שפורסמה אינה משתנה (trigger ב-DB).
 * - ולידציה וחישוב מחיר רצים בשרת מול הגרסה השמורה — הדפדפן רק מציג; שדה מוסתר נזרק,
 *   ולא מקבלים מחיר מהלקוח (א.4, א.9).
 */
import { parsePriceTiers, unitPriceFor, type PriceTier } from '@/lib/print-pricing';

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
}

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
}

const KEY_RE = /^[a-z][a-z0-9_]{0,39}$/;
const MAX_FIELDS = 40;
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
        options.push({ value, label: olabel || value, priceDelta: Number.isNaN(delta) ? 0 : delta });
      }
      if (options.length === 0) errors.push(`${at}: לשדה בחירה צריך לפחות אפשרות אחת`);
      field.options = options;
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

export function parsePricing(json: unknown): Result<TemplatePricing> {
  const r = (json && typeof json === 'object' ? json : {}) as Record<string, unknown>;
  const errors: string[] = [];
  const basePrice = num(r.basePrice) ?? 0;
  const setupFee = num(r.setupFee) ?? 0;
  const minQuantity = num(r.minQuantity) ?? 1;
  const quoteOnly = r.quoteOnly === true;
  if (Number.isNaN(basePrice) || basePrice < 0) errors.push('מחיר בסיס לא תקין');
  if (!quoteOnly && basePrice <= 0) errors.push('מחיר בסיס חייב להיות גדול מ-0 (או לסמן "הצעת מחיר בלבד")');
  if (Number.isNaN(setupFee) || setupFee < 0) errors.push('עלות הקמה לא תקינה');
  if (!Number.isInteger(minQuantity) || minQuantity < 1) errors.push('כמות מינימום חייבת להיות מספר שלם 1 ומעלה');
  const tiers = parsePriceTiers(r.tiers);
  if (errors.length) return { ok: false, errors };
  return { ok: true, value: { basePrice, tiers, setupFee, minQuantity, quoteOnly } };
}

// ---------- מילוי והזמנה (בידי בעל המשתלה; נבדק מחדש בשרת) ----------

export type RawValues = Record<string, unknown>;
export type FieldValue = string | number | boolean | string[];
export type CleanValues = Record<string, FieldValue>;

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
        } else if (!f.options?.some((o) => o.value === s)) errors[f.key] = 'בחירה לא תקינה';
        else values[f.key] = s;
        break;
      }
      case 'multiselect': {
        const arr = (Array.isArray(v) ? v : v === undefined || v === null || v === '' ? [] : [v]).map(String);
        const uniq = [...new Set(arr)];
        if (uniq.some((s) => !f.options?.some((o) => o.value === s))) errors[f.key] = 'בחירה לא תקינה';
        else if (f.required && uniq.length === 0) errors[f.key] = 'יש לבחור לפחות אפשרות אחת';
        else if (uniq.length) values[f.key] = uniq;
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
  quoteOnly: boolean;
  quantity: number;
  unitPrice: number;
  setupFee: number;
  total: number;
  breakdown: PriceLine[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** חישוב מחיר בשרת: מדרגת כמות/בסיס + תוספות האפשרויות שנבחרו (ליחידה) + עלות הקמה. */
export function quotePrint(
  pricing: TemplatePricing,
  fields: TemplateField[],
  values: CleanValues,
  quantity: number,
): { ok: true; quote: PrintQuote } | { ok: false; error: string } {
  if (!Number.isInteger(quantity) || quantity < 1) return { ok: false, error: 'כמות לא תקינה' };
  if (quantity < pricing.minQuantity) return { ok: false, error: `כמות מינימלית: ${pricing.minQuantity}` };
  if (pricing.quoteOnly) {
    return { ok: true, quote: { quoteOnly: true, quantity, unitPrice: 0, setupFee: 0, total: 0, breakdown: [] } };
  }
  const base = unitPriceFor(pricing.basePrice, pricing.tiers, quantity);
  const breakdown: PriceLine[] = [{ label: 'מחיר ליחידה', amount: base }];
  for (const f of fields) {
    const v = values[f.key];
    if (v === undefined || !f.options) continue;
    const chosen = f.type === 'multiselect' && Array.isArray(v) ? v : f.type === 'select' ? [String(v)] : [];
    for (const c of chosen) {
      const o = f.options.find((x) => x.value === c);
      if (o && o.priceDelta !== 0) breakdown.push({ label: `${f.label}: ${o.label}`, amount: o.priceDelta });
    }
  }
  const unitPrice = round2(Math.max(0, breakdown.reduce((s, l) => s + l.amount, 0)));
  const total = round2(unitPrice * quantity + pricing.setupFee);
  return { ok: true, quote: { quoteOnly: false, quantity, unitPrice, setupFee: pricing.setupFee, total, breakdown } };
}

/** תצוגת ערכים שנשמרו בהזמנה (תווית: ערך), לפי הגדרת הגרסה. */
export function describeValues(fields: TemplateField[], values: CleanValues): Array<{ label: string; value: string }> {
  const out: Array<{ label: string; value: string }> = [];
  for (const f of fields) {
    const v = values[f.key];
    if (v === undefined) continue;
    const optLabel = (x: string) => f.options?.find((o) => o.value === x)?.label ?? x;
    const text =
      f.type === 'boolean' ? (v ? 'כן' : 'לא')
      : Array.isArray(v) ? v.map(optLabel).join(', ')
      : f.type === 'select' ? optLabel(String(v))
      : String(v);
    out.push({ label: f.label, value: text });
  }
  return out;
}
