import { describe, expect, it } from 'vitest';
import { decryptSecret, encryptSecret, generateRecoveryCodes, hashRecoveryCode } from './mfa-crypto';

describe('MFA secret encryption and recovery codes (§4.04)', () => {
  it('AES-GCM round trip, random IV, tampering is detected', () => {
    const a = encryptSecret('JBSWY3DPEHPK3PXP');
    expect(a).toMatch(/^v1\./);
    expect(a).not.toContain('JBSWY3DPEHPK3PXP');
    expect(encryptSecret('JBSWY3DPEHPK3PXP')).not.toBe(a);
    expect(decryptSecret(a)).toBe('JBSWY3DPEHPK3PXP');
    const parts = a.split('.');
    const ct = Buffer.from(parts[3]!, 'base64url');
    ct[0] = ct[0]! ^ 1;
    expect(() => decryptSecret([...parts.slice(0, 3), ct.toString('base64url')].join('.'))).toThrow();
  });

  it('a wrong key cannot decrypt', () => {
    const enc = encryptSecret('SECRET');
    const prev = process.env.MFA_ENCRYPTION_KEY;
    process.env.MFA_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
    try {
      expect(() => decryptSecret(enc)).toThrow();
    } finally {
      if (prev === undefined) delete process.env.MFA_ENCRYPTION_KEY;
      else process.env.MFA_ENCRYPTION_KEY = prev;
    }
  });

  it('8 unique recovery codes; hash ignores case and dashes', () => {
    const codes = generateRecoveryCodes();
    expect(codes).toHaveLength(8);
    expect(new Set(codes).size).toBe(8);
    codes.forEach((c) => expect(c).toMatch(/^[a-z2-9]{5}-[a-z2-9]{5}$/));
    expect(hashRecoveryCode('ABCDE-FGHJK')).toBe(hashRecoveryCode('abcdefghjk'));
  });
});
