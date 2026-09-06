/**
 * Seed the B2B print shop catalog (print_products + print_global_options).
 * Run:  node seed-print.js
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const PRODUCTS = [
  {
    title: 'שלט צמח PVC קשיח 8x5 ס"מ',
    description: 'שלט עמיד למים ולשמש עם הדפסת שם הצמח והמחיר. מינימום הזמנה 50 יח\'.',
    basePrice: 1.8,
    minQuantity: 50,
  },
  {
    title: 'תווית תלייה לעציץ 10x3 ס"מ',
    description: 'תווית פלסטיק עם חור תלייה, הדפסה צבעונית דו-צדדית.',
    basePrice: 0.9,
    minQuantity: 100,
  },
  {
    title: 'שלט מחלקה גדול 40x30 ס"מ (פורקס)',
    description: 'שלט קשיח לתלייה מעל מחלקות ("צמחי תבלין", "ורדים" וכו\').',
    basePrice: 24,
    minQuantity: 1,
  },
  {
    title: 'מדבקות מיתוג עגולות 5 ס"מ (גליל 500)',
    description: 'מדבקות עם לוגו המשתלה להדבקה על עציצים ואריזות.',
    basePrice: 0.35,
    minQuantity: 500,
  },
  {
    title: 'שקית נשיאה מודפסת 35x40 ס"מ',
    description: 'שקית נייר עם ידיות ולוגו המשתלה בהדפסה.',
    basePrice: 1.2,
    minQuantity: 250,
  },
  {
    title: 'כרטיס ביקור / כרטיס טיפוח (חבילת 250)',
    description: 'כרטיס עם הוראות טיפוח בצד אחד ופרטי המשתלה בצד השני.',
    basePrice: 0.4,
    minQuantity: 250,
  },
];

const OPTIONS = [
  { optionName: 'למינציה מט', extraPrice: 0.4 },
  { optionName: 'עמידות מוגברת לחוץ (UV)', extraPrice: 0.6 },
  { optionName: 'פינות מעוגלות', extraPrice: 0.15 },
  { optionName: 'הדפסה דו-צדדית', extraPrice: 0.5 },
];

async function main() {
  let p = 0;
  for (const prod of PRODUCTS) {
    const exists = await prisma.printProduct.findFirst({ where: { title: prod.title } });
    if (exists) continue;
    await prisma.printProduct.create({ data: prod });
    p++;
  }

  let o = 0;
  for (const opt of OPTIONS) {
    const exists = await prisma.printGlobalOption.findFirst({ where: { optionName: opt.optionName } });
    if (exists) continue;
    await prisma.printGlobalOption.create({ data: opt });
    o++;
  }

  console.log(`✅ נוספו ${p} מוצרי דפוס ו-${o} אפשרויות גלובליות.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
