import { defineConfig, devices } from '@playwright/test';

/**
 * בדיקות E2E בדפדפן. מריצים דרך `npm run test:e2e` (scripts/e2e.js) — הסקריפט מוודא
 * בסיס בדיקות מקומי, מריץ מיגרציות ו-build, ומגדיר את משתני הסביבה לשרת.
 * החנות נגישה ב-http://e2eshop.localhost:3100 (Chromium מפנה כל *.localhost למחשב המקומי).
 */
export const SHOP = 'http://e2eshop.localhost:3100';
export const ADMIN = 'http://localhost:3100';

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'he-IL',
  },
  projects: [
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /.*\.(mobile|shared)\.spec\.ts/ },
    { name: 'desktop', use: { ...devices['Desktop Chrome'] }, testMatch: /.*\.(desktop|shared)\.spec\.ts/ },
  ],
  webServer: {
    command: 'npx next start -p 3100',
    url: `${ADMIN}/admin/login`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
