import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GREETING_CARDS_RULE as R, checkDesignOrder, defaultPerDesign, describeDesigns, parseDesignRule, quantityChoices, storedDesignItems } from './print-designs';
import { parseCardsCsv } from './print-designs-csv';

const n = (count: number, q: number) => Array.from({ length: count }, () => q);

describe('checkDesignOrder: multiples of 8 designs, quantity per design in steps of 200, at least 3,200 cards', () => {
  it('blocks fewer than 8 designs', () => {
    expect(checkDesignOrder(R, [])).toMatchObject({ ok: false, error: 'יש לבחור לפחות 8 דוגמאות לביצוע הזמנה' });
    expect(checkDesignOrder(R, n(7, 400))).toMatchObject({ ok: false, error: 'יש לבחור לפחות 8 דוגמאות לביצוע הזמנה (נבחרו 7, חסרות 1)' });
  });

  it('default quantities: 8 designs → 400 each (3,200); 16 and up → 200 each', () => {
    expect(defaultPerDesign(R, 8)).toBe(400);
    expect(defaultPerDesign(R, 3)).toBe(400);
    expect(defaultPerDesign(R, 16)).toBe(200);
    expect(checkDesignOrder(R, n(8, 400))).toEqual({ ok: true, count: 8, total: 3200 });
    expect(checkDesignOrder(R, n(16, 200))).toEqual({ ok: true, count: 16, total: 3200 });
    expect(checkDesignOrder(R, n(24, 200))).toEqual({ ok: true, count: 24, total: 4800 });
  });

  it('not a multiple of 8: remove X or add 8−X', () => {
    expect(checkDesignOrder(R, n(9, 200))).toMatchObject({ ok: false, error: 'ניתן להזמין בכפולות של 8 דוגמאות בלבד. נבחרו 9: הסירו 1 דוגמא או הוסיפו עוד 7' });
    expect(checkDesignOrder(R, n(15, 200))).toMatchObject({ ok: false, error: 'ניתן להזמין בכפולות של 8 דוגמאות בלבד. נבחרו 15: הסירו 7 דוגמאות או הוסיפו עוד 1' });
  });

  it('a different quantity per design, in steps of 200', () => {
    expect(checkDesignOrder(R, [800, 600, 400, 400, 400, 200, 200, 200])).toEqual({ ok: true, count: 8, total: 3200 });
    expect(checkDesignOrder(R, [1000, ...n(7, 400)])).toEqual({ ok: true, count: 8, total: 3800 });
    expect(checkDesignOrder(R, [300, ...n(7, 400)])).toMatchObject({ ok: false, error: "הכמות מכל דוגמא בקפיצות של 200 (לפחות 200)" });
    expect(checkDesignOrder(R, [0, ...n(7, 400)]).ok).toBe(false);
  });

  it('total at least 3,200', () => {
    expect(checkDesignOrder(R, [200, ...n(7, 400)])).toMatchObject({ ok: false, total: 3000, error: 'סך הכול לפחות 3,200 כרטיסים (כרגע 3,000). הגדילו את הכמות באחת הדוגמאות' });
  });

  it('choices, stored designs (also the first shape), rule parsing, order line', () => {
    expect(quantityChoices(R, 1000)).toEqual([200, 400, 600, 800, 1000]);
    expect(storedDesignItems({ ids: ['a', 'b'], quantities: [400, 600] })).toEqual([{ id: 'a', quantity: 400 }, { id: 'b', quantity: 600 }]);
    expect(storedDesignItems({ ids: ['a'], codes: ['X'], perDesign: 200 })).toEqual([{ id: 'a', quantity: 200 }]);
    expect(storedDesignItems(null)).toEqual([]);
    expect(parseDesignRule(R)).toEqual(R);
    expect(parseDesignRule(null)).toBeNull();
    expect(parseDesignRule({ packSize: 0, firstPackPerDesign: 400, perDesign: 200 })).toBeNull();
    expect(describeDesigns([{ code: 'SC1', title: 'א', quantity: 400 }, { code: 'SC2', title: 'ב', quantity: 1000 }])).toEqual({ label: "דוגמאות (2, סה\"כ 1,400 יח')", value: 'SC1 א ×400 · SC2 ב ×1,000' });
  });
});

describe('parseCardsCsv on the real small greeting cards file', () => {
  const r = parseCardsCsv(readFileSync(join(__dirname, '..', 'data', 'greeting-cards-small.csv'), 'utf8'));
  const by = (code: string) => r.designs.find((d) => d.code === code);

  it('every code once, all with https images', () => {
    const codes = r.designs.map((d) => d.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(r.designs.length).toBeGreaterThan(100);
    expect(r.designs.every((d) => d.imageUrl.startsWith('https://'))).toBe(true);
  });

  it('the duplicate SC9521 enters once; the second SC9598 becomes SC9599', () => {
    expect(r.notes.some((n) => n.startsWith('SC9521'))).toBe(true);
    expect(by('SC9598')?.title).toBe('שרטוט פרח 5');
    expect(by('SC9599')?.title).toBe('שרטוט פרח 6');
    expect(by('SC9599')?.imageUrl).toContain('SC9599');
  });

  it('titles without the code, tags from filterTags, HTML removed', () => {
    expect(by('SC9624')).toMatchObject({ title: 'יום הולדת שמח - בלון איור', tags: ['יום הולדת', 'איור'] });
    expect(by('SC9637')?.title).toBe('כרטיס ברכה "באהבה" בשילוב איורי עלי פמפס וצמחייה טבעית.');
    expect(by('SC9591')).toBeDefined();
    expect(r.description).toContain('גודל כרטיס סגור: 6/8');
    expect(r.description).not.toMatch(/<|\\n/);
  });
});
