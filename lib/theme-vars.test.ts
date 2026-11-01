import { describe, expect, it } from 'vitest';
import { getNurseryTheme } from './theme';
import { contrastWithWhite, readableOnWhite, shadeChannels, themeStyleVars } from './theme-vars';

describe('theme CSS variables', () => {
  it('derives brand shades from the primary color', () => {
    expect(shadeChannels('#1F3D2B', 'white', 0)).toBe('31 61 43');
    expect(shadeChannels('#000', 'white', 0.5)).toBe('128 128 128');
    expect(shadeChannels('#ffffff', 'black', 1)).toBe('0 0 0');
  });

  it('exposes brand, accent, surface and every shade', () => {
    const vars = themeStyleVars(getNurseryTheme({ primaryColor: null, themeConfig: { colors: { primary: '#1f3d2b', accent: '#e07b39', background: '#f3ead8' } } }));
    expect(vars).toMatchObject({ '--brand': '#1f3d2b', '--accent': '#e07b39', '--surface': '#f3ead8', '--brand-600': '31 61 43' });
    expect(Object.keys(vars).filter((k) => k.startsWith('--brand-'))).toHaveLength(10);
  });

  it('a nursery without a background color keeps white', () => {
    expect(getNurseryTheme({ primaryColor: '#16a34a', themeConfig: null }).colors.background).toBe('#ffffff');
  });
});

describe('readableOnWhite', () => {
  it('darkens a light brand colour to AA contrast with white, and leaves a dark one alone', () => {
    const fixed = readableOnWhite('#16a34a');
    expect(contrastWithWhite('#16a34a')).toBeLessThan(4.5);
    expect(contrastWithWhite(fixed)).toBeGreaterThanOrEqual(4.5);
    expect(contrastWithWhite(fixed)).toBeLessThan(5);
    expect(readableOnWhite('#1f3d2b')).toBe('#1f3d2b');
    expect(readableOnWhite('#fde047')).not.toBe('#fde047');
  });
});
