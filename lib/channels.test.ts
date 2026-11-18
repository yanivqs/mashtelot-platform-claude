import { describe, expect, it } from 'vitest';
import { whatsappHref } from './channels';

describe('whatsappHref', () => {
  it('keeps an international number', () => {
    expect(whatsappHref('972524094093')).toBe('https://wa.me/972524094093');
    expect(whatsappHref('+972 52-409-4093')).toBe('https://wa.me/972524094093');
  });
  it('turns a local Israeli number into 972', () => {
    expect(whatsappHref('052-409-4093')).toBe('https://wa.me/972524094093');
    expect(whatsappHref('00972524094093')).toBe('https://wa.me/972524094093');
  });
  it('adds an encoded greeting', () => {
    expect(whatsappHref('0524094093', 'שלום')).toBe(`https://wa.me/972524094093?text=${encodeURIComponent('שלום')}`);
  });
  it('rejects empty or junk values', () => {
    expect(whatsappHref('')).toBeNull();
    expect(whatsappHref('abc')).toBeNull();
    expect(whatsappHref('12345')).toBeNull();
  });
});
