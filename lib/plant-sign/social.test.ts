import { describe, expect, it } from 'vitest';
import { formatPhone, normalizeSocials, signSocialLinks, socialHandle, socialLayout } from './social';

describe('socialHandle', () => {
  it.each([
    ['INSTAGRAM', 'https://instagram.com/mashtelat_bait_vagan?srtk=MXhh&utm_source=qr', '@mashtelat_bait_vagan'],
    ['INSTAGRAM', 'https://www.instagram.com/baitvagan/', '@baitvagan'],
    ['INSTAGRAM', '@baitvagan', '@baitvagan'],
    ['INSTAGRAM', 'baitvagan', '@baitvagan'],
    ['INSTAGRAM', 'https://www.instagram.com/', null],
    ['INSTAGRAM', 'https://www.instagram.com/p/C1abc/', null],
    ['FACEBOOK', 'https://www.facebook.com/share/1C5gx75uwf/?mibextid=wwXIfr', null],
    ['FACEBOOK', 'https://www.facebook.com/profile.php?id=1000123', null],
    ['FACEBOOK', 'https://www.facebook.com/baitvagan', '@baitvagan'],
    ['FACEBOOK', 'https://www.facebook.com/', null],
    ['TIKTOK', 'https://www.tiktok.com/@baitvagan', '@baitvagan'],
    ['TIKTOK', 'https://www.tiktok.com/', null],
    ['YOUTUBE', 'https://www.youtube.com/@baitvagan', '@baitvagan'],
    ['YOUTUBE', 'https://www.youtube.com/channel/UC123', null],
    ['WHATSAPP', '0501234567', '050-1234567'],
    ['WHATSAPP', 'https://wa.me/972501234567', '050-1234567'],
    ['WHATSAPP', '03-1234567', '03-1234567'],
    ['WHATSAPP', 'abc', null],
  ] as const)('%s %s', (provider, value, expected) => {
    expect(socialHandle(provider, value)).toBe(expected);
  });
});

describe('socialLayout', () => {
  it('אותו שם בכל הרשתות — שורה אחת', () => {
    const links = signSocialLinks([
      { provider: 'FACEBOOK', value: 'https://facebook.com/baitvagan' },
      { provider: 'INSTAGRAM', value: 'https://instagram.com/BaitVagan' },
      { provider: 'WHATSAPP', value: '0501234567' },
    ]);
    expect(socialLayout(links)).toEqual({ mode: 'shared', handle: '@baitvagan', phone: '050-1234567' });
  });

  it('שמות שונים או חסרים — רשימה', () => {
    const links = signSocialLinks([
      { provider: 'FACEBOOK', value: 'https://www.facebook.com/share/1C5gx75uwf/' },
      { provider: 'INSTAGRAM', value: 'https://instagram.com/mashtelat_bait_vagan' },
      { provider: 'WHATSAPP', value: '0501234567' },
    ]);
    expect(links.map((l) => l.handle)).toEqual([null, '@mashtelat_bait_vagan', '050-1234567']);
    expect(socialLayout(links).mode).toBe('list');
  });

  it('בלי שמות משתמש — שמות הרשתות', () => {
    const links = signSocialLinks([
      { provider: 'FACEBOOK', value: 'https://www.facebook.com/' },
      { provider: 'TIKTOK', value: 'https://www.tiktok.com/' },
    ]);
    expect(socialLayout(links).mode).toBe('names');
  });

  it('עד 4 רשתות, בסדר קבוע; רשתות אחרות לא מוצגות', () => {
    const links = signSocialLinks(
      ['WHATSAPP', 'YOUTUBE', 'TIKTOK', 'INSTAGRAM', 'FACEBOOK', 'WOLT'].map((provider) => ({ provider, value: '' })),
    );
    expect(links.map((l) => l.provider)).toEqual(['FACEBOOK', 'INSTAGRAM', 'TIKTOK', 'YOUTUBE']);
  });
});

describe('normalizeSocials / formatPhone', () => {
  it('רשומה ישנה (רק שמות רשתות) נקראת', () => {
    expect(normalizeSocials(['FACEBOOK', { provider: 'INSTAGRAM', handle: '@x' }, 'WOLT'])).toEqual([
      { provider: 'FACEBOOK', handle: null },
      { provider: 'INSTAGRAM', handle: '@x' },
    ]);
  });
  it('טלפון', () => {
    expect(formatPhone('+972 52-123-4567')).toBe('052-1234567');
    expect(formatPhone('123')).toBeNull();
  });
});
