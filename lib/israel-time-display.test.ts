import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * השרת (Vercel) רץ ב-UTC, ולכן תאריך שמוצג בלי timeZone יוצא מוקדם בשעתיים-שלוש משעון ישראל.
 * הבדיקה מוודאת שכל הצגת תאריך/שעה בקוד מציינת timeZone (או עוברת דרך lib/il-time).
 */
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (n === 'node_modules' || n.startsWith('.')) return [];
    if (statSync(p).isDirectory()) return files(p);
    return /\.(ts|tsx)$/.test(n) && !/\.test\.tsx?$/.test(n) ? [p] : [];
  });
}

describe('dates are shown in Israel time', () => {
  it('no date toLocale*String / Intl.DateTimeFormat without timeZone', () => {
    const bad: string[] = [];
    for (const f of ['app', 'components', 'lib'].flatMap(files)) {
      readFileSync(f, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          const dateCall = /(At|Date\([^)]*\))\.toLocale(Date|Time)?String\(|toLocale(Date|Time)String\(|new Intl\.DateTimeFormat\(/.test(line);
          if (dateCall && !/timeZone/.test(line) && !/timeZone/.test(readFileSync(f, 'utf8').split('\n').slice(i, i + 4).join('\n'))) {
            bad.push(`${f}:${i + 1}`);
          }
        });
    }
    expect(bad).toEqual([]);
  });
});
