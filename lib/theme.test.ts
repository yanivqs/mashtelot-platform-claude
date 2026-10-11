import { describe, expect, it } from 'vitest';
import { getNurseryTheme, normalizeCarousel, MAX_CAROUSEL_SLIDES } from './theme';

describe('carousel config', () => {
  it('keeps only slides with http(s) images and clamps the interval', () => {
    const c = normalizeCarousel({
      slides: [
        { imageUrl: 'https://x.test/a.jpg', headline: '  שלום ' },
        { imageUrl: 'javascript:alert(1)' },
        { headline: 'ללא תמונה' },
        'junk',
      ],
      intervalSec: '1',
    });
    expect(c.slides).toEqual([
      { imageUrl: 'https://x.test/a.jpg', headline: 'שלום', subheadline: null, ctaText: null, ctaHref: null },
    ]);
    expect(c.intervalSec).toBe(3);
    expect(normalizeCarousel(undefined)).toEqual({ slides: [], intervalSec: 6 });
  });

  it('caps the number of slides', () => {
    const slides = Array.from({ length: 12 }, (_, i) => ({ imageUrl: `https://x.test/${i}.jpg` }));
    expect(normalizeCarousel({ slides }).slides).toHaveLength(MAX_CAROUSEL_SLIDES);
  });

  it('accepts the carousel hero layout', () => {
    const theme = getNurseryTheme({
      primaryColor: null,
      themeConfig: { hero: { layout: 'carousel' }, carousel: { slides: [{ imageUrl: 'https://x.test/a.jpg' }] } },
    });
    expect(theme.hero.layout).toBe('carousel');
    expect(theme.carousel.slides).toHaveLength(1);
  });
});
