import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { requireNurseryPage } from '@/lib/nursery-scope';
import { FOLDER_LIST_LIMIT, imageUsage, listNurseryImages, listProductsForAssign } from '@/lib/nursery-images';
import { assignFolderImage, deleteFolderImage, uploadToFolder } from '@/lib/nursery-image-actions';
import { FolderGrid, FolderUploader } from '@/components/admin/image-folder';

export const dynamic = 'force-dynamic';

export default async function NurseryImagesPage(props: { searchParams: Promise<{ show?: string }> }) {
  const { show } = await props.searchParams;
  const { nurseryId } = await requireNurseryPage({ any: ['plant_catalog', 'supplies'] });
  const [{ images, total }, products] = await Promise.all([listNurseryImages(nurseryId), listProductsForAssign(nurseryId)]);
  const usage = await imageUsage(nurseryId, images.map((i) => i.url));
  const tiles = images.map((i) => {
    const usedIn = usage.get(i.url) ?? [];
    return { ...i, usedIn, usedCount: usedIn.length };
  });
  const unassigned = tiles.filter((t) => t.usedCount === 0);
  const onlyUnassigned = show === 'unassigned';

  const tab = (active: boolean) =>
    `rounded-full border px-3.5 py-1.5 text-sm ${
      active ? 'border-transparent bg-brand-600 font-medium text-white' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
    }`;

  return (
    <div className="max-w-4xl space-y-5">
      <Link href="/admin/products" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
        <ArrowRight className="h-4 w-4" />
        חזרה למלאי
      </Link>
      <div>
        <h1 className="text-2xl font-bold">תיקיית תמונות</h1>
        <p className="text-sm text-gray-500">
          העלו תמונות לכאן ושייכו אותן למוצרים, מכאן או מעריכת המוצר. שיוך מכאן מחליף את התמונה הראשית של המוצר ונשמר מיד.
        </p>
      </div>

      <FolderUploader upload={uploadToFolder} />

      <div className="flex flex-wrap gap-2">
        <Link href="/admin/products/images" className={tab(!onlyUnassigned)}>
          הכל ({total})
        </Link>
        <Link href="/admin/products/images?show=unassigned" className={tab(onlyUnassigned)}>
          לא משויכות ({unassigned.length})
        </Link>
      </div>
      {total > FOLDER_LIST_LIMIT && (
        <p className="text-sm text-amber-700">
          מוצגות {FOLDER_LIST_LIMIT} התמונות האחרונות מתוך {total}.
        </p>
      )}

      <FolderGrid images={onlyUnassigned ? unassigned : tiles} products={products} remove={deleteFolderImage} assign={assignFolderImage} />
    </div>
  );
}
