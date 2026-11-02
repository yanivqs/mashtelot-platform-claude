/**
 * העברת מוצרי הדפוס הישנים למערכת החדשה. חד-פעמי, בטוח להרצה חוזרת.
 *
 *   npx tsx scripts/migrate-legacy-print.ts            תצוגה מקדימה בלבד, בלי כתיבה
 *   npx tsx scripts/migrate-legacy-print.ts --apply    יוצר תבניות בטיוטה (כבויות, המשתלות לא רואות אותן)
 *   npx tsx scripts/migrate-legacy-print.ts --retire   מכבה מוצר ישן שיש לו תבנית מפורסמת באותו שם;
 *                                                      הטופס הישן נעלם כשאין מוצרים ישנים פעילים
 *
 * הזמנות ישנות לא נוגעים בהן. כתיבה לבסיס נתונים אמיתי רק באישור הבעלים.
 */
import { PrismaClient } from '@prisma/client';
import { legacyToDraft } from '../lib/print-legacy';
import { createTemplate, saveDraft } from '../lib/print-templates-admin';
import { parseFields, parsePricing } from '../lib/print-template';

const apply = process.argv.includes('--apply');
const retire = process.argv.includes('--retire');
const db = new PrismaClient();

async function main() {
  const [products, options, templates] = await Promise.all([
    db.printProduct.findMany({ orderBy: { sortOrder: 'asc' } }),
    db.printGlobalOption.findMany({ orderBy: { optionName: 'asc' } }),
    db.printTemplate.findMany({ include: { versions: { where: { status: 'PUBLISHED' }, select: { id: true } } } }),
  ]);
  const byTitle = new Map(templates.map((t) => [t.title, t]));

  for (const p of products) {
    const existing = byTitle.get(p.title);
    if (retire) {
      if (!p.isActive) console.log(`כבר כבוי: ${p.title}`);
      else if (!existing?.versions.length) console.log(`נשאר פעיל, אין תבנית מפורסמת: ${p.title}`);
      else {
        await db.printProduct.update({ where: { id: p.id }, data: { isActive: false } });
        console.log(`כובה: ${p.title}`);
      }
      continue;
    }
    if (existing) {
      console.log(`דילוג, כבר קיימת תבנית: ${p.title}`);
      continue;
    }
    const draft = legacyToDraft(p, options);
    const fields = parseFields(draft.fields);
    const pricing = parsePricing(draft.pricing);
    if (!fields.ok || !pricing.ok) {
      console.log(`לא תקין, דילוג: ${p.title}`, !fields.ok ? fields.errors : '', !pricing.ok ? pricing.errors : '');
      continue;
    }
    console.log(`${apply ? 'נוצר בטיוטה' : 'ייווצר בטיוטה'}: ${p.title}`);
    console.log(`  מחיר ${draft.pricing.basePrice}, מינימום ${draft.pricing.minQuantity}, מדרגות ${JSON.stringify(draft.pricing.tiers)}`);
    console.log(`  שדות: ${fields.value.map((f) => `${f.label}${f.options ? ` (${f.options.map((o) => `${o.label} +${o.priceDelta}`).join(', ')})` : ''}`).join(' | ')}`);
    if (apply) {
      const t = await createTemplate(db, draft.meta, 'migrate-legacy-print');
      const saved = await saveDraft(db, t.id, { fields: draft.fields, pricing: draft.pricing });
      if (!saved.ok) throw new Error(`${p.title}: ${saved.errors.join('; ')}`);
    }
  }
  if (!apply && !retire) console.log('\nתצוגה מקדימה בלבד. לא נכתב דבר.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
