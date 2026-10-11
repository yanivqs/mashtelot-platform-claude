import { describe, expect, it } from 'vitest';
import { parsePriceTiers, printLinePrice, unitPriceFor } from './print-pricing';

describe('print pricing', () => {
  it('parses, validates and sorts tiers', () => {
    expect(
      parsePriceTiers([
        { minQty: 500, unitPrice: 1.2 },
        { minQty: 100, unitPrice: '1.5' },
        { minQty: 0, unitPrice: 1 },
        { minQty: 200, unitPrice: -1 },
        'junk',
      ]),
    ).toEqual([
      { minQty: 100, unitPrice: 1.5 },
      { minQty: 500, unitPrice: 1.2 },
    ]);
    expect(parsePriceTiers(null)).toEqual([]);
  });

  it('applies the highest reached tier', () => {
    const tiers = [
      { minQty: 100, unitPrice: 1.5 },
      { minQty: 500, unitPrice: 1.2 },
    ];
    expect(unitPriceFor(1.8, tiers, 50)).toBe(1.8);
    expect(unitPriceFor(1.8, tiers, 100)).toBe(1.5);
    expect(unitPriceFor(1.8, tiers, 499)).toBe(1.5);
    expect(unitPriceFor(1.8, tiers, 1000)).toBe(1.2);
  });

  it('adds per-unit option extras to the line', () => {
    const r = printLinePrice(1.8, [{ minQty: 100, unitPrice: 1.5 }], 200, [
      { name: 'למינציה', extraPrice: 0.4 },
      { name: 'UV', extraPrice: 0.6 },
    ]);
    expect(r).toEqual({ unitPrice: 2.5, total: 500 });
  });
});
