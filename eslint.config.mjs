import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';

// ESLint 9 flat config (Next.js 16 הסיר את `next lint` — מריצים את ESLint ישירות: `npm run lint`)
export default defineConfig([
  ...nextVitals,
  {
    rules: {
      // גרשיים (") הם תו לגיטימי בעברית (סה"כ, צה"ל). הכלל מיועד לטקסט באנגלית ואינו מתאים לממשק RTL.
      'react/no-unescaped-entities': 'off',
    },
  },
  globalIgnores(['.next/**', 'out/**', 'build/**', 'node_modules/**', 'next-env.d.ts', 'coverage/**']),
]);
