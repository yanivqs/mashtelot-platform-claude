import { describe, expect, it } from 'vitest';
import { legacyToDraft } from './print-legacy';
import { parseFields, parsePricing, quotePrint } from './print-template';

const product = {
  title: 'חבק לעצים עם הדפסה',
  description: 'חבק',
  category: null,
  specs: 'צהוב',
  imageUrl: null,
  unitLabel: 'יחידה',
  leadTimeDays: 7,
  basePrice: '0.45',
  minQuantity: 100,
  priceTiers: [{ minQty: 500, unitPrice: 0.4 }],
  requiresArtwork: false,
  allowOptions: true,
  sortOrder: 2,
};
const options = [{ optionName: 'למינציה מט', extraPrice: '0.4' }];

describe('legacyToDraft', () => {
  it('produces a definition the engine accepts, with the same price', () => {
    const d = legacyToDraft(product, options);
    const fields = parseFields(d.fields);
    const pricing = parsePricing(d.pricing);
    if (!fields.ok || !pricing.ok) throw new Error('invalid draft');
    expect(d.meta).toMatchObject({ isActive: false, description: 'חבק\nצהוב', sortOrder: 2 });
    const q = quotePrint(pricing.value, fields.value, { field_1: ['opt_1'] }, 500);
    expect(q.ok && q.quote.total).toBe(400); // (0.4 + 0.4) × 500
    const plain = quotePrint(pricing.value, fields.value, {}, 100);
    expect(plain.ok && plain.quote.total).toBe(45);
  });
  it('skips finishing options when the product did not allow them', () => {
    expect(legacyToDraft({ ...product, allowOptions: false }, options).fields).toHaveLength(1);
  });
});
