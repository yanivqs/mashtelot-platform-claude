import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireNurseryPage } from '@/lib/nursery-scope';
import { prisma } from '@/lib/prisma';
import { getNurseryTheme } from '@/lib/theme';
import { getSalesMode } from '@/lib/sales';
import { loadBlockData } from '@/lib/page-builder';
import { editorState } from '@/lib/page-builder-admin';
import { BlockList } from '@/components/page-blocks/block-list';
import { CartProvider } from '@/components/cart/cart-provider';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'תצוגה מקדימה', robots: { index: false, follow: false } };

/** R03-01: תצוגה מקדימה של הטיוטה — באותם רכיבים של החנות, רק למשתמשי המשתלה. */
export default async function DraftPreview(props: { params: Promise<{ target: string }> }) {
  const { target } = await props.params;
  const isHome = target === 'home';
  const { nurseryId } = await requireNurseryPage(
    isHome ? { all: ['page_builder'], area: 'general' } : { all: ['page_builder', 'static_pages'], area: 'content' },
  );
  const nursery = await prisma.nursery.findUnique({ where: { id: nurseryId } });
  if (!nursery) notFound();
  let title = nursery.name;
  if (!isHome) {
    const page = await prisma.staticPage.findFirst({ where: { id: target, nurseryId }, select: { title: true } });
    if (!page) notFound();
    title = page.title;
  }
  const { draft } = await editorState(prisma, nurseryId, isHome ? { kind: 'home' } : { kind: 'page', staticPageId: target });
  const theme = getNurseryTheme(nursery);

  return (
    <CartProvider tenant={nursery.subdomain} salesMode={await getSalesMode(nurseryId)}>
      <div style={{ '--brand': theme.colors.primary, '--accent': theme.colors.accent } as React.CSSProperties} className="min-h-screen bg-white">
        <div className="bg-amber-100 px-4 py-1.5 text-center text-xs text-amber-900">תצוגה מקדימה של הטיוטה — לא מפורסם</div>
        {draft.length === 0 ? (
          <p className="p-10 text-center text-gray-500">הוסיפו בלוק כדי לראות כאן את הדף.</p>
        ) : (
          <BlockList blocks={draft} nursery={nursery} data={await loadBlockData(nurseryId, draft)} title={title} showTitle={!isHome} />
        )}
      </div>
    </CartProvider>
  );
}
