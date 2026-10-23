import 'server-only';
import { prisma } from '@/lib/prisma';
import { flattenCategoryTree } from '@/lib/category-tree';
import { formatIsrael } from '@/lib/il-time';
import { tenantOrigin } from '@/lib/seo';
import { editorState, type LayoutTarget } from '@/lib/page-builder-admin';
import type { VersionRow } from '@/components/admin/page-builder/editor';

/** כל מה שהעורך צריך — רק נתוני המשתלה שבהקשר. */
export async function loadEditorProps(nurseryId: string, target: LayoutTarget, storePath: string) {
  const [state, categories, nursery] = await Promise.all([
    editorState(prisma, nurseryId, target),
    prisma.nurseryCategory.findMany({ where: { nurseryId } }),
    prisma.nursery.findUnique({ where: { id: nurseryId }, select: { subdomain: true, customDomain: true } }),
  ]);
  const manualIds = state.draft.flatMap((b) => (b.type === 'products' ? b.productIds : []));
  const products = manualIds.length
    ? await prisma.nurseryProduct.findMany({
        where: { nurseryId, id: { in: manualIds } },
        select: { id: true, customTitle: true, plant: { select: { hebrewName: true } }, supply: { select: { title: true } } },
      })
    : [];
  const versions: VersionRow[] = state.versions.map((v) => ({
    version: v.version,
    state: v.state,
    publishAtLabel: formatIsrael(v.publishAt),
    createdByEmail: v.createdByEmail,
  }));
  const targetParam = target.kind === 'home' ? 'home' : target.staticPageId;
  return {
    target: targetParam,
    initialBlocks: state.draft,
    versions,
    isActive: state.isActive,
    categories: flattenCategoryTree(categories),
    productTitles: Object.fromEntries(products.map((p) => [p.id, p.customTitle || p.plant?.hebrewName || p.supply?.title || 'מוצר'])),
    previewUrl: `/admin/preview/${targetParam}`,
    storeUrl: nursery ? `${tenantOrigin(nursery)}${storePath}` : null,
  };
}
