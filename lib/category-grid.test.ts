import { describe, expect, it } from 'vitest';
import { gridColumns, layoutRows, tileCubes, type CategoryTileSize } from './category-grid';
import { parseBlocks, readStoredBlocks, type BlockOf } from './page-blocks';

const t = (...sizes: CategoryTileSize[]) => sizes.map((size, i) => ({ id: `c${i + 1}`, size }));
const shape = (rows: ReturnType<typeof layoutRows>) => rows.map((r) => [r.items.map((i) => i.span), r.emptyColumns]);

describe('category grid', () => {
  it('4 per row is 16 cubes (8×2); 3 per row is 12 cubes (6×2)', () => {
    expect(gridColumns(4) * 2).toBe(16);
    expect(gridColumns(3) * 2).toBe(12);
    expect(tileCubes('normal')).toBe(4);
    expect(tileCubes('wide')).toBe(8);
  });

  it('the mockup: normal + wide + normal fills one row of 16 cubes', () => {
    expect(shape(layoutRows(t('normal', 'wide', 'normal'), 4))).toEqual([[[2, 4, 2], 0]]);
  });

  it('a wide tile that does not fit moves to the next row and leaves a gap', () => {
    expect(shape(layoutRows(t('normal', 'normal', 'normal', 'wide', 'normal'), 4))).toEqual([
      [[2, 2, 2], 2],
      [[4, 2], 2],
    ]);
  });

  it('3 per row: wide + normal fills a row; two wide tiles cannot share one', () => {
    expect(shape(layoutRows(t('wide', 'normal', 'wide', 'wide'), 3))).toEqual([
      [[4, 2], 0],
      [[4], 2],
      [[4], 2],
    ]);
  });
});

describe('categories block settings', () => {
  it('an old block without the new fields reads with defaults', () => {
    const [b] = readStoredBlocks([{ id: 'old1', type: 'categories', title: 'קטגוריות', categoryIds: ['a1'] }]) as BlockOf<'categories'>[];
    expect(b).toMatchObject({ desktopPerRow: 4, mobilePerRow: 2, mobileRatio: 'square', items: {}, categoryIds: ['a1'] });
  });

  it('keeps valid settings and drops empty ones', () => {
    const r = parseBlocks([
      {
        id: 'b1',
        type: 'categories',
        title: 'קטגוריות',
        desktopPerRow: 3,
        mobilePerRow: 1,
        mobileRatio: 'wide',
        items: { a1: { imageUrl: 'https://x.example/a.jpg', size: 'wide' }, a2: { imageUrl: '', size: 'normal' } },
      },
    ]);
    expect(r.ok).toBe(true);
    const b = (r as { value: BlockOf<'categories'>[] }).value[0]!;
    expect(b).toMatchObject({ desktopPerRow: 3, mobilePerRow: 1, mobileRatio: 'wide' });
    expect(b.items).toEqual({ a1: { imageUrl: 'https://x.example/a.jpg', size: 'wide' } });
  });

  it('unknown layout values fall back to defaults; unsafe image URLs are rejected', () => {
    const r = parseBlocks([{ id: 'b2', type: 'categories', title: '', desktopPerRow: 5, mobilePerRow: 7, mobileRatio: 'tall', items: { a1: { size: 'huge' } } }]);
    expect(r.ok).toBe(true);
    expect((r as { value: BlockOf<'categories'>[] }).value[0]).toMatchObject({ desktopPerRow: 4, mobilePerRow: 2, mobileRatio: 'square', items: {} });
    expect(parseBlocks([{ id: 'b3', type: 'categories', title: '', items: { a1: { imageUrl: 'javascript:alert(1)' } } }]).ok).toBe(false);
    expect(parseBlocks([{ id: 'b4', type: 'categories', title: '', items: { 'bad id!': { imageUrl: '' } } }]).ok).toBe(false);
  });

  it('allows settings for at most 12 categories', () => {
    const items = Object.fromEntries(Array.from({ length: 13 }, (_, i) => [`c${i}`, { imageUrl: '', size: 'wide' }]));
    expect(parseBlocks([{ id: 'b5', type: 'categories', title: '', items }]).ok).toBe(false);
  });
});
