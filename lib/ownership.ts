import type { PrismaClient } from '@prisma/client';

/**
 * בדיקת שייכות רשומה למשתלה (C-P1-01). מקבל את ה-client כפרמטר כדי שיהיה בר-בדיקה
 * מול בסיס נתונים; ה-Server Actions קוראים לו עם ה-nurseryId מהקשר המשתמש בלבד.
 * מזהה של משתלה אחרת ומזהה לא קיים מטופלים זהה — אין דליפת מידע על קיום רשומות.
 */

export type OwnedModel =
  | 'coupon'
  | 'promotion'
  | 'shippingZone'
  | 'nurseryProduct'
  | 'nurseryCategory'
  | 'order'
  | 'staticPage'
  | 'blogPost';

export class OwnershipError extends Error {
  constructor() {
    super('הפריט לא נמצא או שאין הרשאה אליו');
  }
}

export async function isOwnedBy(
  db: PrismaClient,
  model: OwnedModel,
  id: string,
  nurseryId: string,
): Promise<boolean> {
  if (!id || !nurseryId) return false;
  const where = { id, nurseryId };
  const select = { id: true } as const;
  switch (model) {
    case 'coupon':
      return Boolean(await db.coupon.findFirst({ where, select }));
    case 'promotion':
      return Boolean(await db.promotion.findFirst({ where, select }));
    case 'shippingZone':
      return Boolean(await db.shippingZone.findFirst({ where, select }));
    case 'nurseryProduct':
      return Boolean(await db.nurseryProduct.findFirst({ where, select }));
    case 'nurseryCategory':
      return Boolean(await db.nurseryCategory.findFirst({ where, select }));
    case 'order':
      return Boolean(await db.order.findFirst({ where, select }));
    case 'staticPage':
      return Boolean(await db.staticPage.findFirst({ where, select }));
    case 'blogPost':
      return Boolean(await db.blogPost.findFirst({ where, select }));
  }
}

export async function assertOwnedBy(
  db: PrismaClient,
  model: OwnedModel,
  id: string,
  nurseryId: string,
): Promise<void> {
  if (!(await isOwnedBy(db, model, id, nurseryId))) throw new OwnershipError();
}
