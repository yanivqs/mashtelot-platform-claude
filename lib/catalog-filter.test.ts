import { describe, expect, it } from 'vitest';
import { firstLetter, parseLetter } from './alphabet';
import { PLANT_FACETS, facetOptions, plantMatchesFacet, type PlantFacetFields } from './plant-facets';
import { buildCatalogView, parseSort, toIndexEntry } from './catalog-filter';
import { buildSynonymIndex } from './search';
import { pageWindow } from '../components/pagination';

const facet = (key: string) => PLANT_FACETS.find((f) => f.key === key)!;

function plant(fields: Partial<PlantFacetFields>): PlantFacetFields {
  return {
    plantType: null,
    light: null,
    water: null,
    floweringSeason: null,
    flowerColor: null,
    growthRate: null,
    evergreen: null,
    coastal: null,
    native: null,
    ...fields,
  };
}

describe('alphabet', () => {
  it('normalizes first letter, skipping quotes and final forms', () => {
    expect(firstLetter('אבוטילון')).toBe('א');
    expect(firstLetter('"זנב-שועל"')).toBe('ז');
    expect(firstLetter('Walking iris')).toBe('#');
    expect(firstLetter('')).toBeNull();
  });
  it('accepts only known letters from the URL', () => {
    expect(parseLetter('ק')).toBe('ק');
    expect(parseLetter('#')).toBe('#');
    expect(parseLetter('x')).toBeNull();
    expect(parseLetter(undefined)).toBeNull();
  });
});

describe('plant facets', () => {
  it('maps free-text light values to multiple buckets', () => {
    const p = plant({ light: 'קרינת שמש ישירה או הצללה חלקית' });
    expect(plantMatchesFacet(p, facet('light'), 'sun')).toBe(true);
    expect(plantMatchesFacet(p, facet('light'), 'partial')).toBe(true);
    expect(plantMatchesFacet(p, facet('light'), 'shade')).toBe(false);
  });
  it('treats "most of the year" as every season', () => {
    const p = plant({ floweringSeason: 'רוב השנה' });
    for (const s of ['spring', 'summer', 'autumn', 'winter']) {
      expect(plantMatchesFacet(p, facet('season'), s)).toBe(true);
    }
  });
  it('only returns options that exist in the given plants', () => {
    const opts = facetOptions(
      [plant({ water: 'בינונית' }), plant({ water: 'מועטה, חסכוני במים' }), plant({ water: 'בינונית' }), null],
      facet('water'),
    );
    expect(opts).toEqual([
      { key: 'low', label: 'מועטה / חסכוני במים', count: 1 },
      { key: 'medium', label: 'בינונית', count: 2 },
    ]);
  });
  it('uses exact values for plant type', () => {
    const opts = facetOptions([plant({ plantType: 'שיחים' }), plant({ plantType: 'עצים' })], facet('type'));
    expect(opts.map((o) => o.key)).toEqual(['עצים', 'שיחים']);
  });
});

