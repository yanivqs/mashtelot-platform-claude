/**
 * צמחים למשתלת ההדגמה (החלטת בעלים 2026-11-23):
 * - משייך את כל צמחי הקטלוג שתמונתם הגיעה מסלונר (לא מלצר — בתמונות שלהם הלוגו של מלצר, ולא צמחים בלי תמונה),
 *   עם תמונת הקטלוג, מחיר לפי סוג הצמח וקטגוריות הקטלוג המרכזי.
 * - מסתיר (isActive=false) צמחים שכבר משויכים להדגמה ותמונתם ממלצר.
 * - קטגוריה ראשית "קטלוג צמחים": כל הצמחים משויכים אליה, וקטגוריות הצמחים הראשיות (לפי הקטלוג המרכזי)
 *   הופכות לתת-קטגוריות שלה — כך שבלחיצה עליה מוצגים רק צמחים, עם מסנני הצמחים בלבד.
 *
 * מקור התמונה: plants_export.csv (הכתובת המקורית, לפני ההעתקה לאחסון שלנו — scripts/ops/migrate-catalog-images.ts).
 *
 *   npx vite-node -c vitest.config.ts scripts/seed-demo-plants.ts                              # dry-run
 *   ... -- --write --confirm-target=<supabase-ref>                                            # כתיבה
 *
 * אפשר להריץ שוב: צמח שכבר משויך לא נוצר מחדש, ושיוך קטגוריה קיים לא משוכפל.
 */
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { parse } from 'csv-parse/sync';
import { PrismaClient } from '@prisma/client';
import { describeTarget } from './seed-guard';
import { flattenCategoryTree } from '@/lib/category-tree';

const TARGET = 'demo-nursery';
const PARENT = { name: 'קטלוג צמחים', slug: 'plants-catalog' };
const args = process.argv.slice(2);
const WRITE = args.includes('--write');

const log = (...m: unknown[]) => console.log(WRITE ? '' : '[dry-run]', ...m);

/** מחיר לפי סוג הצמח (החלטת בעלים): עונתיים 25, רב-שנתיים ושיחים 45, מטפסים 55, עצים 120, אחר 45 */
export function priceFor(plantType: string | null): number {
  const t = plantType ?? '';
  if (t.includes('עונתי')) return 25;
  if (t.includes('מטפס')) return 55;
  if (t.includes('עץ') || t.includes('עצים') || t.includes('דקל')) return 120;
  return 45;
}

function hostOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL לא מוגדרת');
  const target = describeTarget(url);
  if (WRITE && !target.local && !args.includes(`--confirm-target=${target.ref}`)) {
    throw new Error(`יעד supabase:${target.ref ?? target.host} אינו מקומי — נדרש --confirm-target=${target.ref}`);
  }
  log('יעד:', target.local ? `local:${target.host}` : `supabase:${target.ref}`);

  // מקור כל תמונה לפי הקובץ המקורי
  const rows = parse(readFileSync('plants_export.csv', 'utf8').replace(/^﻿/, ''), { columns: true, relax_quotes: true }) as Array<Record<string, string>>;
  const key = (h: string | null, l: string | null) => `${(h ?? '').trim()}|${(l ?? '').trim().toLowerCase()}`;
  const byName = new Map<string, string | null>();
  const byLegacyId = new Map<string, string | null>();
  for (const r of rows) {
    const h = hostOf(r.image_url);
    byName.set(key(r.hebrew_name, r.latin_name), h);
    if (r.plant_id?.trim()) byLegacyId.set(r.plant_id.trim(), h);
  }

  const db = new PrismaClient({ log: ['warn', 'error'] });
  try {
    const dst = await db.nursery.findUniqueOrThrow({ where: { subdomain: TARGET } });
    const plants = await db.plant.findMany({
      where: { imageUrl: { not: null } },
      select: { id: true, plantId: true, hebrewName: true, latinName: true, imageUrl: true, plantType: true },
    });
    const origin = (p: (typeof plants)[number]) => {
      const own = hostOf(p.imageUrl!);
      if (own && !own.endsWith('supabase.co')) return own;
      return (p.plantId != null ? byLegacyId.get(String(p.plantId)) : undefined) ?? byName.get(key(p.hebrewName, p.latinName)) ?? null;
    };
    const sloner = plants.filter((p) => origin(p) === 'sloner.co.il');
    const meltserIds = new Set(plants.filter((p) => origin(p)?.includes('meltser')).map((p) => p.id));
    log(`צמחי קטלוג עם תמונה מסלונר: ${sloner.length}; ממלצר: ${meltserIds.size}`);

    const existing = await db.nurseryProduct.findMany({
      where: { nurseryId: dst.id, plantId: { not: null } },
      select: { id: true, plantId: true, isActive: true },
    });
    const have = new Map(existing.map((p) => [p.plantId!, p]));

    // ---------- הסתרת צמחים עם תמונה ממלצר ----------
    const toHide = existing.filter((p) => p.isActive && meltserIds.has(p.plantId!));
    log(`צמחים קיימים עם תמונה ממלצר שיוסתרו: ${toHide.length}`);
    if (WRITE && toHide.length) await db.nurseryProduct.updateMany({ where: { id: { in: toHide.map((p) => p.id) } }, data: { isActive: false } });

    // ---------- קטגוריות הקטלוג המרכזי + "קטלוג צמחים" ----------
    const master = await db.plantCategory.findMany({ select: { id: true, name: true, slug: true, parentId: true, sortOrder: true } });
    const masterById = new Map(master.map((m) => [m.id, m]));
    const cats = await db.nurseryCategory.findMany({ where: { nurseryId: dst.id }, select: { id: true, slug: true, parentId: true } });
    const idBySlug = new Map(cats.map((c) => [c.slug, c.id]));
    let parentId = idBySlug.get(PARENT.slug) ?? null;
    if (!parentId) {
      log(`קטגוריה "${PARENT.name}" נוצרת`);
      if (WRITE) {
        const minSort = await db.nurseryCategory.aggregate({ where: { nurseryId: dst.id, parentId: null }, _min: { sortOrder: true } });
        parentId = (await db.nurseryCategory.create({ data: { nurseryId: dst.id, name: PARENT.name, slug: PARENT.slug, sortOrder: (minSort._min.sortOrder ?? 0) - 1 } })).id;
      } else parentId = 'new:parent';
      idBySlug.set(PARENT.slug, parentId);
    }
    let createdCats = 0;
    for (const node of flattenCategoryTree(master)) {
      const m = masterById.get(node.id)!;
      if (idBySlug.has(m.slug)) continue;
      const pSlug = m.parentId ? masterById.get(m.parentId)?.slug : undefined;
      createdCats++;
      const id = WRITE
        ? (await db.nurseryCategory.create({ data: { nurseryId: dst.id, name: m.name, slug: m.slug, sortOrder: m.sortOrder, parentId: pSlug ? (idBySlug.get(pSlug) ?? null) : null } })).id
        : `new:${m.slug}`;
      idBySlug.set(m.slug, id);
    }
    log(`קטגוריות קטלוג חסרות שנוצרו: ${createdCats}`);
    // קטגוריות הצמחים הראשיות עוברות מתחת ל"קטלוג צמחים"
    const topMasterSlugs = master.filter((m) => !m.parentId).map((m) => m.slug);
    const current = await db.nurseryCategory.findMany({ where: { nurseryId: dst.id, slug: { in: topMasterSlugs } }, select: { id: true, parentId: true } });
    const toMove = current.filter((c) => c.parentId !== parentId);
    log(`קטגוריות צמחים שעוברות מתחת ל"${PARENT.name}": ${toMove.length}`);
    if (WRITE && toMove.length) await db.nurseryCategory.updateMany({ where: { id: { in: toMove.map((c) => c.id) } }, data: { parentId } });

    // ---------- שיוך הצמחים ----------
    const assignments = await db.plantCategoryAssignment.findMany({
      where: { plantId: { in: sloner.map((p) => p.id) } },
      select: { plantId: true, category: { select: { slug: true } } },
    });
    const slugsOf = new Map<string, string[]>();
    for (const a of assignments) slugsOf.set(a.plantId, [...(slugsOf.get(a.plantId) ?? []), a.category.slug]);

    const nextSort = new Map<string, number>();
    const sortIn = async (catId: string) => {
      if (!nextSort.has(catId)) {
        const last = WRITE ? await db.nurseryProductCategory.findFirst({ where: { nurseryCategoryId: catId }, orderBy: { sortOrder: 'desc' }, select: { sortOrder: true } }) : null;
        nextSort.set(catId, (last?.sortOrder ?? -1) + 1);
      }
      const v = nextSort.get(catId)!;
      nextSort.set(catId, v + 1);
      return v;
    };

    const priceCount: Record<number, number> = {};
    let created = 0;
    let linked = 0;
    const ordered = [...sloner].sort((a, b) => a.hebrewName.localeCompare(b.hebrewName, 'he'));
    for (const p of ordered) {
      const catIds = [parentId!, ...(slugsOf.get(p.id) ?? []).map((s) => idBySlug.get(s)).filter((x): x is string => Boolean(x))];
      let productId = have.get(p.id)?.id;
      if (!productId) {
        const price = priceFor([p.plantType, ...(slugsOf.get(p.id) ?? [])].filter(Boolean).join(' '));
        priceCount[price] = (priceCount[price] ?? 0) + 1;
        created++;
        if (!WRITE) continue;
        // תמונת הקטלוג משמשת את ההדגמה (imageRequired=false); ה-trigger במסד יוצר וריאנט ברירת מחדל
        productId = (
          await db.nurseryProduct.create({
            data: { nurseryId: dst.id, plantId: p.id, price: price.toFixed(2), stockQuantity: 0, alwaysInStock: true, isActive: true, imageRequired: false },
          })
        ).id;
      }
      if (!WRITE) continue;
      const already = new Set((await db.nurseryProductCategory.findMany({ where: { nurseryProductId: productId }, select: { nurseryCategoryId: true } })).map((x) => x.nurseryCategoryId));
      for (const c of catIds) {
        if (already.has(c)) continue;
        await db.nurseryProductCategory.create({ data: { nurseryProductId: productId, nurseryCategoryId: c, sortOrder: await sortIn(c) } });
        linked++;
      }
    }
    // צמחים קיימים שנשארים פעילים — גם הם בתוך "קטלוג צמחים"
    if (WRITE) {
      for (const p of existing.filter((e) => !meltserIds.has(e.plantId!) && !sloner.some((s) => s.id === e.plantId))) {
        const exists = await db.nurseryProductCategory.findUnique({ where: { nurseryProductId_nurseryCategoryId: { nurseryProductId: p.id, nurseryCategoryId: parentId! } } });
        if (!exists) {
          await db.nurseryProductCategory.create({ data: { nurseryProductId: p.id, nurseryCategoryId: parentId!, sortOrder: await sortIn(parentId!) } });
          linked++;
        }
      }
    }
    // "קטלוג צמחים" — רק צמחים: מוצר שאינו צמח (למשל "עץ זית ננסי בכלי") יוצא מהקטגוריות שבתוכה
    const allCats = await db.nurseryCategory.findMany({ where: { nurseryId: dst.id }, select: { id: true, parentId: true } });
    const subtree = new Set([parentId!]);
    for (let grew = true; grew; ) {
      grew = false;
      for (const c of allCats) if (c.parentId && subtree.has(c.parentId) && !subtree.has(c.id)) (subtree.add(c.id), (grew = true));
    }
    const strayWhere = { nurseryCategoryId: { in: [...subtree] }, nurseryProduct: { nurseryId: dst.id, plantId: null } };
    const stray = await db.nurseryProductCategory.count({ where: strayWhere });
    log(`שיוכים של מוצרים שאינם צמחים שהוסרו מ"${PARENT.name}": ${stray}`);
    if (WRITE && stray) await db.nurseryProductCategory.deleteMany({ where: strayWhere });

    log(`צמחים חדשים: ${created} (מחירים: ${JSON.stringify(priceCount)}); שיוכי קטגוריה חדשים: ${WRITE ? linked : '—'}`);
    const types: Record<string, number> = {};
    for (const p of sloner) if (!have.has(p.id)) { const k = p.plantType ?? `(ללא) ${(slugsOf.get(p.id) ?? []).join(',') || '-'}`; types[k] = (types[k] ?? 0) + 1; }
    log('סוגי הצמחים החדשים:', types);
    log('סיום ✓');
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
