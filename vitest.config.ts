import path from 'path';
import { defineConfig } from 'vitest/config';

/**
 * בדיקות יחידה בלבד — ללא בסיס נתונים וללא טעינת `.env`.
 * בדיקות שנוגעות ב-DB נמצאות ב-test/db ורצות דרך vitest.db.config.ts.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts', 'components/**/*.test.ts'],
    exclude: ['node_modules/**', 'test/**'],
    testTimeout: 20000,
  },
});
