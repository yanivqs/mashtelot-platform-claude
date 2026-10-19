import { describe, expect, it } from 'vitest';
import { safeFileName, sniffPrintFile } from './print-file-sniff';

const bytes = (...parts: Array<number[] | string>) =>
  new Uint8Array(parts.flatMap((p) => (typeof p === 'string' ? [...p].map((c) => c.charCodeAt(0)) : p)));

function png(w: number, h: number) {
  const b = new Uint8Array(33);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, ...[...'IHDR'].map((c) => c.charCodeAt(0))]);
  const dv = new DataView(b.buffer);
  dv.setUint32(16, w);
  dv.setUint32(20, h);
  return b;
}

describe('sniffPrintFile (by content, not by name/type)', () => {
  it('recognises PDF, PNG with size, JPEG with size, TIFF and EPS', () => {
    expect(sniffPrintFile(bytes('%PDF-1.7\n'))).toEqual({ mimeType: 'application/pdf', ext: 'pdf' });
    expect(sniffPrintFile(png(3000, 2000))).toEqual({ mimeType: 'image/png', ext: 'png', widthPx: 3000, heightPx: 2000 });
    // JPEG: SOI, APP0 (אורך 16), SOF0 עם גובה 600 ורוחב 800
    const jpg = bytes([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10], new Array(14).fill(0), [0xff, 0xc0, 0x00, 0x11, 0x08, 0x02, 0x58, 0x03, 0x20, 0x03]);
    expect(sniffPrintFile(jpg)).toEqual({ mimeType: 'image/jpeg', ext: 'jpg', widthPx: 800, heightPx: 600 });
    expect(sniffPrintFile(bytes([0x49, 0x49, 0x2a, 0x00]))?.mimeType).toBe('image/tiff');
    expect(sniffPrintFile(bytes('%!PS-Adobe-3.0 EPSF-3.0'))?.ext).toBe('eps');
  });

  it('rejects active or unknown content even when named like a PDF', () => {
    expect(sniffPrintFile(bytes('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'))).toBeNull();
    expect(sniffPrintFile(bytes('<!doctype html><html>'))).toBeNull();
    expect(sniffPrintFile(bytes([0x50, 0x4b, 0x03, 0x04]))).toBeNull(); // zip
    expect(sniffPrintFile(bytes('MZ'))).toBeNull(); // exe
    expect(sniffPrintFile(new Uint8Array())).toBeNull();
  });
});

describe('safeFileName', () => {
  it('strips paths, control and reserved characters, and uses the detected extension', () => {
    expect(safeFileName('../../etc/passwd', 'pdf')).toBe('passwd.pdf');
    expect(safeFileName('C:\\x\\לוגו "חדש".svg', 'png')).toBe('לוגו חדש.png');
    expect(safeFileName('', 'pdf')).toBe('file.pdf');
  });
});
