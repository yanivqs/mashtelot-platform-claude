/**
 * נתוני E2E קבועים: משתלה `e2eshop` עם מוצרים, אמצעי תשלום ובעלים. נבנים מחדש בכל ריצה.
 * רץ רק דרך scripts/e2e.js (שמוודא בסיס בדיקות מקומי) — בדיקה כפולה כאן ליתר ביטחון.
 */
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

export const E2E_OWNER = { email: 'owner@e2e.invalid', password: 'e2e-owner-pass-123' };
export const E2E_SUPER = { email: 'super@e2e.invalid', password: 'e2e-super-pass-123' };
/** בעלים נוסף של אותה משתלה — מגבלת ההתחברות היא 5 לאימייל ב-15 דק', והסוויטה מתחברת יותר פעמים */
export const E2E_OWNER2 = { email: 'owner2@e2e.invalid', password: 'e2e-owner2-pass-123' };
export const E2E_SUPER2 = { email: 'super2@e2e.invalid', password: 'e2e-super2-pass-123' };
export const E2E_OWNER3 = { email: 'owner3@e2e.invalid', password: 'e2e-owner3-pass-123' };
export const E2E_OWNER4 = { email: 'owner4@e2e.invalid', password: 'e2e-owner4-pass-123' };
export const E2E_SUPER3 = { email: 'super3@e2e.invalid', password: 'e2e-super3-pass-123' };
/** §4.04: משתמשים לבדיקת האימות הדו-שלבי בלבד */
export const E2E_OWNER5 = { email: 'owner5@e2e.invalid', password: 'e2e-owner5-pass-123' };
export const E2E_SUPER4 = { email: 'super4@e2e.invalid', password: 'e2e-super4-pass-123' };
/** בדיקת התבניות (PT-02) — משתמש נפרד, כדי ש-super2 לא יגיע למגבלת 5 ההתחברויות לאימייל */
export const E2E_SUPER5 = { email: 'super5@e2e.invalid', password: 'e2e-super5-pass-123' };
/** R06: בעל משתלה לבדיקת הצוות (עובד / כותב תוכן) */
export const E2E_OWNER6 = { email: 'owner6@e2e.invalid', password: 'e2e-owner6-pass-123' };
/** R06-06: בעל משתלה לבדיקת המועדון (מגבלת 5 התחברויות לאימייל) */
export const E2E_OWNER7 = { email: 'owner7@e2e.invalid', password: 'e2e-owner7-pass-123' };
/** §2.03: משתלה נפרדת לבדיקת מחזור החיים (כדי לא להשעות את משתלת הבדיקות המשותפת) */
export const E2E_LIFE_OWNER = { email: 'life-owner@e2e.invalid', password: 'e2e-life-pass-1234' };
export const E2E_SUPER6 = { email: 'super6@e2e.invalid', password: 'e2e-super6-pass-123' };
/** UX-01: בעל משתלה לבדיקת שמירת הקלט בטפסים אחרי שגיאה */
export const E2E_OWNER8 = { email: 'owner8@e2e.invalid', password: 'e2e-owner8-pass-123' };
/** R03: בעל משתלה לבדיקת בונה העמודים */
export const E2E_OWNER9 = { email: 'owner9@e2e.invalid', password: 'e2e-owner9-pass-123' };
/** תבנית מפורסמת שנוצרת כאן לבדיקת המוצרים הקבועים (PT-04) */
export const E2E_SAVED_TEMPLATE = 'תוויות קבועות E2E';
export const E2E_PREFLIGHT_TEMPLATE = 'שלט ייצור E2E';
/** קבוצת נרדפות שבדיקת הניהול יוצרת — נמחקת בתחילת כל ריצה */
export const E2E_SYNONYM = ['זית', 'אוליבה'];
/** צמח בקטלוג המרכזי שמשמש את בדיקת הסנכרון (§6) — נוצר מחדש בכל ריצה */
export const E2E_PLANT = 'צמח בדיקה E2E';
/** תבנית דפוס שבדיקת PT-02/03 יוצרת במסך */
export const E2E_PRINT_TEMPLATE = 'מדבקות E2E';

