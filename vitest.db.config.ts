import path from 'path';
import { defineConfig } from 'vitest/config';

/**
 * בדיקות אינטגרציה מול בסיס נתונים — רק מול יעד בדיקות מאומת (test/db/env.ts).
 * globalSetup מאפס את הסכמה ומריץ מיגרציות; worker-setup מפנה את Prisma ליעד.
 * רצות בסדרה (fileParallelism: false) כי הן חולקות בסיס נתונים אחד.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    environment: 'node',
    include: ['test/db/**/*.test.ts'],
    globalSetup: ['./test/db/global-setup.ts'],
    setupFiles: ['./test/db/worker-setup.ts'],
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 60000,
  },
});
