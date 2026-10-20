import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { recordAudit } from '@/lib/audit';
import { storageDriver, verifyDownloadToken } from '@/lib/print-storage';

/**
 * הורדת קובץ דפוס פרטי (PT-08): כרטיס חתום ל-5 דקות **וגם** בדיקת הרשאה בכל בקשה —
 * בעל המשתלה של הקובץ (משתלה פעילה) או בית הדפוס. כל הורדה מתועדת ב-Audit.
 */
export const dynamic = 'force-dynamic';

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const token = new URL(req.url).searchParams.get('t') ?? '';
  if (!(await verifyDownloadToken(id, token))) return new Response('Link expired', { status: 403 });

  const user = await getSessionUser();
  if (!user) return new Response('Unauthorized', { status: 401 });
  const file = await prisma.printFile.findUnique({ where: { id } });
  if (!file) return new Response('Not found', { status: 404 });
  // R06: עובד המשתלה כמו בעליה; כותב תוכן — לא (אין לו גישה לבית הדפוס)
  const allowed =
    user.role === 'SUPER_ADMIN' ||
    ((user.role === 'NURSERY_OWNER' || user.role === 'NURSERY_STAFF') && user.nurseryId === file.nurseryId);
  if (!allowed) return new Response('Not found', { status: 404 });

  const bytes = await storageDriver().read(file.storageKey);
  if (!bytes) return new Response('Missing in storage', { status: 404 });

  await recordAudit({
    nurseryId: file.nurseryId,
    actorEmail: user.email,
    action: 'print.file_downloaded',
    entityType: 'PrintFile',
    entityId: file.id,
    metadata: { kind: file.kind },
  });

  return new Response(new Uint8Array(bytes), {
    headers: {
      'Content-Type': file.mimeType,
      'Content-Length': String(bytes.length),
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(file.originalName)}`,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
      'Content-Security-Policy': "default-src 'none'; sandbox",
    },
  });
}
