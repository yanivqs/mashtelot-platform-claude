/**
 * Seed the master_supplies catalog (non-plant nursery commodities).
 * Run:  node seed-supplies.js
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const SUPPLIES = [
  { title: 'אדמת שתילה מועשרת 50 ליטר', brand: 'טופיק', category: 'SOIL' },
  { title: 'קומפוסט אורגני 40 ליטר', brand: 'מרום גולן', category: 'SOIL' },
  { title: 'טוף אדום גס 25 ליטר', brand: 'גזית', category: 'SOIL' },
  { title: 'עציץ טרה-קוטה 30 ס"מ', brand: 'כלים ירוקים', category: 'POTS' },
  { title: 'עציץ פלסטיק שחור 5 ליטר (10 יח\')', brand: 'פלסאון', category: 'POTS' },
  { title: 'אדנית מלבנית 60 ס"מ', brand: 'כתר', category: 'POTS' },
  { title: 'דשן NPK מאוזן 1 ק"ג', brand: 'שיל"ב', category: 'FERTILIZER' },
  { title: 'דשן הדרים גרגרי 2 ק"ג', brand: 'הזרע', category: 'FERTILIZER' },
  { title: 'קוטל חרקים ביולוגי 250 מ"ל', brand: 'אגן', category: 'PESTICIDES' },
  { title: 'תרסיס נגד כנימות 500 מ"ל', brand: 'ביו-קטל', category: 'PESTICIDES' },
  { title: 'מזמרה מקצועית ByPass', brand: 'פלקו', category: 'TOOLS' },
  { title: 'כפפות גינון מצופות ניטריל', brand: 'ורדינון', category: 'TOOLS' },
  { title: 'משפך השקיה מתכוונן 10 ליטר', brand: 'גרדנה', category: 'TOOLS' },
  { title: 'יריעת חיפוי גינה נושמת 1x10 מ\'', brand: 'גינת הבית', category: 'GENERAL' },
];

async function main() {
  let created = 0;
  for (const s of SUPPLIES) {
    const exists = await prisma.masterSupply.findFirst({ where: { title: s.title } });
    if (exists) continue;
    await prisma.masterSupply.create({ data: s });
    created++;
  }
  const total = await prisma.masterSupply.count();
  console.log(`✅ נוספו ${created} פריטי ציוד. סה"כ בקטלוג: ${total}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
