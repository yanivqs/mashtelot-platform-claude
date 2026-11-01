import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { FOLDER_LIST_LIMIT, imageUsage, listNurseryImages } from '@/lib/nursery-images';
import { FolderGrid, FolderUploader } from '@/components/admin/image-folder';
import { adminDeleteFolderImage, adminUploadToFolder } from './actions';

export const dynamic = 'force-dynamic';

export default async function AdminNurseryImagesPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  await requireUser(['SUPER_ADMIN']);
  const nursery = await prisma.nursery.findUnique({ where: { id }, select: { id: true, name: true } });
  if (!nursery) notFound();

  const { images, total } = await listNurseryImages(id);
  const usage = await imageUsage(id, images.map((i) => i.url));
  const tiles = images.map((i) => ({ ...i, usedCount: usage.get(i.url)?.length ?? 0 }));

  return (
    <div className="max-w-4xl space-y-5">
      <Link href={`/admin/nurseries/${id}`} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
        <ArrowRight className="h-4 w-4" />
        חזרה ל{nursery.name}
      </Link>
      <div>
        <h1 className="text-2xl font-bold">תיקיית תמונות: {nursery.name}</h1>
        <p className="text-sm text-gray-500">התמונות שתעלו כאן יופיעו אצל בעל המשתלה, והוא ישייך אותן למוצרים.</p>
      </div>
      <FolderUploader upload={adminUploadToFolder.bind(null, id)} />
      {total > FOLDER_LIST_LIMIT && (
        <p className="text-sm text-amber-700">
          מוצגות {FOLDER_LIST_LIMIT} התמונות האחרונות מתוך {total}.
        </p>
      )}
      <FolderGrid images={tiles} remove={adminDeleteFolderImage.bind(null, id)} />
    </div>
  );
}
