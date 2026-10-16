import { describe, expect, it } from 'vitest';
import { assertSafeTestDatabaseUrl, parseAllowedRefs, UnsafeTestDatabaseError } from './test-db-guard';

const PROD_REF = 'aaaaaaaaaaaaaaaaaaaa';
const DEV_REF = 'bbbbbbbbbbbbbbbbbbbb';
const prodPooler = `postgresql://postgres.${PROD_REF}:secret@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true`;
const prodDirect = `postgresql://postgres.${PROD_REF}:secret@aws-0-eu-central-1.pooler.supabase.com:5432/postgres`;
const opts = { productionUrls: [prodPooler, prodDirect], allowedRefs: [DEV_REF] };

const fails = (url: string | undefined, o = opts) =>
  expect(() => assertSafeTestDatabaseUrl(url, o)).toThrow(UnsafeTestDatabaseError);

describe('test database guard', () => {
  it('fails when TEST_DATABASE_URL is missing or empty', () => {
    fails(undefined);
    fails('   ');
  });

  it('fails when the target equals a production URL', () => {
    fails(prodDirect, { productionUrls: [prodDirect], allowedRefs: [PROD_REF] });
  });

  it('fails when the target is the production Supabase project, even if allowlisted', () => {
    fails(`postgresql://postgres.${PROD_REF}:other@aws-1-eu-central-1.pooler.supabase.com:5432/postgres`, {
      productionUrls: [prodPooler],
      allowedRefs: [PROD_REF],
    });
  });

  it('fails for a remote database that is not allowlisted', () => {
    fails(`postgresql://postgres.cccccccccccccccccccc:x@aws-1-eu-central-1.pooler.supabase.com:5432/postgres`);
    fails('postgresql://user:x@db.example.com:5432/app_test');
  });

  it('fails for a local database whose name does not end with _test', () => {
    fails('postgresql://postgres:x@localhost:5432/postgres');
    fails('postgresql://postgres:x@127.0.0.1:5432/mashtelot');
  });

  it('fails for non-postgres or malformed URLs', () => {
    fails('mysql://root:x@localhost/app_test');
    fails('not a url');
  });

  it('accepts a local *_test database', () => {
    expect(assertSafeTestDatabaseUrl('postgresql://postgres:x@localhost:5432/mashtelot_test', opts)).toBe(
      'local:mashtelot_test',
    );
  });

  it('accepts an explicitly allowlisted dev Supabase project', () => {
    expect(
      assertSafeTestDatabaseUrl(
        `postgresql://postgres.${DEV_REF}:x@aws-1-eu-central-1.pooler.supabase.com:5432/postgres`,
        opts,
      ),
    ).toBe(`supabase:${DEV_REF}`);
  });

  it('never echoes the password in errors', () => {
    try {
      assertSafeTestDatabaseUrl('postgresql://u:TOPSECRET@db.example.com:5432/x', opts);
    } catch (e) {
      expect(String((e as Error).message)).not.toContain('TOPSECRET');
    }
  });

  it('parses the allowlist', () => {
    expect(parseAllowedRefs(' a , ,b')).toEqual(['a', 'b']);
    expect(parseAllowedRefs(undefined)).toEqual([]);
  });
});
