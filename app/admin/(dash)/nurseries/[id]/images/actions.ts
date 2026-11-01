'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { addNurseryImage, deleteNurseryImage } from '@/lib/nursery-images';

/** מנהל הפלטפורמה מעלה ומוחק בתיקייה בלבד. השיוך למוצרים נשאר אצל בעל המשתלה. */
export async function adminUploadToFolder(nurseryId: string, formData: FormData): Promise<{ url?: string; error?: string }> {
  const user = await requireUser(['SUPER_ADMIN']);
  if (!(await prisma.nursery.findUnique({ where: { id: nurseryId }, select: { id: true } }))) return { error: 'המשתלה לא נמצאה' };
  const res = await addNurseryImage(nurseryId, formData.get('file'), user.email);
  if ('error' in res) return { error: res.error };
  revalidatePath(`/admin/nurseries/${nurseryId}/images`);
  return { url: res.image.url };
}

export async function adminDeleteFolderImage(nurseryId: string, id: string): Promise<{ error?: string }> {
  const user = await requireUser(['SUPER_ADMIN']);
  const res = await deleteNurseryImage(nurseryId, id, user.email);
  revalidatePath(`/admin/nurseries/${nurseryId}/images`);
  return res;
}
