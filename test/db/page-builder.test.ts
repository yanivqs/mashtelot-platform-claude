/**
 * R03 Page Builder: בידוד בין משתלות, פרסום, תזמון, שחזור וכיבוי.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { newBlock, type Block } from '@/lib/page-blocks';
import {
  HOME_KEY,
  LayoutError,
  cancelScheduled,
  editorState,
  getOrCreateLayout,
  liveBlocks,
  pageKey,
  publishDraft,
  restoreVersion,
  saveDraft,
  setLayoutActive,
} from '@/lib/page-builder-admin';
import { createTenantFixtures, destroyTenantFixtures, type TenantFixtures } from './fixtures';

let f: TenantFixtures;
const home = { kind: 'home' } as const;

function cta(title: string): Block {
  return { ...newBlock('cta'), title } as Block;
}

beforeAll(async () => {
  f = await createTenantFixtures(prisma);
});

afterAll(async () => {
  await destroyTenantFixtures(prisma, f);
  await prisma.$disconnect();
});

describe('R03 page builder', () => {
  it('nothing is live until the first publish', async () => {
    await saveDraft(prisma, f.A.nurseryId, home, [cta('טיוטה')]);
    expect(await liveBlocks(prisma, f.A.nurseryId, HOME_KEY)).toBeNull();
  });

  it('publish makes the draft live; later draft edits do not change the live page', async () => {
    await saveDraft(prisma, f.A.nurseryId, home, [cta('גרסה 1')]);
    const v1 = await publishDraft(prisma, f.A.nurseryId, home, new Date(), 'owner@a.test');
    expect(v1.version).toBe(1);
    await saveDraft(prisma, f.A.nurseryId, home, [cta('עדיין לא')]);
    const live = await liveBlocks(prisma, f.A.nurseryId, HOME_KEY);
    expect(live?.[0]).toMatchObject({ type: 'cta', title: 'גרסה 1' });
  });

  it('a scheduled version goes live only when its time comes, and can be cancelled', async () => {
    await saveDraft(prisma, f.A.nurseryId, home, [cta('מבצע חורף')]);
    const future = new Date(Date.now() + 3600_000);
    const v2 = await publishDraft(prisma, f.A.nurseryId, home, future, null);
    expect((await liveBlocks(prisma, f.A.nurseryId, HOME_KEY))?.[0]).toMatchObject({ title: 'גרסה 1' });
    expect((await liveBlocks(prisma, f.A.nurseryId, HOME_KEY, new Date(future.getTime() + 1000)))?.[0]).toMatchObject({ title: 'מבצע חורף' });
    const state = await editorState(prisma, f.A.nurseryId, home);
    expect(state.versions.find((v) => v.version === v2.version)?.state).toBe('scheduled');
    await cancelScheduled(prisma, f.A.nurseryId, home, v2.version);
    expect((await liveBlocks(prisma, f.A.nurseryId, HOME_KEY, new Date(future.getTime() + 1000)))?.[0]).toMatchObject({ title: 'גרסה 1' });
    await expect(cancelScheduled(prisma, f.A.nurseryId, home, 1)).rejects.toBeInstanceOf(LayoutError);
  });

  it('restore copies an old version into the draft without publishing it', async () => {
    await saveDraft(prisma, f.A.nurseryId, home, [cta('משהו אחר')]);
    await restoreVersion(prisma, f.A.nurseryId, home, 1);
    const state = await editorState(prisma, f.A.nurseryId, home);
    expect(state.draft[0]).toMatchObject({ title: 'גרסה 1' });
  });

  it('turning the layout off returns the store to the regular view', async () => {
    await setLayoutActive(prisma, f.A.nurseryId, home, false);
    expect(await liveBlocks(prisma, f.A.nurseryId, HOME_KEY)).toBeNull();
    await setLayoutActive(prisma, f.A.nurseryId, home, true);
    expect(await liveBlocks(prisma, f.A.nurseryId, HOME_KEY)).not.toBeNull();
  });

  it('an empty draft cannot be published', async () => {
    await saveDraft(prisma, f.B.nurseryId, home, []);
    await expect(publishDraft(prisma, f.B.nurseryId, home, new Date(), null)).rejects.toBeInstanceOf(LayoutError);
  });

  it("tenant isolation: B never sees A's home page and cannot build on A's static page", async () => {
    expect(await liveBlocks(prisma, f.B.nurseryId, HOME_KEY)).toBeNull();
    await expect(getOrCreateLayout(prisma, f.B.nurseryId, { kind: 'page', staticPageId: f.A.pageId })).rejects.toBeInstanceOf(LayoutError);
    await expect(restoreVersion(prisma, f.B.nurseryId, home, 1)).rejects.toBeInstanceOf(LayoutError);
    expect(await prisma.pageLayout.count({ where: { nurseryId: f.B.nurseryId, staticPageId: f.A.pageId } })).toBe(0);
  });

  it('a static page gets its own layout; deleting the page removes it', async () => {
    const target = { kind: 'page', staticPageId: f.A.pageId } as const;
    await saveDraft(prisma, f.A.nurseryId, target, [cta('עמוד')]);
    await publishDraft(prisma, f.A.nurseryId, target, new Date(), null);
    expect((await liveBlocks(prisma, f.A.nurseryId, pageKey(f.A.pageId)))?.[0]).toMatchObject({ title: 'עמוד' });
    expect((await liveBlocks(prisma, f.A.nurseryId, HOME_KEY))?.[0]).toMatchObject({ title: 'גרסה 1' });
    await prisma.staticPage.delete({ where: { id: f.A.pageId } });
    expect(await prisma.pageLayout.count({ where: { staticPageId: f.A.pageId } })).toBe(0);
  });
});
