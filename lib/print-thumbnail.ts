/**
 * תמונה קטנה של קובץ דפוס, נוצרת בדפדפן בזמן ההעלאה: PNG/JPG דרך canvas, ועמוד ראשון של PDF דרך pdf.js.
 * TIFF/EPS — הדפדפן לא מציג אותם, ואז אין תמונה ומוצג סוג הקובץ. כשל כאן לא עוצר את ההעלאה.
 */
const MAX_SIDE = 400;

function toJpeg(source: CanvasImageSource, width: number, height: number): string | null {
  const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.75);
}

async function pdfFirstPage(file: File): Promise<string | null> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer(), isEvalSupported: false }).promise;
  try {
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: Math.min(2, (MAX_SIDE * 2) / Math.max(base.width, base.height)) });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    await page.render({ canvasContext: ctx, viewport }).promise;
    return toJpeg(canvas, canvas.width, canvas.height);
  } finally {
    await doc.destroy();
  }
}

export async function makeThumbnail(file: File): Promise<string | null> {
  try {
    const type = file.type || '';
    const name = file.name.toLowerCase();
    if (type === 'application/pdf' || name.endsWith('.pdf')) return await pdfFirstPage(file);
    if (type === 'image/png' || type === 'image/jpeg' || /\.(png|jpe?g)$/.test(name)) {
      const bitmap = await createImageBitmap(file);
      try {
        return toJpeg(bitmap, bitmap.width, bitmap.height);
      } finally {
        bitmap.close();
      }
    }
    return null;
  } catch {
    return null;
  }
}
