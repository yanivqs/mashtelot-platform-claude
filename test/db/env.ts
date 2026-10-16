/**
 * פתרון ואימות בסיס הנתונים לבדיקות. משמש גם את ה-globalSetup (reset של הסכמה)
 * וגם את ה-setup של כל worker. לעולם לא טוען את `.env` לתוך process.env —
 * קורא אותו רק כדי לדעת אילו כתובות Production אסור לגעת בהן.
 */
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { assertSafeTestDatabaseUrl, parseAllowedRefs } from '../../lib/test-db-guard';

const ROOT = path.resolve(__dirname, '..', '..');

function readEnvFile(name: string): Record<string, string> {
  const file = path.join(ROOT, name);
  return fs.existsSync(file) ? dotenv.parse(fs.readFileSync(file)) : {};
}

export interface TestDatabase {
  url: string;
  /** תיאור ללא סיסמה, להדפסה */
  label: string;
}

export function resolveTestDatabase(): TestDatabase {
  const prod = readEnvFile('.env');
  const test = readEnvFile('.env.test');
  const url = process.env.TEST_DATABASE_URL ?? test.TEST_DATABASE_URL;
  const label = assertSafeTestDatabaseUrl(url, {
    productionUrls: [prod.DATABASE_URL, prod.DIRECT_URL],
    allowedRefs: parseAllowedRefs(process.env.TEST_DB_ALLOWED_REFS ?? test.TEST_DB_ALLOWED_REFS),
  });
  return { url: url!.trim(), label };
}

/** משתני הסביבה ש-Prisma (CLI ו-Client) צריכים כדי לעבוד מול בסיס הבדיקות בלבד. */
export function prismaEnvFor(db: TestDatabase): Record<string, string> {
  return { DATABASE_URL: db.url, DIRECT_URL: db.url };
}
