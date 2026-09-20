import { describe, expect, it } from 'vitest';
import {
  buildLineItems,
  calcSubtotal,
  assertCouponValid,
  applyDiscount,
  resolveShippingCost,
  CheckoutError,
  type ProductForCheckout,
} from './checkout-calc';

function productMap(products: ProductForCheckout[]): Map<string, ProductForCheckout> {
  return new Map(products.map((p) => [p.id, p]));
}

describe('buildLineItems', () => {
  const products = productMap([
    { id: 'p1', title: 'עציץ בזיליקום', price: 25, stockQuantity: 3 },
    { id: 'p2', title: 'עציץ נענע', price: 15, stockQuantity: 0 },
  ]);

  it('resolves cart lines against products, carrying title and price', () => {
    const items = buildLineItems([{ productId: 'p1', quantity: 2 }], products, { isQuote: false });
    expect(items).toEqual([
      { nurseryProductId: 'p1', productTitle: 'עציץ בזיליקום', quantity: 2, unitPrice: 25 },
    ]);
  });

  it('throws when a product no longer exists', () => {
    expect(() =>
      buildLineItems([{ productId: 'missing', quantity: 1 }], products, { isQuote: false }),
    ).toThrow(CheckoutError);
  });

  it('throws when stock is insufficient for a real order', () => {
    expect(() =>
      buildLineItems([{ productId: 'p1', quantity: 10 }], products, { isQuote: false }),
    ).toThrow(/אין מספיק מלאי/);
  });

  it('skips the stock check for a quote request', () => {
    expect(() =>
      buildLineItems([{ productId: 'p2', quantity: 5 }], products, { isQuote: true }),
    ).not.toThrow();
  });
});

describe('calcSubtotal', () => {
  it('sums unit price times quantity across lines', () => {
    const total = calcSubtotal([
      { nurseryProductId: 'p1', productTitle: 'a', quantity: 2, unitPrice: 25 },
      { nurseryProductId: 'p2', productTitle: 'b', quantity: 1, unitPrice: 15 },
    ]);
    expect(total).toBe(65);
  });
});

describe('assertCouponValid', () => {
  const now = new Date('2026-06-15T12:00:00Z');

  it('accepts an active coupon with no date window', () => {
    expect(() =>
      assertCouponValid({ isActive: true, startsAt: null, endsAt: null }, now),
    ).not.toThrow();
  });

  it('rejects a disabled coupon', () => {
    expect(() =>
      assertCouponValid({ isActive: false, startsAt: null, endsAt: null }, now),
    ).toThrow(/לא תקף/);
  });

  it('rejects a coupon that has not started yet', () => {
    expect(() =>
      assertCouponValid(
        { isActive: true, startsAt: new Date('2026-07-01'), endsAt: null },
        now,
      ),
    ).toThrow(/עדיין לא בתוקף/);
  });

  it('rejects a coupon past its end date', () => {
    expect(() =>
      assertCouponValid(
        { isActive: true, startsAt: null, endsAt: new Date('2026-06-01') },
        now,
      ),
    ).toThrow(/פג תוקף/);
  });

  it('accepts a coupon within its active window', () => {
    expect(() =>
      assertCouponValid(
        { isActive: true, startsAt: new Date('2026-06-01'), endsAt: new Date('2026-07-01') },
        now,
      ),
    ).not.toThrow();
  });
});

describe('applyDiscount', () => {
  it('applies a percentage discount to a subtotal', () => {
    expect(applyDiscount(100, 10)).toBe(90);
    expect(applyDiscount(65, 20)).toBeCloseTo(52);
  });
});

describe('resolveShippingCost', () => {
  it('charges the flat shipping price when there is no free-shipping threshold', () => {
    expect(resolveShippingCost(50, { shippingPrice: 25, freeShippingThreshold: null })).toBe(25);
  });

  it('charges the flat price when the subtotal is below the threshold', () => {
    expect(resolveShippingCost(99, { shippingPrice: 25, freeShippingThreshold: 100 })).toBe(25);
  });

  it('is free once the subtotal reaches the threshold', () => {
    expect(resolveShippingCost(100, { shippingPrice: 25, freeShippingThreshold: 100 })).toBe(0);
    expect(resolveShippingCost(150, { shippingPrice: 25, freeShippingThreshold: 100 })).toBe(0);
  });
});
