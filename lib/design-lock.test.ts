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
    expect(resolveDesignUpdate(submitted, stored, { designEnabled: false, carouselAllowed: true })).toEqual(stored);
  });

  it('with design but without carousel rights, keeps only the stored carousel', () => {
    expect(resolveDesignUpdate(submitted, stored, { designEnabled: true, carouselAllowed: false })).toEqual({
      themeConfig: { hero: { layout: 'carousel' }, carousel: stored.themeConfig.carousel },
      primaryColor: '#ff0000',
    });
  });

  it('with full design rights, accepts the submitted design', () => {
    expect(resolveDesignUpdate(submitted, stored, { designEnabled: true, carouselAllowed: true })).toEqual(submitted);
  });
});