export default async function globalSetup() {
  const url = process.env.DATABASE_URL ?? '';
  if (process.env.E2E !== '1' || !/localhost|127\.0\.0\.1/.test(url) || !/_test(\?|$)/.test(url)) {
    throw new Error('E2E must run through `npm run test:e2e` against a local *_test database');
  }

  const db = new PrismaClient({ log: [] });
  try {
    // משתלת מחזור החיים מהריצה הקודמת
    const oldLife = await db.nursery.findUnique({ where: { subdomain: 'e2elife' } });
    if (oldLife) {
      await db.user.deleteMany({ where: { nurseryId: oldLife.id } });
      await db.nursery.delete({ where: { id: oldLife.id } });
    }
    const old = await db.nursery.findUnique({ where: { subdomain: 'e2eshop' } });
    if (old) {
      await db.order.deleteMany({ where: { nurseryId: old.id } });
      await db.user.deleteMany({ where: { nurseryId: old.id } });
      await db.nursery.delete({ where: { id: old.id } });
    }
    await db.user.deleteMany({ where: { email: { in: [E2E_OWNER.email, E2E_SUPER.email, E2E_OWNER2.email, E2E_SUPER2.email, E2E_OWNER3.email, E2E_OWNER4.email, E2E_SUPER3.email, E2E_OWNER5.email, E2E_SUPER4.email, E2E_SUPER5.email, E2E_OWNER6.email, E2E_OWNER7.email, E2E_LIFE_OWNER.email, E2E_SUPER6.email, E2E_OWNER8.email, E2E_OWNER9.email, 'staff@e2e.invalid', 'writer@e2e.invalid'] } } });
    // המוצרים נמחקו עם המשתלה; הצמח המרכזי (והגרסאות שלו) נמחק כאן
    await db.plant.deleteMany({ where: { hebrewName: E2E_PLANT } });
    // תבנית הדפוס שבדיקת PT יוצרת (ההזמנות שלה נמחקו עם המשתלה)
    await db.printTemplate.deleteMany({ where: { title: { in: [E2E_PRINT_TEMPLATE, E2E_SAVED_TEMPLATE, E2E_PREFLIGHT_TEMPLATE] } } });
    await db.searchSynonymGroup.deleteMany({ where: { terms: { has: 'אוליבה' } } });
    await db.rateLimit.deleteMany({});

    const n = await db.nursery.create({
      data: {
        name: 'משתלת E2E',
        subdomain: 'e2eshop',
        ownerEmail: E2E_OWNER.email,
        pickupEnabled: true,
        deliveryEnabled: true,
      },
    });
    await db.nurseryModule.createMany({
      data: [
        { nurseryId: n.id, moduleKey: 'sales', isEnabled: true, config: { mode: 'ONLINE' } },
        { nurseryId: n.id, moduleKey: 'orders', isEnabled: true },
        { nurseryId: n.id, moduleKey: 'plant_catalog', isEnabled: true },
        { nurseryId: n.id, moduleKey: 'print_shop', isEnabled: true },
        { nurseryId: n.id, moduleKey: 'shipping', isEnabled: true },
        { nurseryId: n.id, moduleKey: 'static_pages', isEnabled: true },
        { nurseryId: n.id, moduleKey: 'blog', isEnabled: true },
        { nurseryId: n.id, moduleKey: 'customer_accounts', isEnabled: true },
        { nurseryId: n.id, moduleKey: 'loyalty', isEnabled: true },
        { nurseryId: n.id, moduleKey: 'crm', isEnabled: true },
        { nurseryId: n.id, moduleKey: 'promotions', isEnabled: true },
        { nurseryId: n.id, moduleKey: 'page_builder', isEnabled: true },
      ],
    });
    for (const [title, price] of [
      ['ורד אדום', '39.90'],
      ['לבנדר רפואי', '24.90'],
      ['זית סורי', '120.00'],
      ['ריחן מתוק', '14.90'],
    ] as const) {
      await db.nurseryProduct.create({ data: { nurseryId: n.id, customTitle: title, price, stockQuantity: 20 } });
    }
    // מוצר עם שני וריאנטים (§7.01): ברירת מחדל יורשת מחיר, השני עם מחיר משלו
    const ficus = await db.nurseryProduct.create({
      data: { nurseryId: n.id, customTitle: 'פיקוס כינורי', price: '59.90', stockQuantity: 5, optionLabel: 'גודל עציץ' },
    });
    await db.productVariant.updateMany({ where: { nurseryProductId: ficus.id, isDefault: true }, data: { name: 'עציץ 1 ליטר' } });
    await db.productVariant.create({
      data: { nurseryId: n.id, nurseryProductId: ficus.id, name: 'עציץ 4 ליטר', price: '89.00', stockQuantity: 2, sortOrder: 1 },
    });
    await db.productVariant.create({
      data: { nurseryId: n.id, nurseryProductId: ficus.id, name: 'עציץ 10 ליטר', price: '149.00', stockQuantity: 0, sortOrder: 2 },
    });

    // §6: מוצר מקושר לצמח מהקטלוג המרכזי (נעוץ לגרסה 1 ע"י trigger)
    const plant = await db.plant.create({
      data: { hebrewName: E2E_PLANT, description: 'תיאור מקורי', light: 'שמש מלאה', water: 'מעט' },
    });
    await db.nurseryProduct.create({ data: { nurseryId: n.id, plantId: plant.id, price: '33.00', stockQuantity: 4 } });

    await db.nurseryPaymentMethod.createMany({
      data: [
        { nurseryId: n.id, method: 'PAYPAL', isEnabled: true, destination: 'https://paypal.me/e2e-shop', sortOrder: 1 },
        { nurseryId: n.id, method: 'PAY_ON_PICKUP', isEnabled: true, instructions: 'מזומן או אשראי בקופה', sortOrder: 2 },
        { nurseryId: n.id, method: 'PAY_ON_DELIVERY', isEnabled: true, sortOrder: 3 },
      ],
    });
    await db.user.create({
      data: {
        email: E2E_OWNER.email,
        role: 'NURSERY_OWNER',
        nurseryId: n.id,
        passwordHash: await bcrypt.hash(E2E_OWNER.password, 4),
      },
    });
    await db.user.create({
      data: { email: E2E_SUPER.email, role: 'SUPER_ADMIN', passwordHash: await bcrypt.hash(E2E_SUPER.password, 4) },
    });
    await db.user.create({
      data: { email: E2E_SUPER2.email, role: 'SUPER_ADMIN', passwordHash: await bcrypt.hash(E2E_SUPER2.password, 4) },
    });
    await db.user.create({
      data: { email: E2E_OWNER3.email, role: 'NURSERY_OWNER', nurseryId: n.id, passwordHash: await bcrypt.hash(E2E_OWNER3.password, 4) },
    });
    await db.user.create({
      data: { email: E2E_OWNER4.email, role: 'NURSERY_OWNER', nurseryId: n.id, passwordHash: await bcrypt.hash(E2E_OWNER4.password, 4) },
    });
    await db.user.create({
      data: { email: E2E_SUPER3.email, role: 'SUPER_ADMIN', passwordHash: await bcrypt.hash(E2E_SUPER3.password, 4) },
    });
    await db.user.create({
      data: { email: E2E_OWNER5.email, role: 'NURSERY_OWNER', nurseryId: n.id, passwordHash: await bcrypt.hash(E2E_OWNER5.password, 4) },
    });
    await db.user.create({
      data: { email: E2E_SUPER4.email, role: 'SUPER_ADMIN', passwordHash: await bcrypt.hash(E2E_SUPER4.password, 4) },
    });
    await db.user.create({
      data: { email: E2E_SUPER5.email, role: 'SUPER_ADMIN', passwordHash: await bcrypt.hash(E2E_SUPER5.password, 4) },
    });
    await db.user.create({
      data: { email: E2E_OWNER6.email, role: 'NURSERY_OWNER', nurseryId: n.id, passwordHash: await bcrypt.hash(E2E_OWNER6.password, 4) },
    });
    await db.user.create({
      data: { email: E2E_OWNER7.email, role: 'NURSERY_OWNER', nurseryId: n.id, passwordHash: await bcrypt.hash(E2E_OWNER7.password, 4) },
    });
    await db.user.create({
      data: { email: E2E_OWNER8.email, role: 'NURSERY_OWNER', nurseryId: n.id, passwordHash: await bcrypt.hash(E2E_OWNER8.password, 4) },
    });
    await db.user.create({
      data: { email: E2E_OWNER9.email, role: 'NURSERY_OWNER', nurseryId: n.id, passwordHash: await bcrypt.hash(E2E_OWNER9.password, 4) },
    });
    const life = await db.nursery.create({ data: { name: 'משתלת מחזור חיים', subdomain: 'e2elife', ownerEmail: E2E_LIFE_OWNER.email, phoneNumber: '03-5551234', city: 'חולון' } });
    await db.user.create({
      data: { email: E2E_LIFE_OWNER.email, role: 'NURSERY_OWNER', nurseryId: life.id, passwordHash: await bcrypt.hash(E2E_LIFE_OWNER.password, 4) },
    });
    await db.user.create({
      data: { email: E2E_SUPER6.email, role: 'SUPER_ADMIN', passwordHash: await bcrypt.hash(E2E_SUPER6.password, 4) },
    });
    // PT-04: תבנית מפורסמת ופעילה (תווית עם טקסט וגודל)
    await db.printTemplate.create({
      data: {
        title: E2E_SAVED_TEMPLATE,
        isActive: true,
        versions: {
          create: {
            version: 1,
            status: 'PUBLISHED',
            publishedAt: new Date(),
            fields: [
              { key: 'text', label: 'טקסט', type: 'text', required: true, maxLength: 30 },
              { key: 'size', label: 'גודל', type: 'select', required: true, options: [
                { value: 's', label: 'קטן', priceDelta: 0 },
                { value: 'l', label: 'גדול', priceDelta: 1 },
              ] },
            ],
            pricing: { basePrice: 2, tiers: [], setupFee: 0, minQuantity: 10, quoteOnly: false },
          },
        },
      },
    });
    await db.user.create({
      data: {
        email: E2E_OWNER2.email,
        role: 'NURSERY_OWNER',
        nurseryId: n.id,
        passwordHash: await bcrypt.hash(E2E_OWNER2.password, 4),
      },
    });
  } finally {
    await db.$disconnect();
  }
}
