import { describe, expect, it } from 'vitest';
import {
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  isMethodAllowedFor,
  isPaymentMethod,
  isPayOnSite,
  validatePaymentDestination,
} from './payment-methods';

describe('payment methods (R05-06)', () => {
  it('every method has a label', () => {
    for (const m of PAYMENT_METHODS) expect(PAYMENT_METHOD_LABELS[m]).toBeTruthy();
  });

  it('pay-on-pickup only with pickup, pay-on-delivery only with delivery', () => {
    expect(isMethodAllowedFor('PAY_ON_PICKUP', 'PICKUP')).toBe(true);
    expect(isMethodAllowedFor('PAY_ON_PICKUP', 'DELIVERY')).toBe(false);
    expect(isMethodAllowedFor('PAY_ON_DELIVERY', 'DELIVERY')).toBe(true);
    expect(isMethodAllowedFor('PAY_ON_DELIVERY', 'PICKUP')).toBe(false);
    expect(isMethodAllowedFor('PAY_ON_PICKUP', '')).toBe(false);
  });

  it('prepaid methods are allowed with any delivery', () => {
    for (const m of ['BIT', 'PAYBOX', 'PAYPAL', 'BANK_TRANSFER'] as const) {
      expect(isMethodAllowedFor(m, 'PICKUP')).toBe(true);
      expect(isMethodAllowedFor(m, 'DELIVERY')).toBe(true);
      expect(isPayOnSite(m)).toBe(false);
    }
    expect(isPayOnSite('PAY_ON_PICKUP')).toBe(true);
  });

  it('rejects unknown method values from the client', () => {
    expect(isPaymentMethod('PAYPAL')).toBe(true);
    expect(isPaymentMethod('CRYPTO')).toBe(false);
    expect(isPaymentMethod(undefined)).toBe(false);
  });

  it('PayPal destination must be an https paypal link', () => {
    expect(validatePaymentDestination('PAYPAL', 'https://paypal.me/galim')).toBeNull();
    expect(validatePaymentDestination('PAYPAL', 'https://www.paypal.com/paypalme/galim')).toBeNull();
    expect(validatePaymentDestination('PAYPAL', 'http://paypal.me/galim')).not.toBeNull();
    expect(validatePaymentDestination('PAYPAL', 'https://paypal.me.evil.com/x')).not.toBeNull();
    expect(validatePaymentDestination('PAYPAL', 'javascript:alert(1)')).not.toBeNull();
    expect(validatePaymentDestination('PAYPAL', 'paypal.me/galim')).not.toBeNull();
    expect(validatePaymentDestination('PAYPAL', null)).toBeNull();
    expect(validatePaymentDestination('BIT', '050-1234567')).toBeNull();
  });
});