describe('buildCatalogView', () => {
  const t0 = new Date('2026-01-01');
  const entries = [
    toIndexEntry({ id: 'a', createdAt: t0, title: 'אלוורה', plant: plant({ light: 'שמש מלאה', water: 'מועטה' }), categorySort: { succ: 1 } }),
    toIndexEntry({ id: 'b', createdAt: new Date('2026-02-01'), title: 'בוגנוויליה', plant: plant({ light: 'שמש מלאה', water: 'בינונית' }), categorySort: { climb: 0 } }),
    toIndexEntry({ id: 'c', createdAt: new Date('2026-03-01'), title: 'אגבה', altNames: ['Agave'], plant: plant({ light: 'צל חלקי', water: 'מועטה' }), categorySort: { succ: 0 } }),
    toIndexEntry({ id: 'd', createdAt: new Date('2026-04-01'), title: 'אדמת שתילה', plant: null, categorySort: {} }),
  ];

  it('filters by letter, sorted alphabetically', () => {
    const v = buildCatalogView(entries, { letter: 'א' }, 1, 10);
    expect(v.pageIds).toEqual(['אגבה', 'אדמת שתילה', 'אלוורה'].map((t) => entries.find((e) => e.title === t)!.id));
    expect([...v.letters].sort()).toEqual(['א', 'ב']);
  });

  it('respects owner sort order inside a category', () => {
    const v = buildCatalogView(entries, { categoryIds: ['succ'] }, 1, 10);
    expect(v.pageIds).toEqual(['c', 'a']);
  });

  it('customer sort (R04-07): price both ways, name, newest; overrides category order and relevance', () => {
    const priced = entries.map((e, i) => ({ ...e, price: [30, 10, 20, 10][i]! }));
    expect(buildCatalogView(priced, { sort: 'price_asc' }, 1, 10).pageIds).toEqual(['d', 'b', 'c', 'a']); // שוויון → לפי שם
    expect(buildCatalogView(priced, { sort: 'price_desc' }, 1, 10).pageIds).toEqual(['a', 'c', 'd', 'b']);
    expect(buildCatalogView(priced, { sort: 'name' }, 1, 10).pageIds).toEqual(['c', 'd', 'a', 'b']);
    expect(buildCatalogView(priced, { sort: 'newest' }, 1, 10).pageIds).toEqual(['d', 'c', 'b', 'a']);
    expect(buildCatalogView(priced, { categoryIds: ['succ'], sort: 'price_asc' }, 1, 10).pageIds).toEqual(['c', 'a']);
    expect(buildCatalogView(priced, { sort: 'recommended' }, 1, 10).pageIds).toEqual(['d', 'c', 'b', 'a']);
  });

  it('parseSort accepts only known values', () => {
    expect(parseSort('price_desc')).toBe('price_desc');
    expect(parseSort('stock')).toBe('recommended');
    expect(parseSort(undefined)).toBe('recommended');
  });

  it('searches alt names case-insensitively', () => {
    expect(buildCatalogView(entries, { q: 'agave' }, 1, 10).pageIds).toEqual(['c']);
  });

  it('computes facet counts excluding the facet itself', () => {
    const v = buildCatalogView(entries, { facets: { water: 'low' } }, 1, 10);
    expect(v.pageIds.sort()).toEqual(['a', 'c']);
    const water = v.facets.find((f) => f.def.key === 'water')!;
    // אפשרות "בינונית" עדיין מוצגת (נספרת בלי סינון ההשקיה עצמו)
    expect(water.options.map((o) => o.key)).toEqual(['low', 'medium']);
    const light = v.facets.find((f) => f.def.key === 'light')!;
    expect(light.options).toEqual([
      { key: 'sun', label: 'שמש מלאה', count: 1 },
      { key: 'partial', label: 'הצללה חלקית', count: 1 },
    ]);
    // מאפיינים שאין להם ערך באף צמח לא מוצגים
    expect(v.facets.find((f) => f.def.key === 'color')).toBeUndefined();
  });

  it('paginates and clamps out-of-range pages', () => {
    const v = buildCatalogView(entries, {}, 9, 3);
    expect(v.pageCount).toBe(2);
    expect(v.page).toBe(2);
    expect(v.pageIds).toEqual(['a']);
  });
});

describe('pageWindow', () => {
  it('shows first, last and a window around the current page', () => {
    expect(pageWindow(1, 3)).toEqual([1, 2, 3]);
    expect(pageWindow(10, 20)).toEqual([1, '…', 8, 9, 10, 11, 12, '…', 20]);
  });
});

describe('catalog smart search (R04-03)', () => {
  const entry = (id: string, title: string, createdAt: number, alt: string[] = []) =>
    toIndexEntry({ id, createdAt: new Date(createdAt), title, altNames: alt, plant: null, categorySort: {} });
  const entries = [
    entry('a', 'ורדינה', 3),
    entry('b', 'ורד אדום', 1),
    entry('c', 'לבנדר רפואי', 2, ['Lavandula']),
    entry('d', 'ריחן מתוק', 4),
  ];
  const synonyms = buildSynonymIndex([['ריחן', 'בזיליקום']]);

  it('orders by relevance, not by date, when searching', () => {
    const v = buildCatalogView(entries, { q: 'ורד' }, 1, 10);
    expect(v.pageIds).toEqual(['b', 'a']); // מדויק לפני תחילת מילה, למרות ש-a חדש יותר
  });

  it('finds typos, plurals, latin names and synonyms', () => {
    expect(buildCatalogView(entries, { q: 'לבדנר' }, 1, 10).pageIds).toEqual(['c']);
    expect(buildCatalogView(entries, { q: 'ורדים' }, 1, 10).pageIds).toContain('b');
    expect(buildCatalogView(entries, { q: 'lavandula' }, 1, 10).pageIds).toEqual(['c']);
    expect(buildCatalogView(entries, { q: 'בזיליקום', synonyms }, 1, 10).pageIds).toEqual(['d']);
    expect(buildCatalogView(entries, { q: 'בזיליקום' }, 1, 10).pageIds).toEqual([]);
  });

  it('letters are computed on the searched results', () => {
    const v = buildCatalogView(entries, { q: 'ורד' }, 1, 10);
    expect([...v.letters]).toEqual(['ו']);
  });
});
