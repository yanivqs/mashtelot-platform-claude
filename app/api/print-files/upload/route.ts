import { promises as fs } from 'fs';
import path from 'path';
import { localPath, storageDriver, verifyUploadTicket } from '@/lib/print-storage';
import { MAX_PRINT_FILE_BYTES } from '@/lib/print-file-sniff';

/**
 * העלאה לאחסון המקומי (פיתוח/בדיקות בלבד — ב-Production ההעלאה ישירה ל-Supabase בקישור חתום).
 * מקבל רק כרטיס העלאה חתום ובתוקף; מגבלת גודל נאכפת תוך כדי קריאה.
 */
export const dynamic = 'force-dynamic';

export async function PUT(req: Request) {
  if (storageDriver().name !== 'local') return new Response('Not found', { status: 404 });
  const ticket = await verifyUploadTicket(new URL(req.url).searchParams.get('t') ?? '');
  if (!ticket) return new Response('Invalid or expired upload ticket', { status: 403 });
  if (Number(req.headers.get('content-length') ?? 0) > MAX_PRINT_FILE_BYTES) return new Response('Too large', { status: 413 });

  const chunks: Uint8Array[] = [];
  let size = 0;
  const reader = req.body?.getReader();
  if (!reader) return new Response('Empty', { status: 400 });
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_PRINT_FILE_BYTES) return new Response('Too large', { status: 413 });
    chunks.push(value);
  }
  const file = localPath(ticket.key);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, Buffer.concat(chunks));
  return new Response(null, { status: 200 });
}
