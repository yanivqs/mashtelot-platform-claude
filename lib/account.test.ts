import { describe, expect, it } from 'vitest';
import { validateNewPassword, MIN_PASSWORD_LENGTH } from './account';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { assertSeedTargetAllowed } = require('../scripts/seed-guard');

describe('validateNewPassword', () => {
  it('rejects short, previously exposed, repetitive and unchanged passwords', () => {
    expect(validateNewPassword('a'.repeat(MIN_PASSWORD_LENGTH - 1))).toMatch(/לפחות/);
    expect(validateNewPassword('ADMIN1234')).not.toBeNull();
    expect(validateNewPassword('owner1234')).not.toBeNull();
    expect(validateNewPassword('zzzzzzzzzzzzzz')).not.toBeNull();
    expect(validateNewPassword('Same-Pass-12345', 'Same-Pass-12345')).toMatch(/זהה/);
  });

  it('accepts a strong new password', () => {
    expect(validateNewPassword('correct-horse-battery-9', 'old-password-123')).toBeNull();
  });
});

describe('seed target guard', () => {
  const PROD = 'postgresql://postgres.aaaaaaaaaaaaaaaaaaaa:x@aws-0-eu-central-1.pooler.supabase.com:5432/postgres';
  const DEV = 'postgresql://postgres.bbbbbbbbbbbbbbbbbbbb:x@aws-1-eu-central-1.pooler.supabase.com:5432/postgres';

  it('refuses a remote database that is not allowlisted (production)', () => {
    expect(() => assertSeedTargetAllowed({ DATABASE_URL: PROD })).toThrow(/seed חסום/);
  });

  it('refuses when DATABASE_URL is missing', () => {
    expect(() => assertSeedTargetAllowed({})).toThrow();
  });

  it('allows a local database and an explicitly allowlisted dev project', () => {
    expect(assertSeedTargetAllowed({ DATABASE_URL: 'postgresql://p:x@localhost:5432/mashtelot_test' })).toBe(
      'local:localhost',
    );
    expect(
      assertSeedTargetAllowed({ DATABASE_URL: DEV, SEED_ALLOWED_REFS: 'bbbbbbbbbbbbbbbbbbbb' }),
    ).toBe('supabase:bbbbbbbbbbbbbbbbbbbb');
  });

  it('never echoes the password', () => {
    try {
      assertSeedTargetAllowed({ DATABASE_URL: PROD.replace(':x@', ':TOPSECRET@') });
    } catch (e) {
      expect(String((e as Error).message)).not.toContain('TOPSECRET');
    }
  });
});
