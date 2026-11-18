/**
 * ייבוא "כרטיסי ברכה קטנים" לבית הדפוס (2026-11-19, באישור הבעלים): קטגוריה "כרטיסי ברכה" ותת-קטגוריה
 * "כרטיסי ברכה קטנים", מוצר דפוס עם מאגר דוגמאות, ו-112 דוגמאות מהקובץ data/greeting-cards-small.csv.
 *
 *   npx vite-node -c vitest.config.ts scripts/import-greeting-cards.ts                 # dry-run (ברירת מחדל)
 *   npx vite-node -c vitest.config.ts scripts/import-greeting-cards.ts -- --write      # כתיבה (יעד מקומי)
 *   ... -- --write --confirm-target=<supabase-ref>                                       # יעד שאינו מקומי
 *
 * התמונות יורדות מהאחסון המקורי (base44) ונשמרות ב-Supabase Storage שלנו (bucket "uploads",
 * תיקייה print-designs/), בשם קבוע לפי הקוד — הרצה חוזרת דורסת את אותו קובץ ולא יוצרת כפילויות.
 * הדוגמאות נכנסות לפי קוד (upsert). דוגמא שכבר קיימת: מתעדכנים השם, התמונה והתגיות, לא הסדר והסטטוס
 * (כדי לא לדרוס עריכה ידנית). המוצר והקטגוריות נוצרים רק אם אינם קיימים.
 *
 * דורש: DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 */
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { describeTarget } from './seed-guard';
import { parseCardsCsv, type CsvDesign } from '@/lib/print-designs-csv';
import { GREETING_CARDS_RULE } from '@/lib/print-designs';
import { publishDraft, saveDraft } from '@/lib/print-templates-admin';

const args = process.argv.slice(2);
const WRITE = args.includes('--write');
const CSV = join(__dirname, '..', 'data', 'greeting-cards-small.csv');
const ACTOR = 'import-greeting-cards';

const PARENT = { slug: 'greeting-cards', name: 'כרטיסי ברכה' };
const CHILD = { slug: 'greeting-cards-small', name: 'כרטיסי ברכה קטנים' };
const PRODUCT_SLUG = 'greeting-cards-small';
// מדף הקטגוריה באתר המקורי (yanivsharabi.com/category/greeting-cards-small)
const COVER_URL = 'https://base44.app/api/apps/69fc81e6142a2a23589c415d/files/mp/public/69fc81e6142a2a23589c415d/e9300f468_3b6af24c-7661-4f45-b3d3-affe46f87bfe.jfif';
const DESCRIPTION = [
  'כרטיסי ברכה קטנים עם הלוגו ופרטי העסק שלכם.',
  'גודל כרטיס סגור: 6/8 ס"מ · פתוח: 12/8 ס"מ.',
  'מזמינים בכפולות של 8 דוגמאות: 8 דוגמאות של 400 כרטיסים, או 16 דוגמאות ומעלה של 200 כרטיסים מכל דוגמא.',
  'אפשר לקבל את הכרטיסים בעברית או ברוסית (ציינו בהערות). כל המחירים לפני מע"מ.',
].join('\n');

const FIELDS = [
  {
    key: 'business_details',
    label: 'פרטי העסק להדפסה על הכרטיס',
    type: 'textarea',
    required: true,
    maxLength: 500,
    help: 'שם העסק, טלפון, כתובת או אתר — כפי שיודפסו לצד הלוגו',
  },
];
// 0.40 ₪ לכרטיס לפני מע"מ (200 יח' = 80 ₪, 400 יח' = 160 ₪)
const PRICING = { basePrice: 0.4, tiers: [], setupFee: 0, minQuantity: 1, quoteOnly: false, quantityOptions: [], allowCustomQuantity: true };

const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

function log(...m: unknown[]) {
  console.log(WRITE ? '' : '[dry-run]', ...m);
}

function sniffImage(b: Buffer): string | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
  return null;
}

