/**
 * מקטין בדפדפן תמונה גדולה לפני ההעלאה: בקשת העלאה מוגבלת בשרת, ותמונה מטלפון עוברת את המגבלה בקלות.
 * אם ההקטנה נכשלת או לא עוזרת — מחזיר את הקובץ המקורי, והשרת יחזיר את הודעת השגיאה.
 */
const SHRINK_ABOVE_BYTES = 3.5 * 1024 * 1024;
const MAX_SIDE = 2400;
const SHRINKABLE = new Set(['image/jpeg', 'image/png', 'image/webp']);

export async function shrinkImageIfNeeded(file: File): Promise<File> {
  if (file.size <= SHRINK_ABOVE_BYTES || !SHRINKABLE.has(file.type)) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    // JPEG בלי שקיפות — רקע לבן לתמונות PNG שקופות
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], `${file.name.replace(/\.\w+$/, '')}.jpg`, { type: 'image/jpeg' });
  } catch {
    return file;
  }
}
