/**
 * רץ פעם אחת לפני סוויטת בדיקות ה-DB: מאמת שהיעד הוא סביבת בדיקות, ואז מאפס את
 * הסכמה ומריץ את כל המיגרציות עליו (`prisma migrate reset`). אם השומר נכשל — שום
 * פקודה לא נשלחת לבסיס נתונים כלשהו.
 */
import { execFileSync } from 'child_process';
import path from 'path';
import { resolveTestDatabase, prismaEnvFor } from './env';

export default function globalSetup() {
  const db = resolveTestDatabase();
  console.log(`[test-db] יעד בדיקות מאומת: ${db.label} — מאפס סכמה ומריץ מיגרציות`);

  const root = path.resolve(__dirname, '..', '..');
  const prismaBin = path.join(root, 'node_modules', 'prisma', 'build', 'index.js');
  execFileSync(
    process.execPath,
    [prismaBin, 'migrate', 'reset', '--force', '--skip-seed', '--skip-generate'],
    {
      cwd: root,
      stdio: 'inherit',
      env: { ...process.env, ...prismaEnvFor(db) },
    },
  );
}
