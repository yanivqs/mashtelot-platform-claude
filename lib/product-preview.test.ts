import { describe, expect, it } from 'vitest';
import { adminProductViewUrl, createPreviewToken, PREVIEW_TTL_MS, productPreviewPath, verifyPreviewToken } from './product-preview';

const ID = '3f2b8c1e-0000-4000-8000-000000000001';
const NOW = 1_800_000_000_000;

describe('product preview token', () => {
  it('accepts a fresh token for the same product', () => {
    expect(verifyPreviewToken(ID, createPreviewToken(ID, NOW), NOW + 1000)).toBe(true);
  });

  it('rejects expired, foreign, tampered and missing tokens', () => {
    const token = createPreviewToken(ID, NOW);
    expect(verifyPreviewToken(ID, token, NOW + PREVIEW_TTL_MS + 1)).toBe(false);
    expect(verifyPreviewToken('other-id', token, NOW)).toBe(false);
    const [exp, sig] = token.split('.');
    expect(verifyPreviewToken(ID, `${Number(exp) + 1}.${sig}`, NOW)).toBe(false);
    expect(verifyPreviewToken(ID, `${exp}.${sig!.slice(1)}x`, NOW)).toBe(false);
    expect(verifyPreviewToken(ID, undefined, NOW)).toBe(false);
    expect(verifyPreviewToken(ID, 'garbage', NOW)).toBe(false);
  });

  it('builds a preview path whose token verifies', () => {
    const path = productPreviewPath(ID, NOW);
    expect(path.startsWith(`/preview/product/${ID}?t=`)).toBe(true);
    const t = decodeURIComponent(path.split('?t=')[1]!);
    expect(verifyPreviewToken(ID, t, NOW)).toBe(true);
  });

  it('admin view link: public page when visible, signed preview when hidden', () => {
    const origin = 'https://shop.example';
    expect(adminProductViewUrl(origin, { id: ID, slug: 'ficus', visible: true })).toBe('https://shop.example/product/ficus');
    expect(adminProductViewUrl(origin, { id: ID, slug: 'ficus', visible: false }, NOW)).toBe(`${origin}${productPreviewPath(ID, NOW)}`);
  });
});
