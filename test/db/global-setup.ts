/**
 * רץ פעם אחת לפני סוויטת בדיקות ה-DB: מאמת שהיעד הוא סביבת בדיקות, ואז מכין סכמה.
 * - יעד מקומי (`local:*_test`): `prisma migrate reset` — סכמה נקייה בכל ריצה.
 * - יעד Supabase מאושר (`supabase:<ref>`): `prisma migrate deploy` בלבד. reset על Supabase
 *   מוחק את סכמת public יחד עם ה-grants וה-default privileges שלה (anon/authenticated),
 *   וזה בדיוק מה שבדיקות ה-RLS צריכות לבחון כפי שהוא בפרודקשן.
 * אם השומר נכשל — שום פקודה לא נשלחת לבסיס נתונים כלשהו.
 */
import { execFileSync } from 'child_process';
import path from 'path';
import { resolveTestDatabase, prismaEnvFor } from './env';

export default function globalSetup() {
  const db = resolveTestDatabase();
  const isLocal = db.label.startsWith('local:');
  const args = isLocal
    ? ['migrate', 'reset', '--force', '--skip-seed', '--skip-generate']
    : ['migrate', 'deploy'];
  console.log(
    `[test-db] יעד בדיקות מאומת: ${db.label} — ${isLocal ? 'מאפס סכמה ומריץ מיגרציות' : 'מריץ מיגרציות חדשות בלבד (deploy)'}`,
  );

  const root = path.resolve(__dirname, '..', '..');
  const prismaBin = path.join(root, 'node_modules', 'prisma', 'build', 'index.js');
  execFileSync(process.execPath, [prismaBin, ...args], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, ...prismaEnvFor(db) },
  });
}
