import { describe, expect, it } from 'vitest';
import { base32Decode, base32Encode, generateSecret, hotp, otpauthUri, stepAt, totp, verifyTotp } from './totp';

const RFC_KEY = Buffer.from('12345678901234567890'); // RFC 4226 / 6238 (SHA1)

describe('TOTP (§4.04)', () => {
  it('RFC 4226 HOTP test vectors', () => {
    expect([0, 1, 2, 3, 9].map((c) => hotp(RFC_KEY, c))).toEqual(['755224', '287082', '359152', '969429', '520489']);
  });

  it('RFC 6238 TOTP SHA1 test vectors (8 digits)', () => {
    const at = (t: number) => hotp(RFC_KEY, Math.floor(t / 30), 8);
    expect([59, 1111111109, 1111111111, 1234567890, 2000000000].map(at)).toEqual(['94287082', '07081804', '14050471', '89005924', '69279037']);
  });

  it('base32 round trip; secret is 160 bits', () => {
    expect(base32Encode(Buffer.from('foobar'))).toBe('MZXW6YTBOI');
    expect(base32Decode('MZXW6YTBOI').toString()).toBe('foobar');
    const s = generateSecret();
    expect(s).toMatch(/^[A-Z2-7]{32}$/);
    expect(base32Decode(s)).toHaveLength(20);
  });

  it('accepts ±1 step, rejects reuse of the same or an older step, rejects junk', () => {
    const s = generateSecret();
    const now = 1_800_000_000_000;
    const step = stepAt(now);
    expect(verifyTotp(s, totp(s, now), now)).toBe(step);
    expect(verifyTotp(s, totp(s, now - 30_000), now)).toBe(step - 1);
    expect(verifyTotp(s, totp(s, now + 30_000), now)).toBe(step + 1);
    expect(verifyTotp(s, totp(s, now - 90_000), now)).toBeNull();
    expect(verifyTotp(s, totp(s, now), now, step)).toBeNull(); // כבר נוצל
    expect(verifyTotp(s, totp(s, now + 30_000), now, step)).toBe(step + 1);
    expect(verifyTotp(s, 'abcdef', now)).toBeNull();
    expect(verifyTotp(s, '12345', now)).toBeNull();
  });

  it('otpauth URI for authenticator apps', () => {
    const u = new URL(otpauthUri('JBSWY3DPEHPK3PXP', 'a@b.co', 'משתלות'));
    expect(u.protocol).toBe('otpauth:');
    expect(u.searchParams.get('secret')).toBe('JBSWY3DPEHPK3PXP');
    expect(u.searchParams.get('period')).toBe('30');
    expect(decodeURIComponent(u.pathname)).toContain('a@b.co');
  });
});
