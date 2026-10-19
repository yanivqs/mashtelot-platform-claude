import { describe, expect, it } from 'vitest';
import { describeValues, isVisible, parseFields, parsePricing, quotePrint, validateValues, type TemplateField } from './print-template';

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
  const pricing = { basePrice: 1, tiers: [{ minQty: 500, unitPrice: 0.8 }], setupFee: 50, minQuantity: 100, quoteOnly: false };
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
