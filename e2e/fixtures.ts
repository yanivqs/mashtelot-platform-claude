import { test as base } from '@playwright/test';

/**
 * כל בדיקה מקבלת כתובת IP משלה (X-Forwarded-For), כדי שהגבלת ההתחברות לפי IP (10 ל-10 דק', S-22)
 * לא תחסום את הסוויטה — כל הבדיקות רצות מאותו מחשב. ב-Production הכותרת נקבעת ע"י Vercel.
 */
let n = 0;
export const test = base.extend({
  page: async ({ page }, provide) => {
    n += 1;
    await page.setExtraHTTPHeaders({ 'X-Forwarded-For': `198.18.${Math.floor(n / 250)}.${(n % 250) + 1}` });
    await provide(page);
  },
});

export { expect } from '@playwright/test';
export type { Page } from '@playwright/test';
