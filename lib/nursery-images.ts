import 'server-only';
import { prisma } from '@/lib/prisma';
import { recordAudit } from '@/lib/audit';
import { rateLimit } from '@/lib/rate-limit';
import { removeStoredImage, storeImage } from '@/lib/image-storage';

/** תיקיית התמונות של משתלה. כל פעולה מקבלת nurseryId מההקשר המאומת בלבד. */

export const FOLDER_LIST_LIMIT = 500;

export interface FolderImage {
  id: string;
  url: string;
  fileName: string;
}

export interface ImageProductRef {
  id: string;
  title: string;
}

function productTitle(p: { customTitle: string | null; plant: { hebrewName: string } | null; supply: { title: string } | null }): string {
  return p.customTitle || p.plant?.hebrewName || p.supply?.title || 'מוצר ללא שם';
}

const titleFields = {
  id: true,
  customTitle: true,
  plant: { select: { hebrewName: true } },
  supply: { select: { title: true } },
} as const;

export async function addNurseryImage(
  nurseryId: string,
  file: FormDataEntryValue | null,
  actorEmail: string,
): Promise<{ image: FolderImage } | { error: string }> {
  if (!(await rateLimit(`upload-folder:${nurseryId}`, 300, 10 * 60_000)).ok) {
    return { error: 'יותר מדי העלאות בזמן קצר. נסו שוב בעוד מספר דקות.' };
  }
  const stored = await storeImage(file, `nurseries/${nurseryId}`);
  if ('error' in stored) return stored;
  const image = await prisma.nurseryImage.create({
    data: {
      nurseryId,
      url: stored.url,
      storagePath: stored.path,
      fileName: file instanceof File ? file.name.slice(0, 200) : 'תמונה',
      uploadedByEmail: actorEmail,
    },
    select: { id: true, url: true, fileName: true },
  });
  return { image };
}

export async function listNurseryImages(nurseryId: string): Promise<{ images: FolderImage[]; total: number }> {
  const [images, total] = await Promise.all([
    prisma.nurseryImage.findMany({
      where: { nurseryId },
      orderBy: { createdAt: 'desc' },
      take: FOLDER_LIST_LIMIT,
      select: { id: true, url: true, fileName: true },
    }),
    prisma.nurseryImage.count({ where: { nurseryId } }),
  ]);
  return { images, total };
}

/** אילו מוצרים של המשתלה משתמשים בכל תמונה (תמונה ראשית או תמונת וריאנט). */
export async function imageUsage(nurseryId: string, urls: string[]): Promise<Map<string, ImageProductRef[]>> {
  const usage = new Map<string, ImageProductRef[]>();
  if (urls.length === 0) return usage;
  const add = (url: string, ref: ImageProductRef) => {
    const list = usage.get(url) ?? [];
    if (!list.some((r) => r.id === ref.id)) list.push(ref);
    usage.set(url, list);
  };
  const [products, variants] = await Promise.all([
    prisma.nurseryProduct.findMany({
      where: { nurseryId, customImageUrl: { in: urls } },
      select: { ...titleFields, customImageUrl: true },
    }),
    prisma.productVariant.findMany({
      where: { product: { nurseryId }, imageUrls: { hasSome: urls } },
      select: { imageUrls: true, product: { select: titleFields } },
    }),
  ]);
  for (const p of products) add(p.customImageUrl!, { id: p.id, title: productTitle(p) });
  const wanted = new Set(urls);
  for (const v of variants) {
    for (const url of v.imageUrls) {
      if (wanted.has(url)) add(url, { id: v.product.id, title: productTitle(v.product) });
    }
  }
  return usage;
}

/** מחיקה מהתיקייה ומהאחסון. תמונה שמשויכת למוצר לא נמחקת, כדי שלא תישבר בחנות. */
export async function deleteNurseryImage(nurseryId: string, id: string, actorEmail: string): Promise<{ error?: string }> {
  const image = await prisma.nurseryImage.findFirst({ where: { id, nurseryId } });
  if (!image) return { error: 'התמונה לא נמצאה' };
  const used = (await imageUsage(nurseryId, [image.url])).get(image.url)?.length ?? 0;
  if (used > 0) return { error: `התמונה משויכת למוצרים (${used}). יש להחליף בהם את התמונה לפני המחיקה.` };
  await prisma.nurseryImage.delete({ where: { id } });
  await removeStoredImage(image.storagePath);
  await recordAudit({
    nurseryId,
    actorEmail,
    action: 'image.deleted',
    entityType: 'NurseryImage',
    entityId: id,
    metadata: { fileName: image.fileName },
  });
  return {};
}

/** קובע תמונה מהתיקייה כתמונת המוצר. גם התמונה וגם המוצר חייבים להיות של אותה משתלה. */
export async function assignImageToProduct(
  nurseryId: string,
  imageId: string,
  productId: string,
  actorEmail: string,
): Promise<{ error?: string }> {
  const [image, product] = await Promise.all([
    prisma.nurseryImage.findFirst({ where: { id: imageId, nurseryId }, select: { url: true, fileName: true } }),
    prisma.nurseryProduct.findFirst({ where: { id: productId, nurseryId }, select: { id: true } }),
  ]);
  if (!image) return { error: 'התמונה לא נמצאה' };
  if (!product) return { error: 'המוצר לא נמצא' };
  await prisma.nurseryProduct.update({
    where: { id: productId },
    data: { customImageUrl: image.url, imageRequired: false },
  });
  await recordAudit({
    nurseryId,
    actorEmail,
    action: 'product.image_assigned',
    entityType: 'NurseryProduct',
    entityId: productId,
    metadata: { imageId, fileName: image.fileName },
  });
  return {};
}

/** מוצרי המשתלה לבחירה בשיוך: קודם אלה שממתינים לתמונה, ואז לפי שם. */
export async function listProductsForAssign(nurseryId: string) {
  const rows = await prisma.nurseryProduct.findMany({
    where: { nurseryId },
    select: { ...titleFields, customImageUrl: true, imageRequired: true },
  });
  return rows
    .map((p) => ({ id: p.id, title: productTitle(p), hasImage: Boolean(p.customImageUrl), imageRequired: p.imageRequired }))
    .sort((a, b) => Number(b.imageRequired) - Number(a.imageRequired) || a.title.localeCompare(b.title, 'he'));
}
