import { describe, expect, it } from 'vitest';
import { resolveDesignUpdate } from './design-lock';

const stored = {
  themeConfig: { hero: { layout: 'centered' }, carousel: { slides: [{ imageUrl: 'https://x/old.jpg' }] } },
  primaryColor: '#111111',
};
const submitted = {
  themeConfig: { hero: { layout: 'carousel' }, carousel: { slides: [{ imageUrl: 'https://x/new.jpg' }] } },
  primaryColor: '#ff0000',
};

describe('resolveDesignUpdate', () => {
  it('without the design module, keeps the stored design even if the form sent other values', () => {
    expect(resolveDesignUpdate(submitted, stored, { designEnabled: false, carouselAllowed: true, stickyAllowed: true })).toEqual(stored);
  });

  it('with design but without carousel rights, keeps only the stored carousel', () => {
    expect(resolveDesignUpdate(submitted, stored, { designEnabled: true, carouselAllowed: false, stickyAllowed: true })).toEqual({
      themeConfig: { hero: { layout: 'carousel' }, carousel: stored.themeConfig.carousel },
      primaryColor: '#ff0000',
    });
  });

  it('with full design rights, accepts the submitted design', () => {
    expect(resolveDesignUpdate(submitted, stored, { designEnabled: true, carouselAllowed: true, stickyAllowed: true })).toEqual(submitted);
  });

  it('with design but without sticky rights, keeps the stored sticky value', () => {
    const result = resolveDesignUpdate(
      { themeConfig: { hero: { layout: 'split' }, stickyHeader: true }, primaryColor: '#ff0000' },
      { themeConfig: { hero: { layout: 'centered' }, stickyHeader: false }, primaryColor: '#111111' },
      { designEnabled: true, carouselAllowed: true, stickyAllowed: false },
    );
    expect(result).toEqual({
      themeConfig: { hero: { layout: 'split' }, stickyHeader: false },
      primaryColor: '#ff0000',
    });
  });

  it('without sticky rights, a value that was never stored stays absent', () => {
    const result = resolveDesignUpdate(
      { themeConfig: { hero: { layout: 'split' }, stickyHeader: false }, primaryColor: null },
      { themeConfig: { hero: { layout: 'centered' } }, primaryColor: null },
      { designEnabled: true, carouselAllowed: true, stickyAllowed: false },
    );
    expect(result.themeConfig).toEqual({ hero: { layout: 'split' } });
  });
});
