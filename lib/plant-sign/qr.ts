import QRCode from 'qrcode';

/**
 * QR כנתיב SVG אחד (וקטורי, חד בהדפסה). עובד גם בדפדפן וגם בשרת.
 * מחזיר את גודל המטריצה ואת הנתיב, ביחידות של מודול אחד.
 */
export function qrPath(text: string): { size: number; d: string } {
  const qr = QRCode.create(text, { errorCorrectionLevel: 'M' });
  const size = qr.modules.size;
  const data = qr.modules.data;
  let d = '';
  for (let y = 0; y < size; y++) {
    let x = 0;
    while (x < size) {
      if (!data[y * size + x]) {
        x++;
        continue;
      }
      // רצף מודולים כהים בשורה — מלבן אחד
      let w = 1;
      while (x + w < size && data[y * size + x + w]) w++;
      d += `M${x} ${y}h${w}v1h-${w}z`;
      x += w;
    }
  }
  return { size, d };
}
