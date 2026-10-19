import { describe, expect, it } from 'vitest';
import { diffRevisions, localizeItem, planSync, restoreField } from './catalog-sync';

const v1 = { hebrewName: 'ורד', description: 'ישן', light: 'שמש', imageUrl: 'https://a' };
const v2 = { hebrewName: 'ורד', description: 'חדש', light: 'חצי צל', imageUrl: 'https://a' };

describe('localizeItem', () => {
  it('shows the pinned revision, not the live row', () => {
    const live = { id: 'p', hebrewName: 'ורד', description: 'חי', light: 'צל' };
    expect(localizeItem(live, 'plant', v1, null)).toMatchObject({ id: 'p', description: 'ישן', light: 'שמש' });
  });
  it('local fields win over the revision', () => {
    expect(localizeItem({ id: 'p' }, 'plant', v1, { description: 'שלי' })).toMatchObject({ description: 'שלי', light: 'שמש' });
  });
  it('without a revision the live data is kept (custom/legacy)', () => {
    const live = { id: 'p', description: 'חי' };
    expect(localizeItem(live, 'plant', null, null)).toBe(live);
  });
  it('ignores unknown keys in overrides', () => {
    expect(localizeItem({ id: 'p' }, 'plant', v1, { price: 1 })).not.toHaveProperty('price');
  });
});

describe('diffRevisions', () => {
  it('lists changed fields with labels', () => {
    expect(diffRevisions('plant', v1, v2, null).map((d) => [d.field, d.from, d.to])).toEqual([
      ['description', 'ישן', 'חדש'],
      ['light', 'שמש', 'חצי צל'],
    ]);
  });
  it('local fields are not offered (Q1-a)', () => {
    expect(diffRevisions('plant', v1, v2, { description: 'שלי' }).map((d) => d.field)).toEqual(['light']);
  });
  it('treats empty string and null as equal', () => {
    expect(diffRevisions('supply', { title: 'אדמה', brand: '' }, { title: 'אדמה', brand: null }, null)).toEqual([]);
  });
});

describe('planSync', () => {
  it('rejected field keeps the value shown so far; accepted fields move on', () => {
    expect(planSync('plant', v1, v2, null, ['description'])).toEqual({
      overrides: { description: 'ישן' },
      accepted: ['light'],
      rejected: ['description'],
    });
  });
  it('ignores rejections of fields that did not change', () => {
    expect(planSync('plant', v1, v2, null, ['hebrewName']).rejected).toEqual([]);
  });
  it('restoreField removes a local field', () => {
    expect(restoreField({ description: 'שלי', light: 'x' }, 'description')).toEqual({ light: 'x' });
  });
});
