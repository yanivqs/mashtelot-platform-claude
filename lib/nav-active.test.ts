import { describe, expect, it } from 'vitest';
import { isNavActive } from './nav-active';

describe('isNavActive', () => {
  it('home is active only on exact match', () => {
    expect(isNavActive('/', '/', '/')).toBe(true);
    expect(isNavActive('/catalog', '/', '/')).toBe(false);
  });
  it('section links match their sub-paths', () => {
    expect(isNavActive('/catalog', '/catalog', '/')).toBe(true);
    expect(isNavActive('/catalog/x', '/catalog', '/')).toBe(true);
  });
  it('does not match on a shared prefix', () => {
    expect(isNavActive('/cartography', '/cart', '/')).toBe(false);
  });
});
