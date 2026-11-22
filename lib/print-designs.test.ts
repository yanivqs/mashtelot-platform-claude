import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GREETING_CARDS_LARGE_RULE, GREETING_CARDS_SPECIAL_LOGO_RULE, GREETING_CARDS_SPECIAL_PLAIN_RULE, GREETING_CARDS_MEDIUM_RULE, GREETING_CARDS_RULE as R, checkDesignOrder, defaultPerDesign, describeDesigns, describeRule, parseDesignRule, quantityChoices, storedDesignItems } from './print-designs';
import { MEDIUM_CODE_RE, SPECIAL_CODE_RE, parseCardsCsv } from './print-designs-csv';

const n = (count: number, q: number) => Array.from({ length: count }, () => q);

describe('checkDesignOrder: multiples of 8 designs, quantity per design in steps of 200, at least 3,200 cards', () => {
  it('blocks fewer than 8 designs', () => {
    expect(checkDesignOrder(R, [])).toMatchObject({ ok: false, error: 'יש לבחור לפחות 8 דוגמאות לביצוע הזמנה' });
    expect(checkDesignOrder(R, n(7, 400))).toMatchObject({ ok: false, error: 'יש לבחור לפחות 8 דוגמאות לביצוע הזמנה (נבחרו 7, חסרות 1)' });
  });

  it('default 200 per design; 8 × 400, 16 × 200 and 24 × 200 are valid', () => {
    expect(defaultPerDesign(R)).toBe(200);
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
    const short = "מינימום הזמנה לכרטיסים היא 3,200 יח'. יש להוסיף עוד 8 דוגמאות או לחילופין להגדיל כמות ל-400 יח' לדוגמא";
    expect(checkDesignOrder(R, n(8, 200))).toMatchObject({ ok: false, total: 1600, short: true, error: short });
    expect(checkDesignOrder(R, [200, ...n(7, 400)])).toMatchObject({ ok: false, total: 3000, short: true, error: short });
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

describe('medium greeting cards: at least 10 designs, any number, 50 per design in steps of 50', () => {
  const M = GREETING_CARDS_MEDIUM_RULE;

  it('10, 11 and 23 designs of 50 are valid; fewer than 10 is blocked; steps of 50', () => {
    expect(checkDesignOrder(M, n(10, 50))).toEqual({ ok: true, count: 10, total: 500 });
    expect(checkDesignOrder(M, n(11, 50))).toEqual({ ok: true, count: 11, total: 550 });
    expect(checkDesignOrder(M, [...n(22, 50), 300])).toEqual({ ok: true, count: 23, total: 1400 });
    expect(checkDesignOrder(M, n(9, 50))).toMatchObject({ ok: false, error: 'יש לבחור לפחות 10 דוגמאות לביצוע הזמנה (נבחרו 9, חסרות 1)' });
    expect(checkDesignOrder(M, [...n(9, 50), 75])).toMatchObject({ ok: false, error: 'הכמות מכל דוגמא בקפיצות של 50 (לפחות 50)' });
    expect(defaultPerDesign(M)).toBe(50);
    expect(quantityChoices(M).slice(0, 3)).toEqual([50, 100, 150]);
  });

  it('the rule is stored and read back with its multiple; the small rule stays without one', () => {
    expect(parseDesignRule({ ...M })).toEqual(M);
    expect(parseDesignRule({ packSize: 8, designMultiple: 8, firstPackPerDesign: 400, perDesign: 200 })).toEqual(R);
    expect(describeRule(M)).toBe("בוחרים לפחות 10 דוגמאות, 50 יח' מכל דוגמא (אפשר להגדיל בקפיצות של 50). מינימום הזמנה 500 כרטיסים.");
    expect(describeRule(R)).toContain('בכפולות של 8');
  });
});

describe('large greeting cards: at least 12 designs in multiples of 2, 26 per design in steps of 26', () => {
  const L = GREETING_CARDS_LARGE_RULE;

  it('12, 14 and 20 designs are valid; 11 is blocked; 13 asks to remove or add one; steps of 26', () => {
    expect(checkDesignOrder(L, n(12, 26))).toEqual({ ok: true, count: 12, total: 312 });
    expect(checkDesignOrder(L, n(14, 26))).toEqual({ ok: true, count: 14, total: 364 });
    expect(checkDesignOrder(L, [...n(19, 26), 52])).toEqual({ ok: true, count: 20, total: 546 });
    expect(checkDesignOrder(L, n(11, 26))).toMatchObject({ ok: false, error: 'יש לבחור לפחות 12 דוגמאות לביצוע הזמנה (נבחרו 11, חסרות 1)' });
    expect(checkDesignOrder(L, n(13, 26))).toMatchObject({ ok: false, error: 'ניתן להזמין בכפולות של 2 דוגמאות בלבד. נבחרו 13: הסירו 1 דוגמא או הוסיפו עוד 1' });
    expect(checkDesignOrder(L, [...n(11, 26), 30])).toMatchObject({ ok: false, error: 'הכמות מכל דוגמא בקפיצות של 26 (לפחות 26)' });
    expect(quantityChoices(L).slice(0, 3)).toEqual([26, 52, 78]);
    expect(parseDesignRule({ ...L })).toEqual(L);
    expect(describeRule(L)).toBe("בוחרים לפחות 12 דוגמאות בכפולות של 2, 26 יח' מכל דוגמא (אפשר להגדיל בקפיצות של 26). מינימום הזמנה 312 כרטיסים.");
  });
});

describe('special greeting cards', () => {
  it('with logo: at least 6 designs, any number, 65 per design in steps of 65', () => {
    const L = GREETING_CARDS_SPECIAL_LOGO_RULE;
    expect(checkDesignOrder(L, n(6, 65))).toEqual({ ok: true, count: 6, total: 390 });
    expect(checkDesignOrder(L, n(7, 65))).toEqual({ ok: true, count: 7, total: 455 });
    expect(checkDesignOrder(L, n(5, 65))).toMatchObject({ ok: false, error: 'יש לבחור לפחות 6 דוגמאות לביצוע הזמנה (נבחרו 5, חסרות 1)' });
    expect(checkDesignOrder(L, [...n(5, 65), 100])).toMatchObject({ ok: false, error: 'הכמות מכל דוגמא בקפיצות של 65 (לפחות 65)' });
  });

  it('without logo: any number of designs, 20 per design in steps of 20, at least 240 in total', () => {
    const P = GREETING_CARDS_SPECIAL_PLAIN_RULE;
    expect(checkDesignOrder(P, n(12, 20))).toEqual({ ok: true, count: 12, total: 240 });
    expect(checkDesignOrder(P, [240])).toEqual({ ok: true, count: 1, total: 240 });
    expect(checkDesignOrder(P, [...n(2, 100), 40])).toEqual({ ok: true, count: 3, total: 240 });
    expect(checkDesignOrder(P, n(11, 20))).toMatchObject({ ok: false, error: 'סך הכול לפחות 240 כרטיסים (כרגע 220). הוסיפו דוגמאות או הגדילו את הכמות באחת הדוגמאות' });
    expect(checkDesignOrder(P, [20])).not.toHaveProperty('short');
    expect(checkDesignOrder(P, [...n(11, 20), 30])).toMatchObject({ ok: false, error: 'הכמות מכל דוגמא בקפיצות של 20 (לפחות 20)' });
    expect(checkDesignOrder(P, [])).toMatchObject({ ok: false });
    expect(parseDesignRule({ ...P })).toEqual(P);
    expect(parseDesignRule({ ...P, minTotal: '' })).toEqual({ packSize: 1, firstPackPerDesign: 20, perDesign: 20 });
    expect(parseDesignRule({ packSize: 6, firstPackPerDesign: 65, perDesign: 65, minTotal: 390 })).toEqual({ packSize: 6, firstPackPerDesign: 65, perDesign: 65 });
    expect(describeRule(P)).toBe("בוחרים דוגמאות כרצונכם, 20 יח' מכל דוגמא (אפשר להגדיל בקפיצות של 20). מינימום הזמנה 240 כרטיסים בסך הכול.");
  });

  it('the data file: 24 designs with SP codes, local images and tags', () => {
    const r = parseCardsCsv(readFileSync(join(__dirname, '..', 'data', 'greeting-cards-special.csv'), 'utf8'), { codeRe: SPECIAL_CODE_RE });
    expect(r.notes).toEqual([]);
    expect(r.designs).toHaveLength(24);
    expect(r.designs[0]).toMatchObject({ code: 'SP101', title: 'באהבה - לבבות אדומים', imageUrl: 'file:SP101.jpg', tags: ['באהבה', 'רומנטיקה'] });
    expect(r.designs.map((d) => d.code)).not.toContain('SP105');
    expect(r.designs.every((d) => d.tags.length > 0)).toBe(true);
  });
});

describe('parseCardsCsv on the real medium greeting cards file', () => {
  const r = parseCardsCsv(readFileSync(join(__dirname, '..', 'data', 'greeting-cards-medium.csv'), 'utf8'), { codeRe: MEDIUM_CODE_RE });
  const by = (code: string) => r.designs.find((d) => d.code === code);

  it('162 designs, each code once; exact duplicates enter once', () => {
    expect(r.designs).toHaveLength(162);
    expect(new Set(r.designs.map((d) => d.code)).size).toBe(162);
    expect(r.notes.filter((x) => x.includes('מופיע פעמיים'))).toHaveLength(10);
  });

  it('titles without the code, also when the code is in the middle; tags merged from duplicate rows', () => {
    expect(by('BD2016')).toMatchObject({ title: 'יום הולדת בלון לב', tags: ['יום הולדת'] });
    expect(by('LV1003')?.title).toBe('hearts - i love you');
    expect(by('HLT8009')?.title).toBe('החלמה מהירה תבניות');
    expect(by('HLT8009')?.tags).toEqual(['איחולים']);
    expect(by('TX5005')?.tags).toEqual(['איחולים']);
  });
});
