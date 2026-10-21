import { describe, expect, it } from 'vitest';
import { groupDiscountAmount, loyaltyActive, maxRedeemablePoints, pointsDiscount, pointsToEarn, validateLoyaltyConfig } from './loyalty';

const cfg = { pointsPerShekel: 1, pointValue: 0.05, maxRedeemPct: 50 };

describe('loyalty & group pricing (R06-06/07)', () => {
  it('config validation; point value 0 means the club is off', () => {
    expect(validateLoyaltyConfig({ pointsPerShekel: '1', pointValue: '0.05', maxRedeemPct: '50' })).toEqual({ ok: true, value: cfg });
    expect(validateLoyaltyConfig({ pointsPerShekel: '-1', pointValue: '1', maxRedeemPct: '50' }).ok).toBe(false);
    expect(validateLoyaltyConfig({ pointsPerShekel: '1', pointValue: '1', maxRedeemPct: '50.5' }).ok).toBe(false);
    expect(loyaltyActive({ ...cfg, pointValue: 0 })).toBe(false);
    expect(pointsToEarn(100, { ...cfg, pointValue: 0 })).toBe(0);
  });

  it('earning: floor of paid amount × rate', () => {
    expect(pointsToEarn(99.99, cfg)).toBe(99);
    expect(pointsToEarn(100, { ...cfg, pointsPerShekel: 1.5 })).toBe(150);
    expect(pointsToEarn(-5, cfg)).toBe(0);
  });

  it('redeeming: limited by balance and by the % cap', () => {
    // 100 ₪ אחרי הנחות, תקרה 50% = 50 ₪ = 1000 נקודות
    expect(maxRedeemablePoints(5000, 100, cfg)).toBe(1000);
    expect(maxRedeemablePoints(300, 100, cfg)).toBe(300);
    expect(maxRedeemablePoints(0, 100, cfg)).toBe(0);
    expect(pointsDiscount(300, cfg)).toBe(15);
  });

  it('group discount: percent of subtotal, capped at 50%', () => {
    expect(groupDiscountAmount(200, 10)).toBe(20);
    expect(groupDiscountAmount(200, 80)).toBe(100);
    expect(groupDiscountAmount(200, 0)).toBe(0);
  });
});
