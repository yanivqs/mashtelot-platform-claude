import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GREETING_CARDS_RULE as R, describeDesigns, designQuantity, parseDesignRule } from './print-designs';
import { parseCardsCsv } from './print-designs-csv';

describe('designQuantity: multiples of 8, 400 each for one pack, 200 each beyond', () => {
  it('blocks fewer than 8 designs', () => {
    expect(designQuantity(R, 0)).toEqual({ ok: false, count: 0, error: 'יש לבחור לפחות 8 דוגמאות לביצוע הזמנה' });
    expect(designQuantity(R, 7)).toMatchObject({ ok: false, error: 'יש לבחור לפחות 8 דוגמאות לביצוע הזמנה (נבחרו 7, חסרות 1)' });
  });

  it('8 designs: 400 of each, 3,200 in total', () => {
    expect(designQuantity(R, 8)).toEqual({ ok: true, count: 8, perDesign: 400, total: 3200 });
  });

  it('not a multiple of 8: remove X or add 8−X', () => {
    expect(designQuantity(R, 9)).toMatchObject({ ok: false, error: 'ניתן להזמין בכפולות של 8 דוגמאות בלבד. נבחרו 9: הסירו 1 דוגמא או הוסיפו עוד 7' });
    expect(designQuantity(R, 15)).toMatchObject({ ok: false, error: 'ניתן להזמין בכפולות של 8 דוגמאות בלבד. נבחרו 15: הסירו 7 דוגמאות או הוסיפו עוד 1' });
    expect(designQuantity(R, 17).ok).toBe(false);
  });

  it('16 and up: 200 of each', () => {
    expect(designQuantity(R, 16)).toEqual({ ok: true, count: 16, perDesign: 200, total: 3200 });
    expect(designQuantity(R, 24)).toEqual({ ok: true, count: 24, perDesign: 200, total: 4800 });
  });

  it('parses the stored rule and rejects junk', () => {
    expect(parseDesignRule(R)).toEqual(R);
    expect(parseDesignRule(null)).toBeNull();
    expect(parseDesignRule({ packSize: 0, firstPackPerDesign: 400, perDesign: 200 })).toBeNull();
    expect(parseDesignRule([1])).toBeNull();
  });

  it('describes the order line', () => {
    expect(describeDesigns([{ code: 'SC1', title: 'א' }, { code: 'SC2', title: 'ב' }], 200)).toEqual({ label: "דוגמאות (2 × 200 יח')", value: 'SC1 א · SC2 ב' });
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
