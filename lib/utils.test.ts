import { describe, expect, it } from 'vitest';
import { isReservedProductSlug, normalizeProductSlug, parseProductParam, productSlug } from './utils';

const ID = '35d449ef-896f-4700-a878-fe1068ba06b9';

describe('productSlug', () => {
  it('short form: title + first 8 id chars', () => {
    expect(productSlug(ID, 'משפך השקיה מתכוונן 10 ליטר')).toBe('משפך-השקיה-מתכוונן-10-ליטר-35d449ef');
  });
  it('saved slug wins', () => {
    expect(productSlug(ID, 'משפך', 'watering-can-10l')).toBe('watering-can-10l');
  });
  it('title without letters → id prefix only', () => {
    expect(productSlug(ID, '!!!')).toBe('35d449ef');
  });
});

describe('parseProductParam', () => {
  it('old format with full uuid', () => {
    expect(parseProductParam(`משפך-השקיה--${ID}`)).toEqual({ id: ID });
  });
  it('bare uuid', () => {
    expect(parseProductParam(ID)).toEqual({ id: ID });
  });
  it('short form → id prefix', () => {
    expect(parseProductParam('משפך-השקיה-35d449ef')).toEqual({ idPrefix: '35d449ef' });
    expect(parseProductParam('35d449ef')).toEqual({ idPrefix: '35d449ef' });
  });
  it('plain words → null (looked up as saved slug only)', () => {
    expect(parseProductParam('watering-can-10l')).toBeNull();
    expect(parseProductParam('rose-beauty')).toBeNull();
  });
});

describe('normalizeProductSlug', () => {
  it('lowercases and hyphenates', () => {
    expect(normalizeProductSlug('  Watering Can  10L ')).toBe('watering-can-10l');
  });
  it('drops Hebrew and symbols; empty → null', () => {
    expect(normalizeProductSlug('משפך')).toBeNull();
    expect(normalizeProductSlug("rose's -- beauty!")).toBe('roses-beauty');
  });
  it('caps length at 60 without a trailing hyphen', () => {
    const s = normalizeProductSlug(`${'a'.repeat(59)} b`)!;
    expect(s.length).toBeLessThanOrEqual(60);
    expect(s.endsWith('-')).toBe(false);
  });
});

describe('isReservedProductSlug', () => {
  it('rejects ids', () => {
    expect(isReservedProductSlug(ID)).toBe(true);
    expect(isReservedProductSlug('35d449ef')).toBe(true);
    expect(isReservedProductSlug('ficus-lyrata')).toBe(false);
  });
});
