import { describe, expect, it } from 'vitest';
import {
  activeVariants,
  composeVariantName,
  optionMatrix,
  effectiveCompareAt,
  effectivePrice,
  hasChoice,
  lineTitle,
  priceSummary,
  validateVariantInput,
  variantImages,
  type VariantInput,
  type VariantLike,
} from './variants';

const product = { price: '40.00', compareAtPrice: '50.00' };
const v = (over: Partial<VariantLike>): VariantLike => ({
  id: 'v',
  name: '',
  price: null,
  compareAtPrice: null,
  stockQuantity: 5,
  reservedQuantity: 0,
  imageUrls: [],
  isDefault: false,
  isActive: true,
  sortOrder: 0,
  ...over,
});

describe('effective price', () => {
  it('inherits product price and compare-at when the variant has no price', () => {
    expect(effectivePrice(v({}), product)).toBe(40);
    expect(effectiveCompareAt(v({}), product)).toBe(50);
  });
  it("uses the variant's own price, and never the product's compare-at with it", () => {
    expect(effectivePrice(v({ price: '55.00' }), product)).toBe(55);
    expect(effectiveCompareAt(v({ price: '55.00' }), product)).toBeNull();
    expect(effectiveCompareAt(v({ price: '55.00', compareAtPrice: '70' }), product)).toBe(70);
  });
});

describe('priceSummary', () => {
  it('range over active variants, compare-at only for a single price, stock from availability', () => {
    const s = priceSummary(
      [v({ id: 'a', isDefault: true }), v({ id: 'b', price: 55, stockQuantity: 2, reservedQuantity: 2 }), v({ id: 'c', price: 10, isActive: false })],
      product,
    );
    expect(s).toEqual({ min: 40, max: 55, compareAt: null, inStock: true });
  });
  it('single price keeps the sale price', () => {
    expect(priceSummary([v({ isDefault: true })], product)).toEqual({ min: 40, max: 40, compareAt: 50, inStock: true });
  });
  it('out of stock when no active variant has availability', () => {
    expect(priceSummary([v({ stockQuantity: 1, reservedQuantity: 1 })], product).inStock).toBe(false);
    expect(priceSummary([], product).inStock).toBe(false);
  });
});

describe('ordering and helpers', () => {
  it('default first, then sort order; inactive removed', () => {
    const list = activeVariants([v({ id: 'b', sortOrder: 2 }), v({ id: 'x', isActive: false }), v({ id: 'a', sortOrder: 1 }), v({ id: 'd', isDefault: true, sortOrder: 9 })]);
    expect(list.map((x) => x.id)).toEqual(['d', 'a', 'b']);
    expect(hasChoice(list)).toBe(true);
    expect(hasChoice([v({ isDefault: true }), v({ isActive: false })])).toBe(false);
  });
  it('line title and images', () => {
    expect(lineTitle('ורד', '4 ליטר')).toBe('ורד — 4 ליטר');
    expect(lineTitle('ורד', ' ')).toBe('ורד');
    expect(variantImages(v({ imageUrls: ['https://a', 'https://p'] }), 'https://p')).toEqual(['https://a', 'https://p']);
    expect(variantImages(null, null)).toEqual([]);
  });
});

describe('validateVariantInput', () => {
  const base: VariantInput = { name: 'גדול', sku: null, barcode: null, price: null, compareAtPrice: null, stockQuantity: 0, imageUrls: [], isActive: true };
  const ok = { isDefault: false, hasSiblings: true };
  it('accepts a valid variant and inherited price', () => {
    expect(validateVariantInput(base, ok)).toBeNull();
  });
  it('rejects bad input', () => {
    expect(validateVariantInput({ ...base, name: '' }, ok)).not.toBeNull();
    expect(validateVariantInput({ ...base, price: -1 }, ok)).not.toBeNull();
    expect(validateVariantInput({ ...base, stockQuantity: 1.5 }, ok)).not.toBeNull();
    expect(validateVariantInput({ ...base, sku: 'a b' }, ok)).not.toBeNull();
    expect(validateVariantInput({ ...base, imageUrls: ['javascript:alert(1)'] }, ok)).not.toBeNull();
  });
  it('the only default variant may be unnamed but not deactivated', () => {
    expect(validateVariantInput({ ...base, name: '' }, { isDefault: true, hasSiblings: false })).toBeNull();
    expect(validateVariantInput({ ...base, isActive: false }, { isDefault: true, hasSiblings: false })).not.toBeNull();
  });
});

describe('size × color options', () => {
  type O = { id: string; name: string; option1?: string | null; option2?: string | null; colorHex?: string | null };
  const o = (id: string, option1: string | null, option2: string | null, colorHex: string | null = null): O => ({
    id,
    name: composeVariantName(option1, option2),
    option1,
    option2,
    colorHex,
  });

  it('composes the display name from both axes', () => {
    expect(composeVariantName('גדול', 'כתום')).toBe('גדול / כתום');
    expect(composeVariantName('גדול', ' ')).toBe('גדול');
    expect(composeVariantName(null, null)).toBe('');
  });

  it('builds the two axes in order and finds a combination', () => {
    const m = optionMatrix([o('1', 'קטן', 'כתום', '#e07b39'), o('2', 'קטן', 'בז׳', '#f3ead8'), o('3', 'גדול', 'כתום', '#e07b39')]);
    expect(m.axis1.map((x) => x.value)).toEqual(['קטן', 'גדול']);
    expect(m.axis2).toEqual([
      { value: 'כתום', colorHex: '#e07b39' },
      { value: 'בז׳', colorHex: '#f3ead8' },
    ]);
    expect(m.find('גדול', 'כתום')?.id).toBe('3');
    expect(m.find('גדול', 'בז׳')).toBeUndefined();
  });

  it('single axis: legacy variants use the name; swatches go on the only axis', () => {
    const legacy = optionMatrix([{ id: 'a', name: 'עציץ 4 ליטר' }, { id: 'b', name: 'עציץ 10 ליטר' }]);
    expect(legacy.axis1.map((x) => x.value)).toEqual(['עציץ 4 ליטר', 'עציץ 10 ליטר']);
    expect(legacy.axis2).toEqual([]);
    expect(legacy.find('עציץ 10 ליטר', '')?.id).toBe('b');
    const colors = optionMatrix([o('r', 'אדום', null, '#cc0000'), o('w', 'לבן', null, 'javascript:1')]);
    expect(colors.axis1).toEqual([
      { value: 'אדום', colorHex: '#cc0000' },
      { value: 'לבן', colorHex: null },
    ]);
  });

  it('validates the second axis and the swatch color', () => {
    const base: VariantInput = { name: 'גדול', sku: null, barcode: null, price: null, compareAtPrice: null, stockQuantity: 0, imageUrls: [], isActive: true };
    const ok = { isDefault: false, hasSiblings: true };
    expect(validateVariantInput({ ...base, option2: 'כתום', colorHex: '#E07B39' }, ok)).toBeNull();
    expect(validateVariantInput({ ...base, colorHex: 'red' }, ok)).not.toBeNull();
    expect(validateVariantInput({ ...base, name: '', option2: 'כתום' }, ok)).not.toBeNull();
  });
});
