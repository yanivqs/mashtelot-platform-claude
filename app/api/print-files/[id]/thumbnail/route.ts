import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

/** תמונה קטנה של קובץ דפוס: אותה הרשאה כמו בהורדה — בעל המשתלה ועובד שלה, או בית הדפוס. */
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getSessionUser();
  if (!user) return new Response('Unauthorized', { status: 401 });
  const file = await prisma.printFile.findUnique({ where: { id }, select: { nurseryId: true, thumbnail: { select: { bytes: true } } } });
  const allowed =
    user.role === 'SUPER_ADMIN' ||
    ((user.role === 'NURSERY_OWNER' || user.role === 'NURSERY_STAFF') && user.nurseryId === file?.nurseryId);
  if (!file?.thumbnail || !allowed) return new Response('Not found', { status: 404 });

  return new Response(new Uint8Array(file.thumbnail.bytes), {
    headers: {
      'Content-Type': 'image/jpeg',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, max-age=3600',
      'Content-Security-Policy': "default-src 'none'; sandbox",
    },
  });
}
