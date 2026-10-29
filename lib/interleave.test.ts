import { describe, expect, it } from 'vitest';
import { interleave } from './interleave';

describe('interleave (mixed products block)', () => {
  const p = (id: string) => ({ id });
  it('takes one from each category in turn, without duplicates', () => {
    const plants = [p('a1'), p('a2'), p('a3')];
    const flowers = [p('b1'), p('a2')];
    const garden = [p('c1')];
    expect(interleave([plants, flowers, garden], 5).map((x) => x.id)).toEqual(['a1', 'b1', 'c1', 'a2', 'a3']);
    expect(interleave([plants, [], garden], 2).map((x) => x.id)).toEqual(['a1', 'c1']);
    expect(interleave([], 4)).toEqual([]);
  });
});
