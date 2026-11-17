import { describe, expect, it } from 'vitest';
import { MAX_GALLERY_IMAGES, parseGalleryUrls, productImages } from './product-gallery';
import { variantImages } from './variants';

const u = (n: number) => `https://img.example.com/${n}.jpg`;

describe('parseGalleryUrls', () => {
  it('keeps order, drops blanks, duplicates and the main image', () => {
    expect(parseGalleryUrls([u(2), '', u(1), u(2), '  ', u(3)], u(1))).toEqual([u(2), u(3)]);
  });
  it('accepts only http(s) URLs', () => {
    expect(parseGalleryUrls(['javascript:alert(1)', 'data:image/png;base64,AA', '/local.jpg', 'not a url', u(1)], null)).toEqual([u(1)]);
  });
  it('caps at the maximum', () => {
    const many = Array.from({ length: 12 }, (_, i) => u(i));
    expect(parseGalleryUrls(many, null)).toEqual(many.slice(0, MAX_GALLERY_IMAGES));
  });
});

describe('productImages / variantImages', () => {
  it('main image first, then the gallery without duplicates', () => {
    expect(productImages(u(1), [u(2), u(1), u(3)])).toEqual([u(1), u(2), u(3)]);
    expect(productImages(null, [u(2)])).toEqual([u(2)]);
  });
  it('variant images come first, then the product images', () => {
    expect(variantImages({ imageUrls: [u(9)] }, u(1), [u(2)])).toEqual([u(9), u(1), u(2)]);
    expect(variantImages({ imageUrls: [u(2)] }, u(1), [u(2), u(3)])).toEqual([u(2), u(1), u(3)]);
    expect(variantImages(null, u(1))).toEqual([u(1)]);
  });
});
