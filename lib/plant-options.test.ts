import { describe, expect, it } from 'vitest';
import { LIGHT_OPTIONS, WATER_OPTIONS, formatSeasons, origInputName, readSeasons, seasonsFromText } from '@/lib/plant-options';
import { PLANT_FACETS, plantFacetOptionKeys, type PlantFacetFields } from '@/lib/plant-facets';
import { parsePlantFields, plantInputName } from '@/lib/plant-fields';

const facet = (key: string) => PLANT_FACETS.find((f) => f.key === key)!;
const keysFor = (facetKey: string, field: keyof PlantFacetFields, value: string) =>
  plantFacetOptionKeys({ [field]: value } as unknown as PlantFacetFields, facet(facetKey));

describe('plant options', () => {
  it('every light / water option maps to a store filter', () => {
    for (const o of LIGHT_OPTIONS) expect(keysFor('light', 'light', o).length, o).toBeGreaterThan(0);
    for (const o of WATER_OPTIONS) expect(keysFor('water', 'water', o).length, o).toBeGreaterThan(0);
    expect(keysFor('light', 'light', 'שמש מלאה עד צל חלקי')).toEqual(['sun', 'partial']);
    expect(keysFor('water', 'water', 'מועטה-בינונית')).toEqual(['low', 'medium']);
  });

  it('reads seasons from old free-text values', () => {
    expect(seasonsFromText('באביב ובקיץ')).toEqual(['אביב', 'קיץ']);
    expect(seasonsFromText('בחורף ובאביב המוקדם')).toEqual(['אביב', 'חורף']);
    expect(seasonsFromText('רוב השנה לסרוגין')).toHaveLength(4);
    expect(seasonsFromText('בעונות החמות')).toEqual(['אביב', 'קיץ', 'סתיו']);
    expect(seasonsFromText('')).toEqual([]);
  });

  it('formats seasons in fixed order; all four = all year', () => {
    expect(formatSeasons(['קיץ', 'אביב'])).toBe('אביב, קיץ');
    expect(formatSeasons(['חורף', 'סתיו', 'קיץ', 'אביב'])).toBe('כל השנה');
    expect(formatSeasons([])).toBeNull();
    expect(keysFor('season', 'floweringSeason', 'כל השנה')).toHaveLength(4);
  });

  it('keeps the original text when the ticked seasons did not change', () => {
    const name = plantInputName('floweringSeason');
    const fd = new FormData();
    fd.append(name, '');
    fd.append(name, 'אביב');
    fd.append(name, 'קיץ');
    fd.set(origInputName(name), 'באביב ובקיץ');
    expect(readSeasons(fd, name)).toBe('באביב ובקיץ');
    fd.append(name, 'סתיו');
    expect(readSeasons(fd, name)).toBe('אביב, קיץ, סתיו');
  });

  it('parsePlantFields reads the season checkboxes; none ticked = null', () => {
    const name = plantInputName('floweringSeason');
    const fd = new FormData();
    fd.append(name, '');
    expect(parsePlantFields(fd)).toEqual({ floweringSeason: null });
    fd.append(name, 'חורף');
    fd.set(plantInputName('light'), 'צל מלא');
    expect(parsePlantFields(fd)).toEqual({ floweringSeason: 'חורף', light: 'צל מלא' });
  });
});
