/**
 * משתלת ההדגמה (demo-nursery) כחלון ראווה של הפלטפורמה (החלטת בעלים 2026-11-23): מעתיק ממשתלת בית וגן את
 * המבנה והתוכן — קטגוריות, מוצרים שאינם צמחים (ציוד, זרים, מארזים...), דפי תוכן עם Page Builder, בלוג,
 * עיצוב ודף הבית — בלי פרטים מזהים: שם המשתלה, הכתובת והטלפון מוחלפים, ופרטי הקשר והרשתות בדויים.
 *
 *   npx vite-node -c vitest.config.ts scripts/seed-demo-showcase.ts                # dry-run (ברירת מחדל)
 *   ... -- --write                                     # כתיבה (יעד מקומי)
 *   ... -- --write --confirm-target=<supabase-ref>     # יעד שאינו מקומי
 *
 * תוספות בלבד: לא מוחק ולא משנה תוכן קיים של משתלת ההדגמה (מוצר/קטגוריה/דף/פוסט לפי slug, פריסה לפי
 * מפתח — אם כבר קיים, מדלגים). אפשר להריץ שוב. התמונות מהאחסון שלנו מועתקות לתיקיית משתלת ההדגמה,
 * כדי שמחיקה בבית וגן לא תשבור את ההדגמה, ונכנסות לספריית התמונות שלה.
 */
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { PrismaClient, Prisma } from '@prisma/client';
import { describeTarget } from './seed-guard';
import { parseBlocks } from '@/lib/page-blocks';
import { HOME_KEY, editorState, publishDraft, saveDraft, type LayoutTarget } from '@/lib/page-builder-admin';

const SOURCE = 'baitvagan';
const TARGET = 'demo-nursery';
const ACTOR = 'seed:demo-showcase';
const args = process.argv.slice(2);
const WRITE = args.includes('--write');

/** פרטי קשר בדויים (החלטת בעלים) */
const DEMO_CONTACT = {
  phoneNumber: '03-0000000',
  addressLine: 'רחוב הדוגמה 1',
  city: 'עיר הדוגמה',
  contactEmail: 'demo@mashtelot.net',
  mapLink: null,
};
/** הרשתות — כדי להראות את האפשרויות, בלי שיוך לחשבון אמיתי */
const DEMO_CHANNELS: Array<{ provider: 'WHATSAPP' | 'FACEBOOK' | 'INSTAGRAM' | 'TIKTOK' | 'YOUTUBE' | 'GOOGLE_BUSINESS'; value: string; isFeatured?: boolean }> = [
  { provider: 'WHATSAPP', value: '050-0000000', isFeatured: true },
  { provider: 'FACEBOOK', value: 'https://www.facebook.com/' },
  { provider: 'INSTAGRAM', value: 'https://www.instagram.com/' },
  { provider: 'TIKTOK', value: 'https://www.tiktok.com/' },
  { provider: 'YOUTUBE', value: 'https://www.youtube.com/' },
  { provider: 'GOOGLE_BUSINESS', value: 'https://www.google.com/maps' },
];
/** מפתחות העיצוב שעוברים (לא תמונות ההירו והקרוסלה הישנות של בית וגן — דף הבית בנוי ב-Page Builder) */
const THEME_KEYS = ['colors', 'headerStyle', 'announcement', 'stickyHeader'];

function log(...m: unknown[]) {
  console.log(WRITE ? '' : '[dry-run]', ...m);
}

