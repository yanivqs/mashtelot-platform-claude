import type { Prisma } from '@prisma/client';

/**
 * מוצר מוצג בחנות: פעיל, ולא ממתין לתמונה (שויך מהקטלוג ועדיין בלי תמונה משלו).
 * אותו תנאי בכל מקום שהחנות מציגה/מוכרת מוצר — קטלוג, דף מוצר, sitemap, הזמנה.
 */
export const STORE_VISIBLE = { isActive: true, imageRequired: false } as const satisfies Prisma.NurseryProductWhereInput;
