import { describe, expect, it } from 'vitest';
import { parseInventorySort, sortInventory } from './inventory-sort';

const row = (title: string, price: string, stockQuantity: number, isActive: boolean, score: number) => ({ title, price, stockQuantity, isActive, seo: { score } });
const rows = [row('ורד', '30', 5, true, 40), row('אלוורה', '12.5', 0, false, 90), row('בזיליקום', '100', 12, true, 40)];

describe('inventory sort', () => {
  it('sorts by price numerically, both directions', () => {
    expect(sortInventory(rows, 'price', 'asc').map((r) => r.title)).toEqual(['אלוורה', 'ורד', 'בזיליקום']);
    expect(sortInventory(rows, 'price', 'desc').map((r) => r.title)).toEqual(['בזיליקום', 'ורד', 'אלוורה']);
  });

  it('breaks ties by title and sorts status and seo', () => {
    expect(sortInventory(rows, 'seo', 'asc').map((r) => r.title)).toEqual(['בזיליקום', 'ורד', 'אלוורה']);
    expect(sortInventory(rows, 'status', 'desc')[2]!.title).toBe('אלוורה');
    expect(sortInventory(rows, 'stock', 'asc')[0]!.title).toBe('אלוורה');
  });

  it('ignores unknown keys', () => {
    expect(parseInventorySort('hack', 'x')).toEqual({ key: null, dir: 'asc' });
    expect(parseInventorySort('seo', 'desc')).toEqual({ key: 'seo', dir: 'desc' });
    expect(sortInventory(rows, null, 'asc')).toBe(rows);
  });
});
