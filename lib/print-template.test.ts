import { describe, expect, it } from 'vitest';
import { describeValues, isVisible, missingForSubmit, parseFields, parsePricing, quotePrint, sizeFromValues, validateValues, type TemplateField } from './print-template';

const def = [
  { key: 'material', label: 'חומר', type: 'select', required: true, options: [
    { value: 'paper', label: 'נייר', priceDelta: 0 },
    { value: 'pvc', label: 'PVC', priceDelta: 0.5 },
  ] },
  { key: 'glue', label: 'סוג דבק', type: 'select', required: true, showIf: { field: 'material', equals: 'pvc' }, options: [
    { value: 'perm', label: 'קבוע', priceDelta: 0.1 },
    { value: 'remov', label: 'נשלף', priceDelta: 0.2 },
  ] },
  { key: 'text', label: 'טקסט על המדבקה', type: 'text', required: true, maxLength: 30 },
  { key: 'double', label: 'דו-צדדי', type: 'boolean', required: false },
  { key: 'back_text', label: 'טקסט בצד השני', type: 'textarea', required: true, showIf: { field: 'double', equals: 'true' } },
  { key: 'finishes', label: 'גימור', type: 'multiselect', required: false, options: [
    { value: 'uv', label: 'UV', priceDelta: 0.3 },
    { value: 'lam', label: 'למינציה', priceDelta: 0.2 },
  ] },
  { key: 'width', label: 'רוחב (מ"מ)', type: 'number', required: false, min: 20, max: 300 },
];

const fields = (() => {
  const r = parseFields(def);
  if (!r.ok) throw new Error(r.errors.join(';'));
  return r.value;
})();

describe('parseFields (template definition)', () => {
  it('accepts a valid definition', () => {
    expect(fields).toHaveLength(7);
    expect(fields[1]!.showIf).toEqual({ field: 'material', equals: 'pvc' });
  });
  it('rejects bad keys, duplicates, unknown types and empty selects', () => {
    const r = parseFields([
      { key: 'Bad Key', label: 'x', type: 'text' },
      { key: 'a', label: 'x', type: 'text' },
      { key: 'a', label: 'y', type: 'text' },
      { key: 'b', label: 'z', type: 'color' },
      { key: 'c', label: 'w', type: 'select', options: [] },
    ]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.length).toBeGreaterThanOrEqual(4);
  });
  it('conditions may only reference an earlier choice field and an existing option', () => {
    expect(parseFields([{ key: 'b', label: 'b', type: 'text', showIf: { field: 'a', equals: 'x' } }, { key: 'a', label: 'a', type: 'boolean' }]).ok).toBe(false);
    expect(parseFields([{ key: 'a', label: 'a', type: 'select', options: [{ value: 'x' }] }, { key: 'b', label: 'b', type: 'text', showIf: { field: 'a', equals: 'nope' } }]).ok).toBe(false);
    expect(parseFields([{ key: 'a', label: 'a', type: 'text' }, { key: 'b', label: 'b', type: 'text', showIf: { field: 'a', equals: 'x' } }]).ok).toBe(false);
  });
});

describe('parsePricing', () => {
  it('requires a positive base price unless quote-only', () => {
    expect(parsePricing({ basePrice: 0 }).ok).toBe(false);
    expect(parsePricing({ basePrice: 0, quoteOnly: true }).ok).toBe(true);
    expect(parsePricing({ basePrice: 1.2, minQuantity: 0 }).ok).toBe(false);
  });
});

const quoted = { basePrice: 0, tiers: [{ minQty: 500, unitPrice: 0.5 }], setupFee: 50, minQuantity: 1, quoteOnly: false, quantityOptions: [500, 1000], allowCustomQuantity: true };
const specFields = (() => {
  const r = parseFields([
    { key: 'paper', label: 'נייר', type: 'select', required: true, options: [{ value: 'chromo', label: 'כרומו', priceDelta: 0.1 }, { value: 'special', label: 'מיוחד', requiresQuote: true }] },
    { key: 'finish', label: 'גימור', type: 'multiselect', allowCustom: true, options: [{ value: 'lam', label: 'למינציה', fixedAdd: 30, percentAdd: 10 }] },
    { key: 'size', label: 'מידה', type: 'select', allowCustom: true, options: [{ value: 'opt_1', label: 'A4' }, { value: 'opt_2', label: '10x15 ס"מ' }] },
  ]);
  if (!r.ok) throw new Error(r.errors.join(';'));
  return r.value;
})();

