import { describe, expect, it } from 'vitest';
import { getNurseryTheme, normalizeAnnouncement, normalizeCarousel, normalizeOpeningHours, openingHoursToText, parseOpeningHoursText, MAX_CAROUSEL_SLIDES } from './theme';

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

describe('announcement bar and header style', () => {
  it('normalizes the announcement and rejects unsafe links', () => {
    expect(normalizeAnnouncement({ enabled: true, text: ' משלוח חינם ', href: '/catalog?category=x', tone: 'accent' })).toEqual({
      enabled: true,
      text: 'משלוח חינם',
      linkText: null,
      href: '/catalog?category=x',
      tone: 'accent',
    });
    expect(normalizeAnnouncement({ enabled: true, text: 'x', href: 'javascript:alert(1)' }).href).toBeNull();
    expect(normalizeAnnouncement({ enabled: true, text: 'x', href: '//evil.example' }).href).toBeNull();
    // בלי טקסט — כבויה
    expect(normalizeAnnouncement({ enabled: true, text: '' }).enabled).toBe(false);
    expect(normalizeAnnouncement(null)).toMatchObject({ enabled: false, tone: 'brand' });
  });

  it('header style defaults to classic', () => {
    expect(getNurseryTheme({ primaryColor: null, themeConfig: { headerStyle: 'float' } }).headerStyle).toBe('float');
    expect(getNurseryTheme({ primaryColor: null, themeConfig: { headerStyle: 'weird' } }).headerStyle).toBe('classic');
  });
});

describe('opening hours', () => {
  it('keeps the colon inside a time and splits on the label separator', () => {
    expect(parseOpeningHoursText('ראשון - חמישי | 09:00-17:00\nשישי: 08:00-13:00\nשבת: סגור')).toEqual([
      { label: 'ראשון - חמישי', value: '09:00-17:00' },
      { label: 'שישי', value: '08:00-13:00' },
      { label: 'שבת', value: 'סגור' },
    ]);
  });

  it('repairs rows saved by the old parser', () => {
    expect(normalizeOpeningHours([{ label: 'ראשון - חמישי | 09', value: '00-17:00' }, { label: 'שבת', value: 'סגור' }])).toEqual([
      { label: 'ראשון - חמישי', value: '09:00-17:00' },
      { label: 'שבת', value: 'סגור' },
    ]);
  });

  it('round-trips through the edit text', () => {
    const rows = [{ label: 'ראשון - חמישי', value: '09:00-17:00' }];
    expect(parseOpeningHoursText(openingHoursToText(rows))).toEqual(rows);
  });

  it('accepts the floatTop header style', () => {
    expect(getNurseryTheme({ primaryColor: null, themeConfig: { headerStyle: 'floatTop' } }).headerStyle).toBe('floatTop');
  });
});
