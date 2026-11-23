import { describe, expect, it } from 'vitest';
import { manufacturerSlug, normalizeBarcode, normalizeManufacturerCode } from './manufacturers';
import { buildCatalogView, MANUFACTURER_FACET, toIndexEntry } from './catalog-filter';

describe('manufacturers helpers', () => {
  it('builds slugs from Hebrew and Latin names', () => {
    expect(manufacturerSlug('טופיק / מרום גולן')).toBe('טופיק-מרום-גולן');
    expect(manufacturerSlug('Gardena GmbH.')).toBe('gardena-gmbh');
    expect(manufacturerSlug('  "ביו-קטל"  ')).toBe('ביו-קטל');
    expect(manufacturerSlug(' / ')).toBeNull();
  });

  it('normalizes manufacturer codes and barcodes', () => {
    expect(normalizeManufacturerCode('  AB  12 ')).toBe('AB 12');
    expect(normalizeManufacturerCode('')).toBeNull();
    expect(normalizeManufacturerCode('x'.repeat(61))).toBeUndefined();
    expect(normalizeBarcode(' 7290 0001 2345 6 ')).toBe('7290000123456');
    expect(normalizeBarcode('')).toBeNull();
    expect(normalizeBarcode('12')).toBeUndefined();
    expect(normalizeBarcode('729-שלום')).toBeUndefined();
  });
});

describe('manufacturer facet', () => {
  const at = new Date('2026-01-01');
  const e = (id: string, m: string | null, plant = false) =>
    toIndexEntry({
      id,
      createdAt: at,
      title: id,
      plant: plant ? { plantType: 'שיחים', light: null, water: null, floweringSeason: null, flowerColor: null, growthRate: null, evergreen: null, coastal: null, native: null } : null,
      manufacturer: m ? { key: m, label: m.toUpperCase() } : null,
      categorySort: plant ? { plants: 0 } : { tools: 0 },
    });
  const entries = [e('a', 'gardena'), e('b', 'gardena'), e('c', 'topik'), e('d', null), e('p', null, true)];

  it('filters by manufacturer and counts options without the facet itself', () => {
    const v = buildCatalogView(entries, { manufacturer: 'gardena' }, 1, 10);
    expect(v.pageIds.sort()).toEqual(['a', 'b']);
    const f = v.facets.find((x) => x.def.key === MANUFACTURER_FACET.key)!;
    expect(f.selected).toBe('gardena');
    expect(f.options).toEqual([
      { key: 'gardena', label: 'GARDENA', count: 2 },
      { key: 'topik', label: 'TOPIK', count: 1 },
    ]);
  });

  it('is hidden when no result has a manufacturer (plants-only category)', () => {
    const v = buildCatalogView(entries, { categoryIds: ['plants'] }, 1, 10);
    expect(v.pageIds).toEqual(['p']);
    expect(v.facets.find((x) => x.def.key === MANUFACTURER_FACET.key)).toBeUndefined();
  });
});
