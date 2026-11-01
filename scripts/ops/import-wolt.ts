/**
 * ייבוא החנות של המשתלה מוולט: אותן קטגוריות ואותם מוצרים, עם התמונות מועלות לאחסון שלנו.
 * באישור הבעלים (2026-11-01): מחיר וולט, המוצרים נכנסים **לא פעילים** לבדיקה.
 *
 *   npx vite-node -c vitest.config.ts scripts/ops/import-wolt.ts -- --nursery=baitvagan --venue=home-garden-nursery-beer-yaakov [--dry-run] [--confirm-production=baitvagan]
 *
 * - קטגוריה בשם זהה שכבר קיימת במשתלה (מארזים, מוצרי גינון) — משתמשים בה; אחרת נוצרת קטגוריה ראשית
 * - מוצר שכבר קיים באותו שם — מדלגים (הרצה חוזרת בטוחה)
 * - תמונות: אחת-אחת, השהיה של 1.5 שניות, ניסיונות חוזרים; נתיב קבוע wolt/<nursery>/<item>
 */
import { PrismaClient } from '@prisma/client';
import { downloadImage, requireTargetConfirmation, sleep, uploadToStorage } from './storage';

const args = process.argv.slice(2);
const arg = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
const DRY = args.includes('--dry-run');
const SUBDOMAIN = arg('nursery') || 'baitvagan';
const VENUE = arg('venue') || 'home-garden-nursery-beer-yaakov';
const DELAY_MS = 1_500;

/** slug באנגלית לקטגוריות וולט (שם בעברית כמו בוולט, בלי אימוג׳י) */
const CATEGORY_SLUGS: Record<string, string> = {
  'שולחים מתנה?': 'gifts',
  מארזים: 'maarazim',
  זרים: 'bouquets',
  'כרטיסים וקישוטים': 'cards-decorations',
  'באנצ׳ים': 'bunches',
  עציצים: 'potted-plants',
  'צמחים לתלייה': 'hanging-plants',
  'שוקולד ומתוקים': 'chocolate-sweets',
  'מוצרי גינון': 'garden-supplies',
  'זרעים ופקעות': 'seeds-bulbs',
  'אדניות ומיכלי שתילה': 'planters',
};

interface WoltItem {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  images?: Array<{ url: string }>;
}
interface WoltCategory {
  id: string;
  name: string;
  item_ids: string[];
  subcategories?: WoltCategory[];
}

/** בלי סימני כיווון ואימוג׳י, רווחים מנורמלים */
function clean(s: string | null | undefined): string {
  return (s ?? '')
    .replace(/[‎‏‪-‮⁦-⁩]/g, '')
    .replace(/\p{Extended_Pictographic}|️/gu, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .trim();
}

async function main() {
  const target = requireTargetConfirmation(args, SUBDOMAIN);
  console.log(`יעד: ${target.label}${DRY ? ' (dry-run — בלי כתיבה)' : ''}`);

  const res = await fetch(`https://consumer-api.wolt.com/consumer-api/consumer-assortment/v1/venues/slug/${VENUE}/assortment`, {
    headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'he' },
  });
  if (!res.ok) throw new Error(`וולט החזירה ${res.status}`);
  const data = (await res.json()) as { categories: WoltCategory[]; items: WoltItem[] };
  const items = new Map(data.items.map((i) => [i.id, i]));
  const categories = data.categories.flatMap((c) => [c, ...(c.subcategories ?? [])]).filter((c) => c.item_ids.length > 0);
  console.log(`וולט: ${categories.length} קטגוריות, ${items.size} מוצרים`);

  const db = new PrismaClient();
  try {
    const nursery = await db.nursery.findUniqueOrThrow({ where: { subdomain: SUBDOMAIN }, select: { id: true, name: true } });
    console.log(`משתלה: ${nursery.name}`);

    // קטגוריות
    const existingCats = await db.nurseryCategory.findMany({ where: { nurseryId: nursery.id } });
    const maxSort = existingCats.filter((c) => !c.parentId).reduce((m, c) => Math.max(m, c.sortOrder), 0);
    const catIdByWolt = new Map<string, string>();
    for (const [i, c] of categories.entries()) {
      const name = clean(c.name);
      const found = existingCats.find((x) => x.name === name);
      if (found) {
        catIdByWolt.set(c.id, found.id);
        console.log(`  קטגוריה קיימת: ${name}`);
        continue;
      }
      let slug = CATEGORY_SLUGS[name] ?? `wolt-${c.id.slice(0, 8)}`;
      if (existingCats.some((x) => x.slug === slug)) slug = `${slug}-wolt`;
      console.log(`  קטגוריה חדשה: ${name} (${slug})`);
      if (DRY) {
        catIdByWolt.set(c.id, `dry-${c.id}`);
        continue;
      }
      const created = await db.nurseryCategory.create({ data: { nurseryId: nursery.id, name, slug, sortOrder: maxSort + 1 + i } });
      existingCats.push(created);
      catIdByWolt.set(c.id, created.id);
    }

    // מוצרים (מוצר יכול להופיע בכמה קטגוריות)
    const catsOfItem = new Map<string, string[]>();
    for (const c of categories) for (const id of c.item_ids) catsOfItem.set(id, [...(catsOfItem.get(id) ?? []), catIdByWolt.get(c.id)!]);

    const existingTitles = new Set(
      (await db.nurseryProduct.findMany({ where: { nurseryId: nursery.id, customTitle: { not: null } }, select: { customTitle: true } })).map((p) => p.customTitle!),
    );
    let created = 0;
    let skipped = 0;
    const failures: string[] = [];
    for (const [id, item] of items) {
      const title = clean(item.name);
      if (!title || existingTitles.has(title)) {
        skipped++;
        continue;
      }
      const price = (item.price / 100).toFixed(2);
      const description = clean(item.description) || null;
      const imageUrl = item.images?.[0]?.url;
      if (DRY) {
        console.log(`  + ${title} · ₪${price}${imageUrl ? '' : ' · ללא תמונה'} · ${catsOfItem.get(id)?.length ?? 0} קטגוריות`);
        created++;
        continue;
      }
      let customImageUrl: string | null = null;
      if (imageUrl) {
        try {
          customImageUrl = await uploadToStorage(`wolt/${SUBDOMAIN}/${id}`, await downloadImage(imageUrl, 'https://wolt.com/'));
        } catch (e) {
          failures.push(`${title}: ${e instanceof Error ? e.message : e}`);
        }
        await sleep(DELAY_MS);
      }
      await db.nurseryProduct.create({
        data: {
          nurseryId: nursery.id,
          customTitle: title,
          customDescription: description,
          customImageUrl,
          price,
          stockQuantity: 0,
          isActive: false,
          categories: { create: [...new Set(catsOfItem.get(id) ?? [])].map((nurseryCategoryId) => ({ nurseryCategoryId })) },
        },
      });
      existingTitles.add(title);
      created++;
      console.log(`  ✓ ${title}${customImageUrl ? '' : ' (בלי תמונה)'}`);
    }
    console.log(`\nנוצרו ${created}, דולגו ${skipped} (קיימים)`);
    if (failures.length) console.log(`תמונות שנכשלו (${failures.length}):\n  ${failures.join('\n  ')}`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
