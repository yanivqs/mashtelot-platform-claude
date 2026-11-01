'use server';

import { revalidatePath } from 'next/cache';
import { nurseryActionScope } from '@/lib/nursery-scope';
import type { ModuleRequirement } from '@/lib/nursery-access';
import { addNurseryImage, assignImageToProduct, deleteNurseryImage, listNurseryImages, type FolderImage } from '@/lib/nursery-images';

const PRODUCT_MODULES: ModuleRequirement = { any: ['plant_catalog', 'supplies'] };

function revalidateFolder() {
  revalidatePath('/admin/products/images');
  revalidatePath('/admin/products');
}

/** העלאה מהמחשב לתיקיית התמונות של המשתלה המחוברת. */
export async function uploadToFolder(formData: FormData): Promise<{ url?: string; error?: string }> {
  const scope = await nurseryActionScope(PRODUCT_MODULES);
  if (!scope.ok) return { error: scope.error };
  const res = await addNurseryImage(scope.nurseryId, formData.get('file'), scope.user.email);
  if ('error' in res) return { error: res.error };
  revalidateFolder();
  return { url: res.image.url };
}

/** תמונות התיקייה לחלון הבחירה בעריכת מוצר. */
export async function listFolderImages(): Promise<{ images: FolderImage[]; error?: string }> {
  const scope = await nurseryActionScope(PRODUCT_MODULES);
  if (!scope.ok) return { images: [], error: scope.error };
  return { images: (await listNurseryImages(scope.nurseryId)).images };
}

export async function deleteFolderImage(id: string): Promise<{ error?: string }> {
  const scope = await nurseryActionScope(PRODUCT_MODULES);
  if (!scope.ok) return { error: scope.error };
  const res = await deleteNurseryImage(scope.nurseryId, id, scope.user.email);
  revalidateFolder();
  return res;
}

export async function assignFolderImage(imageId: string, productId: string): Promise<{ error?: string }> {
  const scope = await nurseryActionScope(PRODUCT_MODULES);
  if (!scope.ok) return { error: scope.error };
  const res = await assignImageToProduct(scope.nurseryId, imageId, productId, scope.user.email);
  if (res.error) return res;
  revalidateFolder();
  revalidatePath(`/admin/products/${productId}`);
  revalidatePath('/[tenant]', 'layout');
  return {};
}
