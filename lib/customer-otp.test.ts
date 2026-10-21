import { describe, expect, it } from 'vitest';
import { generateOtpCode, hashOtp, normalizeEmail } from './customer-otp';

describe('customer OTP (R06-03)', () => {
  it('normalizes and validates email', () => {
    expect(normalizeEmail('  Dana@Example.CO.IL ')).toBe('dana@example.co.il');
    expect(normalizeEmail('not-an-email')).toBeNull();
    expect(normalizeEmail('a@b')).toBeNull();
  });

  it('codes are 6 digits', () => {
    for (let i = 0; i < 50; i++) expect(generateOtpCode()).toMatch(/^\d{6}$/);
  });

  it('the stored hash is bound to the nursery, the email and the code', () => {
    const h = hashOtp('n1', 'a@b.co', '123456');
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).not.toContain('123456');
    expect(hashOtp('n2', 'a@b.co', '123456')).not.toBe(h);
    expect(hashOtp('n1', 'c@b.co', '123456')).not.toBe(h);
    expect(hashOtp('n1', 'a@b.co', '123457')).not.toBe(h);
    expect(hashOtp('n1', 'a@b.co', '123456')).toBe(h);
  });
});
