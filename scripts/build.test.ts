import { describe, expect, it } from 'vitest';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { planBuild, PRODUCTION_SUPABASE_REF } = require('./build');

const PROD = `postgresql://postgres.${PRODUCTION_SUPABASE_REF}:x@aws-0-eu-central-1.pooler.supabase.com:6543/postgres`;
const PROD_DIRECT = `postgresql://postgres.${PRODUCTION_SUPABASE_REF}:x@aws-0-eu-central-1.pooler.supabase.com:5432/postgres`;
const DEV = 'postgresql://postgres.bbbbbbbbbbbbbbbbbbbb:x@aws-1-eu-central-1.pooler.supabase.com:5432/postgres';
const LOCAL = 'postgresql://postgres:x@localhost:5432/mashtelot_test';

describe('C-P0-05 build / migration path', () => {
  it('production: migrates and builds when pointing at the production project', () => {
    expect(
      planBuild({ VERCEL_ENV: 'production', DATABASE_URL: PROD, DIRECT_URL: PROD_DIRECT }).steps,
    ).toEqual(['generate', 'migrate', 'next']);
  });

  it('production: refuses a non-production database (misconfiguration)', () => {
    expect(() => planBuild({ VERCEL_ENV: 'production', DATABASE_URL: DEV, DIRECT_URL: DEV })).toThrow();
    expect(() => planBuild({ VERCEL_ENV: 'production', DATABASE_URL: PROD, DIRECT_URL: DEV })).toThrow();
    expect(() => planBuild({ VERCEL_ENV: 'production' })).toThrow();
  });

  it('preview: refuses the production database, even if only one of the URLs points there', () => {
    expect(() => planBuild({ VERCEL_ENV: 'preview', DATABASE_URL: PROD, DIRECT_URL: PROD_DIRECT })).toThrow(/Preview/);
    expect(() => planBuild({ VERCEL_ENV: 'preview', DATABASE_URL: DEV, DIRECT_URL: PROD_DIRECT })).toThrow(/Preview/);
  });

  it('preview: migrates the development database', () => {
    expect(planBuild({ VERCEL_ENV: 'preview', DATABASE_URL: DEV, DIRECT_URL: DEV }).steps).toEqual([
      'generate',
      'migrate',
      'next',
    ]);
  });

  it('local: never migrates; refuses production unless explicitly allowed', () => {
    expect(planBuild({ DATABASE_URL: LOCAL }).steps).toEqual(['generate', 'next']);
    expect(() => planBuild({ DATABASE_URL: PROD })).toThrow(/ALLOW_PRODUCTION_DB_BUILD/);
    expect(planBuild({ DATABASE_URL: PROD, ALLOW_PRODUCTION_DB_BUILD: '1' }).steps).toEqual(['generate', 'next']);
  });
});
