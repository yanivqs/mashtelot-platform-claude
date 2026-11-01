/**
 * בלוק קטגוריות בבונה העמודים: הסדר נקבע במסך הקטגוריות, לא לפי סדר הסימון בעורך.
 */
import { vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { newBlock, type Block } from '@/lib/page-blocks';
import { loadBlockData } from '@/lib/page-builder';
import { createTenantFixtures, destroyTenantFixtures, type TenantFixtures } from './fixtures';

let f: TenantFixtures;

beforeAll(async () => {
  f = await createTenantFixtures(prisma);
});

afterAll(async () => {
  await destroyTenantFixtures(prisma, f);
});

describe('categories block order', () => {
  it('shows the selected categories by the saved order, not by selection order', async () => {
    const nurseryId = f.A.nurseryId;
    const slug = (s: string) => `order-${s}-${f.runId}`;
    const parent = await prisma.nurseryCategory.create({ data: { nurseryId, name: 'אב', slug: slug('parent'), sortOrder: 1 } });
    const child = await prisma.nurseryCategory.create({ data: { nurseryId, name: 'בן', slug: slug('child'), parentId: parent.id } });
    const first = await prisma.nurseryCategory.create({ data: { nurseryId, name: 'ראשונה', slug: slug('first'), sortOrder: 0 } });
    await prisma.nurseryProduct.create({
      data: {
        nurseryId,
        customTitle: 'מוצר לסדר',
        price: '10.00',
        categories: { create: [{ nurseryCategoryId: child.id }, { nurseryCategoryId: first.id }] },
      },
    });

    const block = { ...newBlock('categories'), categoryIds: [child.id, parent.id, first.id] } as Block;
    const data = await loadBlockData(nurseryId, [block]);
    expect(data.categories[block.id]!.map((c) => c.id)).toEqual([first.id, parent.id, child.id]);
  });
});
