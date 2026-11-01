import { describe, expect, it } from 'vitest';
import { articleJsonLd, jsonLdHtml } from './seo';

const nursery = { name: 'משתלה', subdomain: 'shop', customDomain: null, logoUrl: 'https://x.invalid/logo.png' };
const post = {
  slug: 'pruning',
  title: 'גיזום ורדים',
  excerpt: 'מתי וכיצד',
  contentHtml: '<p>תוכן</p>',
  coverImageUrl: 'https://x.invalid/cover.jpg',
  publishedAt: new Date('2026-10-01T10:00:00.000Z'),
  createdAt: new Date('2026-09-01T10:00:00.000Z'),
  updatedAt: new Date('2026-10-05T10:00:00.000Z'),
};

describe('articleJsonLd', () => {
  it('has headline, dates, author, publisher, image and page url', () => {
    const ld = articleJsonLd(nursery, post);
    expect(ld['@type']).toBe('BlogPosting');
    expect(ld.headline).toBe('גיזום ורדים');
    expect(ld.datePublished).toBe('2026-10-01T10:00:00.000Z');
    expect(ld.dateModified).toBe('2026-10-05T10:00:00.000Z');
    expect(ld.author).toMatchObject({ '@type': 'Organization', name: 'משתלה' });
    expect(ld.publisher.logo).toMatchObject({ url: 'https://x.invalid/logo.png' });
    expect(ld.image).toEqual(['https://x.invalid/cover.jpg']);
    expect(ld.mainEntityOfPage).toMatch(/\/blog\/pruning$/);
  });

  it('omits the image when the post has no cover, and falls back to createdAt for the date', () => {
    const ld = articleJsonLd(nursery, { ...post, coverImageUrl: null, publishedAt: null });
    expect(ld.image).toBeUndefined();
    expect(ld.datePublished).toBe('2026-09-01T10:00:00.000Z');
  });
});

describe('jsonLdHtml', () => {
  it('cannot close the script tag from content', () => {
    const html = jsonLdHtml({ name: '</script><script>alert(1)</script>' });
    expect(html).not.toContain('<');
    expect(JSON.parse(html)).toEqual({ name: '</script><script>alert(1)</script>' });
  });
});
