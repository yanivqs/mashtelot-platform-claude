import { describe, expect, it } from 'vitest';
import { flattenCategoryTree, categoryAndDescendantIds } from './category-tree';

const items = [
  { id: 'trees', name: 'עצים', parentId: null, sortOrder: 0 },
  { id: 'fruit', name: 'עצי פרי', parentId: 'trees', sortOrder: 0 },
  { id: 'citrus', name: 'הדרים', parentId: 'fruit', sortOrder: 0 },
  { id: 'shrubs', name: 'שיחים', parentId: null, sortOrder: 1 },
  { id: 'orphan', name: 'יתום', parentId: 'deleted-parent', sortOrder: 2 },
];

describe('flattenCategoryTree', () => {
  it('orders parents before children with depth for indentation', () => {
    const flat = flattenCategoryTree(items);
    expect(flat.map((f) => [f.id, f.depth])).toEqual([
      ['trees', 0],
      ['fruit', 1],
      ['citrus', 2],
      ['shrubs', 0],
      ['orphan', 0],
    ]);
  });
});

describe('categoryAndDescendantIds', () => {
  it('returns the category plus all nested descendants', () => {
    expect(categoryAndDescendantIds(items, 'trees').sort()).toEqual(['citrus', 'fruit', 'trees']);
  });

  it('returns just the leaf itself when it has no children', () => {
    expect(categoryAndDescendantIds(items, 'shrubs')).toEqual(['shrubs']);
  });
});
