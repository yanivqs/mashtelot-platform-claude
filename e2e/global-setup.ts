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
/** קבוצת נרדפות שבדיקת הניהול יוצרת — נמחקת בתחילת כל ריצה */
export const E2E_SYNONYM = ['זית', 'אוליבה'];

export default async function globalSetup() {
  const url = process.env.DATABASE_URL ?? '';
  if (process.env.E2E !== '1' || !/localhost|127\.0\.0\.1/.test(url) || !/_test(\?|$)/.test(url)) {
    throw new Error('E2E must run through `npm run test:e2e` against a local *_test database');
  }

  const db = new PrismaClient({ log: [] });
  try {
    const old = await db.nursery.findUnique({ where: { subdomain: 'e2eshop' } });
    if (old) {
      await db.order.deleteMany({ where: { nurseryId: old.id } });
      await db.user.deleteMany({ where: { nurseryId: old.id } });
      await db.nursery.delete({ where: { id: old.id } });
    }
    await db.user.deleteMany({ where: { email: { in: [E2E_OWNER.email, E2E_SUPER.email, E2E_OWNER2.email] } } });
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
