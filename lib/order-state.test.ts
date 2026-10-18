import { describe, expect, it } from 'vitest';
import {
  allowedNextPaymentStatuses,
  allowedNextStatuses,
  canTransition,
  normalizeStatus,
  reservationExpiry,
  stockEffectFor,
} from './order-state';

describe('order status machine (R05-07)', () => {
  it('follows the fulfilment path forward only', () => {
    expect(allowedNextStatuses('RECEIVED')).toEqual(['CONFIRMED', 'CANCELLED']);
    expect(canTransition('CONFIRMED', 'PREPARING')).toBe(true);
    expect(canTransition('READY', 'DELIVERED')).toBe(true); // איסוף עצמי
    expect(canTransition('SHIPPED', 'DELIVERED')).toBe(true);
  });

  it('rejects illegal transitions', () => {
    expect(canTransition('DELIVERED', 'RECEIVED')).toBe(false);
    expect(canTransition('RECEIVED', 'SHIPPED')).toBe(false); // חייב אישור קודם
    expect(canTransition('SHIPPED', 'CANCELLED')).toBe(false); // אחרי משלוח — החזרה מנוהלת ידנית (§9.07)
    expect(canTransition('CANCELLED', 'CONFIRMED')).toBe(false);
    expect(canTransition('RECEIVED', 'RECEIVED')).toBe(false);
  });

  it('maps legacy values to their new equivalents', () => {
    expect(normalizeStatus('PENDING')).toBe('RECEIVED');
    expect(normalizeStatus('PAID')).toBe('CONFIRMED');
    expect(normalizeStatus('PROCESSING')).toBe('PREPARING');
    expect(allowedNextStatuses('PENDING')).toEqual(allowedNextStatuses('RECEIVED'));
  });
});

describe('payment status machine', () => {
  it('unpaid → paid → refunded, no way back from refunded', () => {
    expect(allowedNextPaymentStatuses('UNPAID')).toEqual(['PAID']);
    expect(allowedNextPaymentStatuses('PAID')).toContain('REFUNDED');
    expect(allowedNextPaymentStatuses('REFUNDED')).toEqual([]);
  });
});

describe('stock effects (R05-08)', () => {
  it('confirm extends an active reservation or re-reserves a released one', () => {
    expect(stockEffectFor('CONFIRMED', 'RESERVED')).toBe('extend');
    expect(stockEffectFor('CONFIRMED', 'RELEASED')).toBe('reserve');
    expect(stockEffectFor('CONFIRMED', 'NONE')).toBe('reserve'); // הצעת מחיר שאושרה
    expect(stockEffectFor('CONFIRMED', 'COMMITTED')).toBe('none'); // הזמנה מהמודל הקודם
  });

  it('goods leaving commit the reservation exactly once', () => {
    expect(stockEffectFor('SHIPPED', 'RESERVED')).toBe('commit');
    expect(stockEffectFor('DELIVERED', 'RESERVED')).toBe('commit');
    expect(stockEffectFor('DELIVERED', 'COMMITTED')).toBe('none');
  });

  it('cancel releases a reservation, restores committed stock, and does nothing otherwise', () => {
    expect(stockEffectFor('CANCELLED', 'RESERVED')).toBe('release');
    expect(stockEffectFor('CANCELLED', 'COMMITTED')).toBe('restore');
    expect(stockEffectFor('CANCELLED', 'RELEASED')).toBe('none');
    expect(stockEffectFor('CANCELLED', 'NONE')).toBe('none');
  });

  it('reservation window is 48 hours', () => {
    const now = new Date('2026-10-18T10:00:00Z');
    expect(reservationExpiry(now).toISOString()).toBe('2026-10-20T10:00:00.000Z');
  });
});
