/**
 * העתקת תמונות הקטלוג המרכזי שנטענות מאתרים חיצוניים (סלונר, מלצר) לאחסון שלנו,
 * וסימונן "תמונה לעדכון" (plants.image_needs_update) — באישור הבעלים (2026-11-01).
 *
 *   npx vite-node -c vitest.config.ts scripts/ops/migrate-catalog-images.ts -- [--dry-run] [--limit=N] [--confirm-production=catalog]
 *
 * - קצב מבוקר: תמונה אחת כל 1.5 שניות לכל אתר, ניסיונות חוזרים; עצירה והמשך — רק מה שעדיין חיצוני
 * - גרסאות הקטלוג (catalog_revisions) מתעדכנות לאותה כתובת באותה טרנזקציה, כך שה-trigger לא יוצר
 *   גרסה חדשה והמשתלות לא מקבלות "עדכון מהקטלוג" על החלפת כתובת בלבד
 */
import { PrismaClient } from '@prisma/client';
import { downloadImage, requireTargetConfirmation, sleep, uploadToStorage } from './storage';

const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const LIMIT = Number(args.find((a) => a.startsWith('--limit='))?.split('=')[1]) || Infinity;
const HOSTS = ['sloner.co.il', 'www.meltser.co.il', 'meltser.co.il'];
const DELAY_MS = 1_500;

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

async function main() {
  const target = requireTargetConfirmation(args, 'catalog');
  console.log(`יעד: ${target.label}${DRY ? ' (dry-run — בלי כתיבה)' : ''}`);

  const db = new PrismaClient();
  try {
    const plants = (
      await db.plant.findMany({ where: { imageUrl: { not: null } }, select: { id: true, hebrewName: true, imageUrl: true }, orderBy: { hebrewName: 'asc' } })
    ).filter((p) => HOSTS.includes(hostOf(p.imageUrl!) ?? ''));
    const byHost = plants.reduce<Record<string, number>>((m, p) => ((m[hostOf(p.imageUrl!)!] = (m[hostOf(p.imageUrl!)!] ?? 0) + 1), m), {});
    console.log(`תמונות חיצוניות: ${plants.length}`, byHost);
    if (DRY) return;

    // סירוגין בין האתרים — כל אתר מקבל בקשה לכל היותר פעם ב-DELAY_MS*2
    const queues = HOSTS.map((h) => plants.filter((p) => hostOf(p.imageUrl!) === h));
    const ordered: typeof plants = [];
    for (let i = 0; ordered.length < plants.length; i++) for (const q of queues) if (q[i]) ordered.push(q[i]!);

    let done = 0;
    const failures: string[] = [];
    for (const p of ordered.slice(0, LIMIT)) {
      const oldUrl = p.imageUrl!;
      const host = hostOf(oldUrl)!;
      try {
        const file = await downloadImage(oldUrl, `https://${host}/`);
        const newUrl = await uploadToStorage(`catalog/plants/${p.id}`, file);
        await db.$transaction(async (tx) => {
          await tx.$executeRaw`
            UPDATE catalog_revisions SET data = jsonb_set(data, '{imageUrl}', to_jsonb(${newUrl}::text))
            WHERE plant_id = ${p.id} AND data->>'imageUrl' = ${oldUrl}`;
          await tx.plant.update({ where: { id: p.id }, data: { imageUrl: newUrl, imageNeedsUpdate: true } });
        });
        done++;
        if (done % 25 === 0) console.log(`  ${done}/${Math.min(ordered.length, LIMIT)}`);
      } catch (e) {
        failures.push(`${p.hebrewName} (${oldUrl}): ${e instanceof Error ? e.message : e}`);
      }
      await sleep(DELAY_MS);
    }
    console.log(`\nהועתקו ${done}, נכשלו ${failures.length}`);
    if (failures.length) console.log(`  ${failures.join('\n  ')}`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
