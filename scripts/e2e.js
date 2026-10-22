/**
 * הרצת בדיקות E2E בדפדפן (Playwright) מול האפליקציה הבנויה ובסיס בדיקות מקומי בלבד.
 *
 *   npm run test:e2e                 — מיגרציות → build → playwright test
 *   E2E_SKIP_BUILD=1 npm run test:e2e — בלי build (כשה-build כבר עדכני)
 *
 * הבדיקות יוצרות נתונים, ולכן מותר להריץ רק מול Postgres מקומי ששמו מסתיים ב-`_test`
 * (כמו בדיקות ה-DB; ראו lib/test-db-guard.ts). לעולם לא מול Supabase / Production.
 */
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');

function readEnvFile(name) {
  const file = path.join(ROOT, name);
  if (!fs.existsSync(file)) return {};
  return require('dotenv').parse(fs.readFileSync(file));
}

function assertLocalTestDb(raw, prodUrls) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('[e2e] TEST_DATABASE_URL חסרה או אינה כתובת תקינה');
  }
  const local = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(url.hostname);
  const db = url.pathname.replace(/^\//, '');
  if (!local || !db.endsWith('_test')) {
    throw new Error('[e2e] מותר להריץ רק מול Postgres מקומי ששמו מסתיים ב-_test');
  }
  if (prodUrls.filter(Boolean).some((p) => p.trim() === raw.trim())) {
    throw new Error('[e2e] כתובת הבדיקות זהה לכתובת ה-Production — נעצר');
  }
}

const testEnv = readEnvFile('.env.test');
const prodEnv = readEnvFile('.env');
const testUrl = process.env.TEST_DATABASE_URL || testEnv.TEST_DATABASE_URL;
assertLocalTestDb(testUrl, [prodEnv.DATABASE_URL, prodEnv.DIRECT_URL]);

const env = {
  ...process.env,
  DATABASE_URL: testUrl,
  DIRECT_URL: testUrl,
  AUTH_SECRET: 'e2e-only-secret-not-used-anywhere',
  // מפתח הצפנת MFA לבדיקות בלבד (32 בתים, base64) — לא בשימוש בשום סביבה אחרת
  // §21: סוד משימות הרקע לבדיקות בלבד
  CRON_SECRET: 'e2e-only-cron-secret',
  MFA_ENCRYPTION_KEY: Buffer.from('e2e-only-mfa-key-32-bytes-long!!').toString('base64'),
  ROOT_DOMAIN: 'localhost:3100',
  RESEND_API_KEY: '',
  E2E: '1',
};

const run = (cmd, args) => execFileSync(cmd, args, { cwd: ROOT, env, stdio: 'inherit', shell: process.platform === 'win32' });

run('npx', ['prisma', 'migrate', 'deploy']);
if (!process.env.E2E_SKIP_BUILD) run('node', ['scripts/build.js']);
run('npx', ['playwright', 'test', ...process.argv.slice(2)]);
