/**
 * בית וגן — תוכן ופרטי קשר (באישור הבעלים 2026-11-01):
 * תיקון האימייל (baut → bait) והכתובת (34 → 39), טקסט אודות ותיאור גוגל לעמוד אודות, והסתרת 3 עמודי התוכן
 * מהתפריט העליון (הקטגוריות צמחים / פרחים / מוצרי גינון כבר בתפריט "קטגוריות").
 *
 *   npx vite-node -c vitest.config.ts scripts/ops/baitvagan-content.ts -- [--dry-run] [--confirm-production=baitvagan]
 */
import { PrismaClient } from '@prisma/client';
import { requireTargetConfirmation } from './storage';

const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');

const EMAIL = 'info@baitvaganshop.co.il';
/** הכתובת הנכונה (אושרה ע"י הבעלים) — ממנה נבנה גם קישור ה-Waze */
const ADDRESS = "ז'בוטינסקי 39";
const ABOUT =
  "משתלת בית וגן היא משתלה אזורית בז'בוטינסקי 39 בבאר יעקב. אצלנו תמצאו צמחי בית וגינה, עצים ושיחים, פרחי עונה וזרים, עציצים ואדניות, זרעים ופקעות, וכל מה שצריך לגינה: אדמה, דשנים וכלי עבודה. נשמח לייעץ בבחירת הצמח המתאים למרפסת, לגינה או למתנה, ולהכין זר או מארז לכל אירוע. אפשר לבקר במשתלה, להזמין באתר לאיסוף, או לקבל משלוח בהתאם לאזורי החלוקה המופיעים באתר.";
const ABOUT_SEO = 'משתלת בית וגן בבאר יעקב: צמחי בית וגינה, פרחים וזרים, עציצים, זרעים ומוצרי גינון. ייעוץ אישי, איסוף מהמשתלה ומשלוחים.';
const HIDE_FROM_NAV = ['plants', 'flowers', 'garden'];

async function main() {
  const target = requireTargetConfirmation(args, 'baitvagan');
  console.log(`יעד: ${target.label}${DRY ? ' (dry-run — בלי כתיבה)' : ''}`);
  const db = new PrismaClient();
  try {
    const n = await db.nursery.findUniqueOrThrow({ where: { subdomain: 'baitvagan' }, select: { id: true, contactEmail: true, aboutText: true, addressLine: true } });
    const about = await db.staticPage.findUnique({ where: { nurseryId_slug: { nurseryId: n.id, slug: 'about' } } });
    const navPages = await db.staticPage.findMany({ where: { nurseryId: n.id, slug: { in: HIDE_FROM_NAV } }, select: { slug: true, title: true, showInNav: true } });

    console.log(`אימייל: ${n.contactEmail} → ${EMAIL}`);
    console.log(`כתובת: ${n.addressLine} → ${ADDRESS}`);
    console.log(`אודות (משתלה): "${n.aboutText}" → "${ABOUT.slice(0, 40)}…"`);
    console.log(`עמוד אודות: ${about ? 'קיים' : 'לא קיים'} · תיאור גוגל → "${ABOUT_SEO.slice(0, 40)}…"`);
    console.log(`הסתרה מהתפריט: ${navPages.map((p) => `${p.title}${p.showInNav ? '' : ' (כבר מוסתר)'}`).join(', ')}`);
    if (DRY) return;

    await db.$transaction(async (tx) => {
      await tx.nursery.update({ where: { id: n.id }, data: { contactEmail: EMAIL, aboutText: ABOUT, addressLine: ADDRESS } });
      if (about) {
        await tx.staticPage.update({
          where: { id: about.id },
          data: { contentHtml: `<p>${ABOUT}</p>`, seoMetaDescription: ABOUT_SEO },
        });
      }
      await tx.staticPage.updateMany({ where: { nurseryId: n.id, slug: { in: HIDE_FROM_NAV } }, data: { showInNav: false } });
    });
    console.log('עודכן ✓');
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
