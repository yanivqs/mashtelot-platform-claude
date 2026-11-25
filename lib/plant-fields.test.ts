import { describe, expect, it } from 'vitest';
import { PLANT_EDIT_FIELDS, parsePlantFields, plantInputName, sameValue } from '@/lib/plant-fields';

describe('plant fields', () => {
  it('reads only submitted fields, trims, empty = null', () => {
    const fd = new FormData();
    fd.set(plantInputName('hebrewName'), '  לבנדר ');
    fd.set(plantInputName('light'), '');
    fd.set('other', 'x');
    expect(parsePlantFields(fd)).toEqual({ hebrewName: 'לבנדר', light: null });
  });

  it('caps lengths', () => {
    const fd = new FormData();
    fd.set(plantInputName('water'), 'א'.repeat(500));
    fd.set(plantInputName('care'), 'ב'.repeat(5000));
    const r = parsePlantFields(fd);
    expect(r.water).toHaveLength(300);
    expect(r.care).toHaveLength(4000);
  });

  it('never includes description or image (the product has its own)', () => {
    const keys = PLANT_EDIT_FIELDS.map((f) => f.field as string);
    expect(keys).not.toContain('description');
    expect(keys).not.toContain('imageUrl');
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('compares values ignoring null/empty and whitespace', () => {
    expect(sameValue(null, '')).toBe(true);
    expect(sameValue(' שמש ', 'שמש')).toBe(true);
    expect(sameValue('שמש', 'צל')).toBe(false);
  });
});
