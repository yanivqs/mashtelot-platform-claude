import { describe, expect, it } from 'vitest';
import { BLOCK_TYPES, isSafeHref, newBlock, parseBlocks, pickLiveVersion, readStoredBlocks, youtubeId } from './page-blocks';

describe('page blocks (R03)', () => {
  it('every default block is valid except the ones that need content', () => {
    for (const t of BLOCK_TYPES) {
      const r = parseBlocks([newBlock(t)]);
      if (t === 'cta') expect(r.ok).toBe(false); // באנר בלי כותרת
      else expect(r.ok, t).toBe(true);
    }
  });

  it('drops unknown fields and rejects unknown block types (R03-08)', () => {
    const r = parseBlocks([{ ...newBlock('text'), html: '<p>שלום</p>', onclick: 'alert(1)', style: 'x' }]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(Object.keys(r.value[0]!)).not.toContain('onclick');
    expect(parseBlocks([{ type: 'html', html: '<script>' }])).toEqual({ ok: false, error: expect.stringContaining('סוג בלוק לא מוכר') });
  });

  it('only allows site paths, https, tel and mailto links', () => {
    expect(isSafeHref('/catalog?category=roses')).toBe(true);
    expect(isSafeHref('https://wa.me/972500000000')).toBe(true);
    expect(isSafeHref('tel:03-5551234')).toBe(true);
    expect(isSafeHref('javascript:alert(1)')).toBe(false);
    expect(isSafeHref('//evil.example')).toBe(false);
    expect(isSafeHref('http://insecure.example')).toBe(false);
    const r = parseBlocks([{ ...newBlock('cta'), title: 'מבצע', ctaHref: 'javascript:alert(1)' }]);
    expect(r.ok).toBe(false);
  });

  it('accepts YouTube links only for video heroes', () => {
    expect(youtubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(youtubeId('https://youtu.be/dQw4w9WgXcQ?t=3')).toBe('dQw4w9WgXcQ');
    expect(youtubeId('https://vimeo.com/1234')).toBeNull();
    expect(parseBlocks([{ ...newBlock('hero'), variant: 'video', videoUrl: 'https://vimeo.com/1' }]).ok).toBe(false);
    expect(parseBlocks([{ ...newBlock('hero'), variant: 'video', videoUrl: 'https://youtu.be/dQw4w9WgXcQ' }]).ok).toBe(true);
  });

  it('requires a source for product blocks and caps the limit', () => {
    expect(parseBlocks([{ ...newBlock('products'), source: 'manual', productIds: [] }]).ok).toBe(false);
    expect(parseBlocks([{ ...newBlock('products'), source: 'category', categoryId: '' }]).ok).toBe(false);
    const r = parseBlocks([{ ...newBlock('products'), limit: 500 }]);
    expect(r.ok && r.value[0]!.type === 'products' && r.value[0]!.limit).toBe(8);
  });

  it('keeps responsive visibility flags (R03-03)', () => {
    const r = parseBlocks([{ ...newBlock('spacer'), hideOnMobile: true }]);
    expect(r.ok && r.value[0]!.hideOnMobile).toBe(true);
  });

  it('skips a broken stored block instead of failing the page', () => {
    const blocks = readStoredBlocks([newBlock('spacer'), { type: 'nope' }, newBlock('text')]);
    expect(blocks.map((b) => b.type)).toEqual(['spacer', 'text']);
  });

  it('live version = highest version whose publish time has come (R03-07)', () => {
    const now = new Date('2030-01-10T12:00:00Z');
    const versions = [
      { version: 1, publishAt: new Date('2030-01-01T00:00:00Z') },
      { version: 2, publishAt: new Date('2030-01-09T00:00:00Z') },
      { version: 3, publishAt: new Date('2030-02-01T00:00:00Z') }, // מתוזמן
    ];
    expect(pickLiveVersion(versions, now)?.version).toBe(2);
    expect(pickLiveVersion(versions, new Date('2030-03-01T00:00:00Z'))?.version).toBe(3);
    expect(pickLiveVersion(versions, new Date('2029-01-01T00:00:00Z'))).toBeNull();
  });
});
