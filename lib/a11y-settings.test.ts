import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import {
  A11Y_BOOT_SCRIPT,
  A11Y_DEFAULTS,
  A11Y_PROFILES,
  A11Y_STORAGE_KEY,
  a11yAttributes,
  changeA11ySetting,
  isA11yDefault,
  sanitizeA11ySettings,
  toggleA11yProfile,
  type A11ySettings,
} from './a11y-settings';

/** מריץ את הסקריפט המוקדם מול דפדפן מדומה ומחזיר את המאפיינים שנקבעו. */
function runBoot(stored: string | null, opts: { storageThrows?: boolean } = {}): Record<string, string> {
  const attrs: Record<string, string> = {};
  vm.runInNewContext(A11Y_BOOT_SCRIPT, {
    localStorage: {
      getItem: (key: string) => {
        if (opts.storageThrows) throw new Error('blocked');
        return key === A11Y_STORAGE_KEY ? stored : null;
      },
    },
    document: { documentElement: { setAttribute: (name: string, value: string) => (attrs[name] = value) } },
  });
  return attrs;
}

describe('a11y settings', () => {
  it('defaults produce no attributes, so a visitor without adjustments gets the plain site', () => {
    expect(a11yAttributes(A11Y_DEFAULTS)).toEqual({});
    expect(isA11yDefault(A11Y_DEFAULTS)).toBe(true);
  });

  it('maps values to attributes', () => {
    const s: A11ySettings = { ...A11Y_DEFAULTS, text: 3, contrast: 'dark', motion: true, guide: 'mask', speak: true };
    expect(a11yAttributes(s)).toEqual({ 'data-a11y-text': '3', 'data-a11y-contrast': 'dark', 'data-a11y-motion': '1' });
  });

  it('sanitize drops unknown keys and values from browser storage', () => {
    const s = sanitizeA11ySettings({ text: 9, contrast: 'red"><script>', font: 'yes', links: true, evil: 1, profile: 'hacker' });
    expect(s).toEqual({ ...A11Y_DEFAULTS, links: true });
    expect(sanitizeA11ySettings('garbage')).toEqual(A11Y_DEFAULTS);
    expect(sanitizeA11ySettings(null)).toEqual(A11Y_DEFAULTS);
  });

  it('a profile replaces the settings, and pressing it again clears them', () => {
    const custom = { ...A11Y_DEFAULTS, hideimages: true };
    const on = toggleA11yProfile(custom, 'dyslexia');
    expect(on.profile).toBe('dyslexia');
    expect(on.font).toBe(true);
    expect(on.hideimages).toBe(false);
    expect(toggleA11yProfile(on, 'dyslexia')).toEqual(A11Y_DEFAULTS);
  });

  it('every profile stores only valid values', () => {
    for (const key of Object.keys(A11Y_PROFILES) as (keyof typeof A11Y_PROFILES)[]) {
      const on = toggleA11yProfile(A11Y_DEFAULTS, key);
      expect(sanitizeA11ySettings(on)).toEqual(on);
    }
  });

  it('a manual change detaches from the profile', () => {
    const on = toggleA11yProfile(A11Y_DEFAULTS, 'vision');
    const changed = changeA11ySetting(on, 'text', 1);
    expect(changed.profile).toBeNull();
    expect(changed.contrast).toBe('dark');
  });
});

describe('boot script', () => {
  it('sets the same attributes as the component, for every profile', () => {
    for (const key of Object.keys(A11Y_PROFILES) as (keyof typeof A11Y_PROFILES)[]) {
      const on = toggleA11yProfile(A11Y_DEFAULTS, key);
      expect(runBoot(JSON.stringify(on))).toEqual(a11yAttributes(on));
    }
  });

  it('survives empty, broken or hostile storage without touching the page', () => {
    expect(runBoot(null)).toEqual({});
    expect(runBoot('{not json')).toEqual({});
    expect(runBoot('', { storageThrows: true })).toEqual({});
    expect(runBoot(JSON.stringify({ contrast: '"><img src=x>', text: 99, font: 0 }))).toEqual({});
  });
});
