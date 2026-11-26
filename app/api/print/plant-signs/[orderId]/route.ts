import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { recordAudit } from '@/lib/audit';
import { generatePlantSignsPdf } from '@/lib/plant-sign/production';

/**
 * בית הדפוס בלבד: הפקת PDF לדפוס של שלטי הצמחים בהזמנה (Chromium בשרת) ושמירתו כקובץ הייצור.
 * נתיב נפרד (ולא פעולת שרת בדף) כדי ש-Chromium ייטען רק כאן, עם זמן ריצה מורחב.
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(_req: Request, ctx: { params: Promise<{ orderId: string }> }) {
  const user = await getSessionUser();
  if (!user || user.role !== 'SUPER_ADMIN') return Response.json({ error: 'אין הרשאה' }, { status: 403 });
  const { orderId } = await ctx.params;
  try {
    const res = await generatePlantSignsPdf(prisma, orderId, user.email);
    if (!res.ok) return Response.json({ error: res.error }, { status: 400 });
    const order = await prisma.printOrder.findUnique({ where: { id: orderId }, select: { nurseryId: true } });
    await recordAudit({
      nurseryId: order?.nurseryId ?? null,
      actorEmail: user.email,
      action: 'print.plant_signs_pdf',
      entityType: 'PrintOrder',
      entityId: orderId,
      metadata: { fileId: res.fileId, pages: res.pages, warnings: res.warnings.length },
    });
    return Response.json({ ok: true, fileId: res.fileId, pages: res.pages, warnings: res.warnings });
  } catch (e) {
    console.error('plant signs pdf failed', e);
    // הנתיב לסופר-אדמין בלבד — מציגים את סיבת הכשל כדי לאבחן בלי גישה ללוגים
    const detail = (e instanceof Error ? `${e.name}: ${e.message}` : String(e)).replace(/\s+/g, ' ').slice(0, 400);
    return Response.json({ error: `הפקת ה-PDF נכשלה — ${detail}` }, { status: 500 });
  }
}
