/**
 * בניית האפליקציה עם מסלול מיגרציות מבוקר (C-P0-05, אפיון §1.05, §22.07, §23.02).
 *
 * VERCEL_ENV=production → prisma generate + migrate deploy + next build.
 *     בדיקת שפיות: בסיס הנתונים חייב להיות פרויקט ה-Production.
 * VERCEL_ENV=preview    → נכשל אם בסיס הנתונים הוא Production (Preview לא נוגע בנתונים חיים);
 *     אחרת migrate deploy לבסיס הפיתוח + build.
 * כל השאר (build מקומי) → ללא מיגרציות. נכשל מול Production, כי ה-prerender קורא ממנו,
 *     אלא אם ALLOW_PRODUCTION_DB_BUILD=1 הוגדר במפורש.
 *
 * מזהה פרויקט ה-Production אינו סוד (מופיע בכתובות התמונות הציבוריות).
 */
const { execFileSync } = require('child_process');
const path = require('path');
const { describeTarget } = require('./seed-guard');

const PRODUCTION_SUPABASE_REF = 'wkcumchuuhmaonrjuvsz';
const ROOT = path.resolve(__dirname, '..');

function refsOf(env) {
  return ['DATABASE_URL', 'DIRECT_URL']
    .filter((k) => env[k])
    .map((k) => ({ key: k, ...describeTarget(env[k]) }));
}

/** החלטת המסלול — טהורה, לבדיקה. מחזירה את השלבים או זורקת עם הסבר. */
function planBuild(env) {
  const vercelEnv = env.VERCEL_ENV || 'local';
  const targets = refsOf(env);
  const touchesProd = targets.some((t) => t.ref === PRODUCTION_SUPABASE_REF);

  if (vercelEnv === 'production') {
    if (!targets.length || targets.some((t) => t.ref !== PRODUCTION_SUPABASE_REF)) {
      throw new Error(
        `Production build: DATABASE_URL/DIRECT_URL חייבים להצביע לפרויקט ה-Production (${PRODUCTION_SUPABASE_REF})`,
      );
    }
    return { label: 'production', steps: ['generate', 'migrate', 'next'] };
  }

  if (vercelEnv === 'preview') {
    if (touchesProd) {
      throw new Error(
        'Preview build מצביע לבסיס הנתונים של Production — נחסם. ' +
          'הגדירו ב-Vercel ל-Preview את DATABASE_URL/DIRECT_URL של mashtelot-dev.',
      );
    }
    if (!targets.length) throw new Error('Preview build: DATABASE_URL לא מוגדר');
    return { label: `preview → ${targets[0].ref || targets[0].host}`, steps: ['generate', 'migrate', 'next'] };
  }

  if (touchesProd && env.ALLOW_PRODUCTION_DB_BUILD !== '1') {
    throw new Error(
      'build מקומי מצביע לבסיס הנתונים של Production (ה-prerender קורא ממנו) — נחסם. ' +
        'הפנו את DATABASE_URL לבסיס פיתוח, או הגדירו ALLOW_PRODUCTION_DB_BUILD=1 במפורש.',
    );
  }
  return { label: 'local (ללא מיגרציות)', steps: ['generate', 'next'] };
}

function run(cmd, args) {
  execFileSync(process.execPath, [path.join(ROOT, cmd), ...args], { cwd: ROOT, stdio: 'inherit' });
}

function main() {
  // build מקומי: טוענים את .env רק כדי לבדוק את היעד (Next/Prisma טוענים אותו ממילא)
  if (!process.env.VERCEL_ENV) require('dotenv').config({ path: path.join(ROOT, '.env') });
  const plan = planBuild(process.env);
  console.log(`[build] מסלול: ${plan.label} · שלבים: ${plan.steps.join(' → ')}`);
  for (const step of plan.steps) {
    if (step === 'generate') run('node_modules/prisma/build/index.js', ['generate']);
    if (step === 'migrate') run('node_modules/prisma/build/index.js', ['migrate', 'deploy']);
    if (step === 'next') run('node_modules/next/dist/bin/next', ['build']);
  }
}

if (require.main === module) {
  try {
    main();
  } catch (e) {
    console.error(`[build] ${e.message}`);
    process.exit(1);
  }
}

module.exports = { planBuild, PRODUCTION_SUPABASE_REF };