function storage() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const raw = process.env.SUPABASE_URL;
  if (!key || !raw) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY חסרים');
  const baseUrl = new URL(raw).origin;
  return { baseUrl, key, publicPrefix: `${baseUrl}/storage/v1/object/public/uploads/` };
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL לא מוגדרת');
  const target = describeTarget(url);
  if (WRITE && !target.local && !args.includes(`--confirm-target=${target.ref}`)) {
    throw new Error(`יעד supabase:${target.ref ?? target.host} אינו מקומי — נדרש --confirm-target=${target.ref}`);
  }
  log('יעד:', target.local ? `local:${target.host}` : `supabase:${target.ref}`);

  const db = new PrismaClient({ log: ['warn', 'error'] });
  try {
    const src = await db.nursery.findUniqueOrThrow({ where: { subdomain: SOURCE } });
    const dst = await db.nursery.findUniqueOrThrow({ where: { subdomain: TARGET } });

    // ---------- החלפת פרטים מזהים בטקסט ----------
    const swaps: Array<[string, string]> = (
      [
        [src.name, dst.name],
        ['בית וגן', 'ההדגמה'],
        [src.addressLine, DEMO_CONTACT.addressLine],
        [src.city, DEMO_CONTACT.city],
        [src.phoneNumber, DEMO_CONTACT.phoneNumber],
        [src.contactEmail, DEMO_CONTACT.contactEmail],
        [src.ownerEmail, DEMO_CONTACT.contactEmail],
      ] as Array<[string | null, string]>
    ).filter((p): p is [string, string] => !!p[0] && p[0].length > 2);
    const clean = (s: string | null): string | null => (s === null ? null : swaps.reduce((t, [a, b]) => t.split(a).join(b), s));

    // ---------- תמונות: העתקה לתיקיית משתלת ההדגמה ----------
    const cfg = WRITE ? storage() : null;
    const copied = new Map<string, string>();
    const imageRows: Array<{ url: string; storagePath: string; fileName: string }> = [];
    let imagesToCopy = 0;
    async function img(u: string | null): Promise<string | null> {
      if (!u) return u;
      const prefix = cfg?.publicPrefix ?? `${new URL(process.env.SUPABASE_URL ?? 'https://x.invalid').origin}/storage/v1/object/public/uploads/`;
      if (!u.startsWith(prefix)) return u; // Unsplash וכדומה — נשאר
      const key = u.slice(prefix.length);
      if (key.startsWith(`nurseries/${dst.id}/`)) return u;
      const hit = copied.get(u);
      if (hit) return hit;
      const dest = `nurseries/${dst.id}/showcase/${key.replace(/[^a-zA-Z0-9._-]+/g, '_')}`;
      const out = `${prefix}${dest}`;
      copied.set(u, out);
      imagesToCopy += 1;
      if (cfg) {
        const res = await fetch(`${cfg.baseUrl}/storage/v1/object/copy`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${cfg.key}`, apikey: cfg.key, 'Content-Type': 'application/json' },
          body: JSON.stringify({ bucketId: 'uploads', sourceKey: key, destinationKey: dest }),
        });
        // כבר הועתק בהרצה קודמת — בסדר
        if (!res.ok && !/already exists|Duplicate/i.test(await res.text())) throw new Error(`העתקת תמונה נכשלה (${res.status}): ${key}`);
        imageRows.push({ url: out, storagePath: dest, fileName: key.split('/').pop()!.slice(0, 200) });
      }
      return out;
    }
    /** כל המחרוזות במבנה JSON: תמונות מועתקות, מזהים ממופים, פרטים מזהים מוחלפים */
    async function deep(v: unknown, ids: Map<string, string>): Promise<unknown> {
      if (typeof v === 'string') {
        if (/^https?:\/\//.test(v)) return img(v);
        return clean(ids.get(v) ?? v);
      }
      if (Array.isArray(v)) return Promise.all(v.map((x) => deep(x, ids)));
      if (v && typeof v === 'object') {
        const out: Record<string, unknown> = {};
        for (const [k, x] of Object.entries(v)) out[ids.get(k) ?? k] = await deep(x, ids);
        return out;
      }
      return v;
    }

    // ---------- קטגוריות (לפי slug) ----------
    const srcCats = await db.nurseryCategory.findMany({ where: { nurseryId: src.id }, orderBy: [{ sortOrder: 'asc' }] });
    const dstCats = await db.nurseryCategory.findMany({ where: { nurseryId: dst.id } });
    const dstBySlug = new Map(dstCats.map((c) => [c.slug, c.id]));
    const ids = new Map<string, string>(); // מזהה בבית וגן → מזהה בהדגמה
    let newCats = 0;
    // הורים קודם
    const ordered = [...srcCats.filter((c) => !c.parentId), ...srcCats.filter((c) => c.parentId)];
    const srcById = new Map(srcCats.map((c) => [c.id, c]));
    for (const c of ordered) {
      let id = dstBySlug.get(c.slug);
      if (!id) {
        newCats += 1;
        const parentId = c.parentId ? (ids.get(c.parentId) ?? dstBySlug.get(srcById.get(c.parentId)?.slug ?? '') ?? null) : null;
        if (WRITE) id = (await db.nurseryCategory.create({ data: { nurseryId: dst.id, name: c.name, slug: c.slug, parentId, sortOrder: c.sortOrder } })).id;
        else id = randomUUID(); // dry-run: מזהה זמני, כדי שבדיקת הבלוקים תעבוד
        dstBySlug.set(c.slug, id);
      }
      ids.set(c.id, id);
    }
    log(`קטגוריות: ${newCats} חדשות, ${srcCats.length - newCats} קיימות`);

    // ---------- מוצרים שאינם מהקטלוג הבוטני (ציוד ומוצרים של המשתלה) ----------
    const srcProducts = await db.nurseryProduct.findMany({
      where: { nurseryId: src.id, plantId: null, deletedAt: null },
      include: { variants: { orderBy: { sortOrder: 'asc' } }, categories: true },
      orderBy: { createdAt: 'asc' },
    });
    const dstProducts = await db.nurseryProduct.findMany({ where: { nurseryId: dst.id }, select: { id: true, slug: true, supplyId: true, plantId: true } });
    const haveSlug = new Set(dstProducts.map((p) => p.slug).filter(Boolean));
    const haveSupply = new Set(dstProducts.map((p) => p.supplyId).filter(Boolean));
    // צמחים מהקטלוג: מיפוי לפי הצמח, כדי שבלוקים שמפנים למוצר-צמח יעבדו בהדגמה
    const dstByPlant = new Map(dstProducts.filter((p) => p.plantId).map((p) => [p.plantId!, p.id]));
    for (const p of await db.nurseryProduct.findMany({ where: { nurseryId: src.id, plantId: { not: null } }, select: { id: true, plantId: true } })) {
      const d = dstByPlant.get(p.plantId!);
      if (d) ids.set(p.id, d);
    }
    let newProducts = 0;
    for (const p of srcProducts) {
      if ((p.slug && haveSlug.has(p.slug)) || (p.supplyId && haveSupply.has(p.supplyId))) {
        const existing = dstProducts.find((d) => (p.slug && d.slug === p.slug) || (p.supplyId && d.supplyId === p.supplyId));
        if (existing) ids.set(p.id, existing.id);
        continue;
      }
      newProducts += 1;
      if (!WRITE) {
        for (const u of [p.customImageUrl, ...p.galleryImageUrls, ...p.variants.flatMap((v) => v.imageUrls)]) await img(u);
        continue;
      }
      // התמונות מועתקות לפני הטרנזקציה, כדי שלא תימשך זמן רב
      const variantData = await Promise.all(
        p.variants.map(async (v) => ({
          name: v.name,
          option1: v.option1,
          option2: v.option2,
          colorHex: v.colorHex,
          sku: v.sku,
          barcode: v.barcode,
          price: v.price,
          compareAtPrice: v.compareAtPrice,
          stockQuantity: v.stockQuantity,
          imageUrls: (await Promise.all(v.imageUrls.map(img))) as string[],
          isActive: v.isActive,
          sortOrder: v.sortOrder,
          isDefault: v.isDefault,
        })),
      );
      const productData = {
        nurseryId: dst.id,
        supplyId: p.supplyId,
        customTitle: clean(p.customTitle),
        customImageUrl: await img(p.customImageUrl),
        galleryImageUrls: (await Promise.all(p.galleryImageUrls.map(img))) as string[],
        slug: p.slug,
        imageRequired: p.imageRequired,
        price: p.price,
        compareAtPrice: p.compareAtPrice,
        stockQuantity: p.stockQuantity,
        isActive: p.isActive,
        alwaysInStock: p.alwaysInStock,
        customDescription: clean(p.customDescription),
        seoMetaTitle: clean(p.seoMetaTitle),
        seoMetaDescription: clean(p.seoMetaDescription),
        optionLabel: p.optionLabel,
        option2Label: p.option2Label,
        categories: { create: p.categories.flatMap((c) => (ids.has(c.nurseryCategoryId) ? [{ nurseryCategoryId: ids.get(c.nurseryCategoryId)!, sortOrder: c.sortOrder }] : [])) },
      };
      // trigger במסד יוצר לכל מוצר חדש וריאנט ברירת מחדל: מעדכנים אותו לפי וריאנט ברירת המחדל של המקור,
      // ושאר הווריאנטים נוספים כרגילים
      const created = await db.$transaction(async (tx) => {
        const prod = await tx.nurseryProduct.create({ data: productData });
        const auto = await tx.productVariant.findFirst({ where: { nurseryProductId: prod.id, isDefault: true } });
        const srcDefault = variantData.find((v) => v.isDefault);
        const rest = variantData.filter((v) => v !== srcDefault);
        if (auto && srcDefault) {
          const { isDefault: _d, ...data } = srcDefault;
          await tx.productVariant.update({ where: { id: auto.id }, data });
        }
        if (rest.length) {
          await tx.productVariant.createMany({ data: rest.map((v) => ({ ...v, isDefault: false, nurseryId: dst.id, nurseryProductId: prod.id })) });
        }
        return prod;
      });
      ids.set(p.id, created.id);
    }
    log(`מוצרים: ${newProducts} חדשים מתוך ${srcProducts.length}`);

    // ---------- דפי תוכן (בלי "אודות" — להדגמה יש דף משלה) ----------
    const srcPages = await db.staticPage.findMany({ where: { nurseryId: src.id } });
    const dstPageSlugs = new Map((await db.staticPage.findMany({ where: { nurseryId: dst.id }, select: { slug: true, id: true } })).map((p) => [p.slug, p.id]));
    const copiedPages: Array<{ srcId: string; dstId: string }> = [];
    for (const p of srcPages) {
      const existing = dstPageSlugs.get(p.slug);
      if (existing) {
        log(`דף "${p.title}" (${p.slug}) קיים — לא משתנה`);
        continue;
      }
      log(`דף "${p.title}" (${p.slug}) נוצר`);
      if (!WRITE) continue;
      const d = await db.staticPage.create({
        data: {
          nurseryId: dst.id,
          slug: p.slug,
          title: clean(p.title)!,
          contentHtml: clean(p.contentHtml)!,
          isPublished: p.isPublished,
          showInNav: p.showInNav,
          sortOrder: p.sortOrder,
          seoMetaTitle: clean(p.seoMetaTitle),
          seoMetaDescription: clean(p.seoMetaDescription),
        },
      });
      ids.set(p.id, d.id);
      copiedPages.push({ srcId: p.id, dstId: d.id });
    }

    // ---------- בלוג ----------
    const dstPosts = new Set((await db.blogPost.findMany({ where: { nurseryId: dst.id }, select: { slug: true } })).map((p) => p.slug));
    let newPosts = 0;
    for (const p of await db.blogPost.findMany({ where: { nurseryId: src.id }, orderBy: { createdAt: 'asc' } })) {
      if (dstPosts.has(p.slug)) continue;
      newPosts += 1;
      if (!WRITE) {
        await img(p.coverImageUrl);
        continue;
      }
      await db.blogPost.create({
        data: {
          nurseryId: dst.id,
          title: clean(p.title)!,
          slug: p.slug,
          excerpt: clean(p.excerpt),
          contentHtml: clean(p.contentHtml)!,
          coverImageUrl: await img(p.coverImageUrl),
          isPublished: p.isPublished,
          publishedAt: p.publishedAt,
          seoMetaTitle: clean(p.seoMetaTitle),
          seoMetaDescription: clean(p.seoMetaDescription),
        },
      });
    }
    log(`בלוג: ${newPosts} פוסטים חדשים`);

    // ---------- Page Builder: דף הבית ודפי התוכן שהועתקו ----------
    const layouts = await db.pageLayout.findMany({ where: { nurseryId: src.id }, include: { versions: { orderBy: { version: 'desc' }, take: 1 } } });
    const targets: Array<{ from: (typeof layouts)[number]; to: LayoutTarget; label: string }> = [];
    for (const l of layouts) {
      if (l.key === HOME_KEY) targets.push({ from: l, to: { kind: 'home' }, label: 'דף הבית' });
      else if (l.staticPageId) {
        const page = copiedPages.find((p) => p.srcId === l.staticPageId);
        const title = srcPages.find((p) => p.id === l.staticPageId)?.title;
        if (page) targets.push({ from: l, to: { kind: 'page', staticPageId: page.dstId }, label: `דף "${title}"` });
        else if (!WRITE && !dstPageSlugs.has(srcPages.find((p) => p.id === l.staticPageId)?.slug ?? '')) log(`פריסת דף "${title}" תועתק`);
      }
    }
    for (const t of targets) {
      const raw = t.from.versions[0]?.blocks ?? t.from.draftBlocks;
      const parsed = parseBlocks(await deep(raw, ids));
      if (!parsed.ok) throw new Error(`${t.label}: ${parsed.error}`);
      if (parsed.value.length === 0) continue;
      if (!WRITE) {
        log(`${t.label}: יפורסם (${parsed.value.length} בלוקים)`);
        continue;
      }
      const state = await editorState(db, dst.id, t.to);
      if (state.versions.length > 0) {
        log(`${t.label}: כבר יש גרסה שפורסמה — לא משתנה`);
        continue;
      }
      await saveDraft(db, dst.id, t.to, parsed.value);
      await publishDraft(db, dst.id, t.to, new Date(), ACTOR);
      log(`${t.label}: פורסם (${parsed.value.length} בלוקים)`);
    }

    // ---------- עיצוב, פרטי קשר, רשתות ומודולים ----------
    const srcTheme = (src.themeConfig ?? {}) as Record<string, unknown>;
    const dstTheme = (dst.themeConfig ?? {}) as Record<string, unknown>;
    const theme: Record<string, unknown> = { ...dstTheme };
    for (const k of THEME_KEYS) if (k in srcTheme && !(k in dstTheme)) theme[k] = await deep(srcTheme[k], ids);
    log(`עיצוב: ${THEME_KEYS.filter((k) => k in srcTheme && !(k in dstTheme)).join(', ') || 'ללא שינוי'}`);
    log(`פרטי קשר בדויים: ${DEMO_CONTACT.phoneNumber} · ${DEMO_CONTACT.addressLine}, ${DEMO_CONTACT.city} · ${DEMO_CONTACT.contactEmail}`);

    const srcModules = await db.nurseryModule.findMany({ where: { nurseryId: src.id, isEnabled: true } });
    const dstModules = new Map((await db.nurseryModule.findMany({ where: { nurseryId: dst.id } })).map((m) => [m.moduleKey, m]));
    const turnOn = srcModules.filter((m) => !dstModules.get(m.moduleKey)?.isEnabled);
    log(`מודולים שיופעלו: ${turnOn.map((m) => m.moduleKey).join(', ') || 'אין'}`);
    log(`רשתות: ${DEMO_CHANNELS.map((c) => c.provider).join(', ')}`);
    log(`תמונות להעתקה: ${imagesToCopy}`);
    if (!WRITE) return;

    await db.nursery.update({
      where: { id: dst.id },
      data: { ...DEMO_CONTACT, openingHours: src.openingHours ?? Prisma.DbNull, themeConfig: theme as Prisma.InputJsonValue },
    });
    for (const m of turnOn) {
      await db.nurseryModule.upsert({
        where: { nurseryId_moduleKey: { nurseryId: dst.id, moduleKey: m.moduleKey } },
        create: { nurseryId: dst.id, moduleKey: m.moduleKey, isEnabled: true, config: m.config ?? Prisma.DbNull },
        update: { isEnabled: true },
      });
    }
    for (const [i, c] of DEMO_CHANNELS.entries()) {
      await db.nurseryChannel.upsert({
        where: { nurseryId_provider: { nurseryId: dst.id, provider: c.provider } },
        create: { nurseryId: dst.id, provider: c.provider, value: c.value, isEnabled: true, isFeatured: c.isFeatured ?? false, sortOrder: i },
        update: { value: c.value, isEnabled: true },
      });
    }
    // ספריית התמונות של משתלת ההדגמה
    if (imageRows.length) await db.nurseryImage.createMany({ data: imageRows.map((r) => ({ nurseryId: dst.id, ...r, uploadedByEmail: ACTOR })), skipDuplicates: true });
    log('סיום ✓ — דפי החנות יתרעננו תוך שעה, או מיד בשמירה כלשהי בניהול');
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