describe('spec acceptance: pricing and review', () => {
  it('5.2 example returns 748', () => {
    const q = quotePrint(quoted, specFields, { paper: 'chromo', finish: ['lam'] }, 1000);
    expect(q.ok && q.quote).toMatchObject({ quoteOnly: false, total: 748, perUnit: 0.748, unitPrice: 0.6, fixedAdds: 30, percent: 10 });
  });
  it('quantity 750 with options [500,1000] goes to review with the custom-quantity reason', () => {
    const q = quotePrint(quoted, specFields, { paper: 'chromo' }, 750);
    expect(q.ok && q.quote).toMatchObject({ quoteOnly: true, total: 0, reasons: ['כמות מותאמת אישית'] });
  });
  it('collects every review reason, and low resolution only without a design request', () => {
    const values = { paper: 'special', finish: ['__custom'], finish__custom: 'זהב' };
    const q = quotePrint({ ...quoted, quantityOptions: [], basePrice: 0 }, specFields, values, 100, { needsDesign: true, lowResolution: true });
    expect(q.ok && q.quote.reasons).toEqual(['אין מחירון לכמות זו', 'גימור: ערך מותאם אישית', 'נייר: מיוחד', 'נדרש עיצוב']);
    const low = quotePrint(quoted, specFields, { paper: 'chromo' }, 500, { lowResolution: true });
    expect(low.ok && low.quote.reasons).toEqual(['רזולוציית הקובץ נמוכה מ-300 DPI']);
  });
  it('a fixed quantity list rejects other quantities', () => {
    expect(quotePrint({ ...quoted, allowCustomQuantity: false }, specFields, {}, 750)).toEqual({ ok: false, error: 'יש לבחור כמות מהרשימה' });
  });
  it('custom value needs text, is kept and described', () => {
    expect(validateValues(specFields, { paper: 'chromo', size: '__custom' }).ok).toBe(false);
    const r = validateValues(specFields, { paper: 'chromo', size: '__custom', size__custom: '20x30' });
    expect(r.ok && r.values).toMatchObject({ size: '__custom', size__custom: '20x30' });
    if (r.ok) expect(describeValues(specFields, r.values)).toContainEqual({ label: 'מידה', value: 'התאמה אישית: 20x30' });
    expect(validateValues(fields, { material: '__custom', text: 'x' }).ok).toBe(false);
  });
  it('missing list blocks sending: quantity, required fields and file', () => {
    const file = { required: true, hasFile: false, needsDesign: false };
    expect(missingForSubmit(quoted, specFields, {}, 0, file)).toEqual(['יש לבחור כמות', 'נייר: יש לבחור', 'יש להעלות קובץ, או לסמן שצריך גם עיצוב']);
    expect(missingForSubmit(quoted, specFields, { paper: 'chromo' }, 500, { ...file, needsDesign: true })).toEqual([]);
    expect(missingForSubmit(quoted, specFields, { paper: 'chromo' }, 500, { ...file, required: false })).toEqual([]);
  });
  it('size comes from the option label or the custom text', () => {
    expect(sizeFromValues(specFields, { size: 'opt_1' })).toEqual([21, 29.7]);
    expect(sizeFromValues(specFields, { size: 'opt_2' })).toEqual([10, 15]);
    expect(sizeFromValues(specFields, { size: '__custom', size__custom: '20*30' })).toEqual([20, 30]);
    expect(sizeFromValues(specFields, {})).toBeNull();
  });
  it('old stored pricing without the new keys keeps working', () => {
    const p = parsePricing({ basePrice: 2, tiers: [], setupFee: 0, minQuantity: 1, quoteOnly: false });
    expect(p.ok && p.value).toMatchObject({ quantityOptions: [], allowCustomQuantity: true });
  });
  it('tiers without a base price are valid; neither is not', () => {
    expect(parsePricing({ basePrice: 0, tiers: [{ minQty: 10, unitPrice: 1 }] }).ok).toBe(true);
    expect(parsePricing({ basePrice: 0, tiers: [] }).ok).toBe(false);
    expect(parsePricing({ basePrice: 1, minQuantity: 10, quantityOptions: [5] }).ok).toBe(false);
  });
});