function storage() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const raw = process.env.SUPABASE_URL;
  if (!key || !raw) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY חסרים');
  return { baseUrl: new URL(raw).origin, key };
}

/** מוריד את התמונה המקורית ומעלה לאחסון שלנו בשם קבוע לפי הקוד. מחזיר את הכתובת הציבורית. */
async function copyImage(d: Pick<CsvDesign, 'code' | 'imageUrl'>, cfg: { baseUrl: string; key: string }): Promise<string> {
  const src = await fetch(d.imageUrl, { signal: AbortSignal.timeout(30_000) });
  if (!src.ok) throw new Error(`${d.code}: הורדת התמונה נכשלה (${src.status})`);
  const body = Buffer.from(await src.arrayBuffer());
  // הסוג לפי התוכן (קובץ .jfif מוגש כ-octet-stream), ואם לא זוהה — לפי הכותרת
  const type = sniffImage(body) ?? (src.headers.get('content-type') ?? '').split(';')[0]!.trim();
  const ext = EXT[type];
  if (!ext) throw new Error(`${d.code}: סוג תמונה לא נתמך (${type})`);
  if (body.length > 10 * 1024 * 1024) throw new Error(`${d.code}: התמונה גדולה מ-10MB`);
  const path = `print-designs/greeting-cards-small/${d.code.toLowerCase()}.${ext}`;
  const up = await fetch(`${cfg.baseUrl}/storage/v1/object/uploads/${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.key}`, apikey: cfg.key, 'Content-Type': type, 'Cache-Control': 'max-age=31536000', 'x-upsert': 'true' },
    body,
    signal: AbortSignal.timeout(30_000),
  });
  if (!up.ok) throw new Error(`${d.code}: העלאה לאחסון נכשלה (${up.status}) ${await up.text().catch(() => '')}`);
  return `${cfg.baseUrl}/storage/v1/object/public/uploads/${path}`;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL לא מוגדרת');
  const target = describeTarget(url);
  if (WRITE && !target.local && !args.includes(`--confirm-target=${target.ref}`)) {
    throw new Error(`יעד supabase:${target.ref ?? target.host} אינו מקומי — נדרש --confirm-target=${target.ref}`);
  }
  log('יעד:', target.local ? `local:${target.host}` : `supabase:${target.ref}`);

  const parsed = parseCardsCsv(readFileSync(CSV, 'utf8'));
  log(`בקובץ ${parsed.designs.length} דוגמאות אחרי ניקוי.`);
  for (const n of parsed.notes) log(' •', n);

  const db = new PrismaClient({ log: ['warn', 'error'] });
  try {
    // קטגוריות
    let parent = await db.printCategory.findUnique({ where: { slug: PARENT.slug } });
    log(parent ? `קטגוריה "${PARENT.name}" קיימת` : `נוצרת קטגוריה "${PARENT.name}"`);
    if (!parent && WRITE) parent = await db.printCategory.create({ data: { ...PARENT, sortOrder: 0 } });
    let child = await db.printCategory.findUnique({ where: { slug: CHILD.slug } });
    log(child ? `תת-קטגוריה "${CHILD.name}" קיימת` : `נוצרת תת-קטגוריה "${CHILD.name}"`);
    if (!child && WRITE) child = await db.printCategory.create({ data: { ...CHILD, parentId: parent!.id, sortOrder: 0 } });

    // המוצר
    let template = await db.printTemplate.findUnique({ where: { slug: PRODUCT_SLUG } });
    const created = !template;
    const designsBefore = template ? await db.printDesign.count({ where: { templateId: template.id } }) : 0;
    log(template ? `המוצר "${CHILD.name}" קיים — לא משתנה` : `נוצר המוצר "${CHILD.name}" עם גרסה מפורסמת (0.40 ₪ לכרטיס)`);
    if (!template && WRITE) {
      template = await db.printTemplate.create({
        data: {
          title: CHILD.name,
          slug: PRODUCT_SLUG,
          description: DESCRIPTION,
          unitLabel: 'כרטיס',
          leadTimeDays: 7,
          requiresArtwork: true,
          isActive: false,
          categoryId: child!.id,
          designRule: { ...GREETING_CARDS_RULE },
          versions: { create: { version: 1, status: 'DRAFT', fields: [], pricing: PRICING, createdBy: ACTOR } },
        },
      });
      const saved = await saveDraft(db, template.id, { fields: FIELDS, pricing: PRICING, production: null, notes: 'ייבוא כרטיסי ברכה קטנים' });
      if (!saved.ok) throw new Error(`שמירת הטיוטה נכשלה: ${saved.errors.join(', ')}`);
      const pub = await publishDraft(db, template.id, ACTOR);
      if (!pub.ok) throw new Error(`הפרסום נכשל: ${pub.errors.join(', ')}`);
    }

    // דוגמאות
    const existing = template ? await db.printDesign.findMany({ where: { templateId: template.id }, select: { code: true } }) : [];
    const have = new Set(existing.map((e) => e.code));
    log(`דוגמאות: ${parsed.designs.filter((d) => !have.has(d.code)).length} חדשות, ${parsed.designs.filter((d) => have.has(d.code)).length} לעדכון.`);
    if (!WRITE) return;

    const cfg = storage();
    let firstImage: string | null = null;
    let done = 0;
    const failed: string[] = [];
    const queue = [...parsed.designs];
    // 4 במקביל, כדי לא להעמיס על האחסון המקורי
    await Promise.all(
      Array.from({ length: 4 }, async () => {
        for (let d = queue.shift(); d; d = queue.shift()) {
          try {
            const imageUrl = await copyImage(d, cfg);
            await db.printDesign.upsert({
              where: { templateId_code: { templateId: template!.id, code: d.code } },
              create: { templateId: template!.id, code: d.code, title: d.title, imageUrl, tags: d.tags, sortOrder: d.sortOrder, isActive: d.isActive },
              update: { title: d.title, imageUrl, tags: d.tags },
            });
            if (d === parsed.designs[0]) firstImage = imageUrl;
            done += 1;
            if (done % 20 === 0) log(`  ${done}/${parsed.designs.length}`);
          } catch (e) {
            failed.push(e instanceof Error ? e.message : String(e));
          }
        }
      }),
    );
    log(`נשמרו ${done} דוגמאות.`);
    if (failed.length) {
      console.error(`נכשלו ${failed.length}:`);
      for (const f of failed) console.error(' •', f);
    }

    // תמונה למוצר ולקטגוריות, אם אין: תמונת הקטגוריה מהאתר המקורי, ואם נכשלה — הדוגמא הראשונה
    let cover: string | null = null;
    try {
      cover = await copyImage({ code: 'cover', imageUrl: COVER_URL }, cfg);
    } catch (e) {
      console.error('תמונת הקטגוריה:', e instanceof Error ? e.message : e);
      cover = firstImage ?? (await db.printDesign.findFirst({ where: { templateId: template!.id }, orderBy: { sortOrder: 'asc' } }))?.imageUrl ?? null;
    }
    if (cover) {
      await db.printTemplate.updateMany({ where: { id: template!.id, imageUrl: null }, data: { imageUrl: cover } });
      await db.printCategory.updateMany({ where: { id: { in: [parent!.id, child!.id] }, imageUrl: null }, data: { imageUrl: cover } });
    }
    // ייבוא ראשון (מוצר חדש, או מוצר שנוצר בהרצה שנכשלה ועדיין אין בו דוגמאות): מוצג למשתלות רק כשהכול הצליח.
    // מוצר שכבר יובא — הסטטוס שלו לא משתנה.
    const firstImport = created || designsBefore === 0;
    if (firstImport && !failed.length) {
      await db.printTemplate.update({ where: { id: template!.id }, data: { isActive: true } });
      log('המוצר מוצג למשתלות בבית הדפוס.');
    } else if (firstImport) {
      log('המוצר נשאר מוסתר עד שכל הדוגמאות ייובאו — הריצו שוב.');
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