describe('option minimums', () => {
  const opts = (r: ReturnType<typeof parseFields>) => {
    if (!r.ok) throw new Error(r.errors.join(';'));
    return r.value;
  };
  const f = opts(parseFields([
    { key: 'finish', label: 'גימור', type: 'select', options: [
      { value: 'lam', label: 'למינציה', priceDelta: 0.5, minCharge: 50 },
      { value: 'fix', label: 'קבוע', fixedAdd: 20, minCharge: 50 },
      { value: 'pct', label: 'אחוזים', percentAdd: 10, minCharge: 50 },
      { value: 'uv', label: 'UV', priceDelta: 0.1, minQuantity: 500 },
    ] },
  ]));
  const p = { basePrice: 0.3, tiers: [], setupFee: 0, minQuantity: 1, quoteOnly: false, quantityOptions: [], allowCustomQuantity: true };

  it('tops the option up to its minimum price, and only when it falls short', () => {
    const low = quotePrint(p, f, { finish: 'lam' }, 50); // 15 + 25 → השלמה של 25
    expect(low.ok && low.quote).toMatchObject({ total: 65, minCharges: [{ label: 'גימור: למינציה', amount: 25 }] });
    const exact = quotePrint(p, f, { finish: 'lam' }, 100); // 30 + 50: בדיוק המינימום
    expect(exact.ok && exact.quote).toMatchObject({ total: 80, minCharges: [] });
    const high = quotePrint(p, f, { finish: 'lam' }, 200);
    expect(high.ok && high.quote).toMatchObject({ total: 160, minCharges: [] });
  });
  it('counts fixed and percent adds toward the minimum', () => {
    const fixed = quotePrint(p, f, { finish: 'fix' }, 10); // 3 + 20, השלמה 30
    expect(fixed.ok && fixed.quote).toMatchObject({ total: 53, minCharges: [{ amount: 30 }] });
    const pct = quotePrint(p, f, { finish: 'pct' }, 100); // 30 + 3, השלמה 47
    expect(pct.ok && pct.quote).toMatchObject({ total: 80, minCharges: [{ amount: 47 }] });
    const pctHigh = quotePrint(p, f, { finish: 'pct' }, 10000); // 3000 + 300
    expect(pctHigh.ok && pctHigh.quote).toMatchObject({ total: 3300, minCharges: [] });
  });
  it('blocks an option below its minimum quantity, on the server price and in the missing list', () => {
    expect(quotePrint(p, f, { finish: 'uv' }, 499)).toEqual({ ok: false, error: 'גימור: UV זמין מכמות 500' });
    expect(quotePrint(p, f, { finish: 'uv' }, 500).ok).toBe(true);
    const file = { required: false, hasFile: false, needsDesign: false };
    expect(missingForSubmit(p, f, { finish: 'uv' }, 499, file)).toEqual(['גימור: UV זמין מכמות 500']);
    expect(missingForSubmit(p, f, { finish: 'uv' }, 500, file)).toEqual([]);
  });
  it('rejects bad minimums and drops empty ones', () => {
    expect(parseFields([{ key: 'a', label: 'א', type: 'select', options: [{ value: 'x', minQuantity: 1.5 }] }]).ok).toBe(false);
    expect(parseFields([{ key: 'a', label: 'א', type: 'select', options: [{ value: 'x', minCharge: -1 }] }]).ok).toBe(false);
    const r = parseFields([{ key: 'a', label: 'א', type: 'select', options: [{ value: 'x', minCharge: 0, minQuantity: 0 }] }]);
    expect(r.ok && r.value[0]!.options![0]).toEqual({ value: 'x', label: 'x', priceDelta: 0 });
  });
});

describe('visibility and server validation', () => {
  it('conditional fields appear only when their condition holds', () => {
    const glue = fields[1]!;
    expect(isVisible(glue, fields, { material: 'paper' })).toBe(false);
    expect(isVisible(glue, fields, { material: 'pvc' })).toBe(true);
  });
  it('hidden fields are dropped even if sent (a hidden field in the browser is not enough)', () => {
    const r = validateValues(fields, { material: 'paper', glue: 'perm', text: 'ורד', back_text: 'hack' });
    expect(r).toEqual({ ok: true, values: { material: 'paper', text: 'ורד', double: false } });
  });
  it('required conditional field is enforced when visible', () => {
    const r = validateValues(fields, { material: 'pvc', text: 'ורד', double: 'on' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(['back_text', 'glue']);
  });
  it('rejects unknown options, long text, out-of-range numbers and multi-line short text', () => {
    const r = validateValues(fields, { material: 'gold', text: 'x'.repeat(31), width: '5', finishes: ['uv', 'foil'] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(['finishes', 'material', 'text', 'width']);
    const r2 = validateValues(fields, { material: 'paper', text: 'שורה\nשנייה' });
    expect(r2.ok).toBe(false);
  });
});

describe('quotePrint (server pricing)', () => {
  const pricing = { basePrice: 1, tiers: [{ minQty: 500, unitPrice: 0.8 }], setupFee: 50, minQuantity: 100, quoteOnly: false, quantityOptions: [], allowCustomQuantity: true };
  it('tier + option deltas per unit + setup fee', () => {
    const v = validateValues(fields, { material: 'pvc', glue: 'remov', text: 'ורד', finishes: ['uv', 'lam'] });
    if (!v.ok) throw new Error('invalid');
    const q = quotePrint(pricing, fields, v.values, 500);
    expect(q.ok && q.quote).toMatchObject({ unitPrice: 2, total: 1050, setupFee: 50 }); // 0.8+0.5+0.2+0.3+0.2
  });
  it('minimum quantity and quote-only', () => {
    expect(quotePrint(pricing, fields, {}, 50)).toEqual({ ok: false, error: 'כמות מינימלית: 100' });
    const q = quotePrint({ ...pricing, quoteOnly: true }, fields, {}, 100);
    expect(q.ok && q.quote).toMatchObject({ quoteOnly: true, total: 0 });
  });
  it('describes stored values with labels', () => {
    expect(describeValues(fields as TemplateField[], { material: 'pvc', double: true, finishes: ['uv'] })).toEqual([
      { label: 'חומר', value: 'PVC' },
      { label: 'דו-צדדי', value: 'כן' },
      { label: 'גימור', value: 'UV' },
    ]);
  });
});
