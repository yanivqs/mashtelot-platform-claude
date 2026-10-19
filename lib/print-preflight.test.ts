import { describe, expect, it } from 'vitest';
import { parseProfile, pdfBoxMm, preflight, type ProductionProfile } from './print-preflight';

const enc = (s: string) => new TextEncoder().encode(s);
const mm = (x: number) => (x * 72) / 25.4; // mm → pt
const pdf = (wMm: number, hMm: number, extra = '') =>
  enc(`%PDF-1.7\n1 0 obj << /Type /Page /MediaBox [0 0 ${mm(wMm).toFixed(2)} ${mm(hMm).toFixed(2)}] ${extra}>> endobj\n`);
const PDF_SNIFF = { mimeType: 'application/pdf' as const, ext: 'pdf' };
const profile: ProductionProfile = { widthMm: 100, heightMm: 50, bleedMm: 3, minDpi: 300 };

describe('parseProfile', () => {
  it('optional; validates ranges; defaults bleed 0 and 300 DPI', () => {
    expect(parseProfile(null)).toEqual({ ok: true, value: null });
    expect(parseProfile({})).toEqual({ ok: true, value: null });
    expect(parseProfile({ widthMm: 100, heightMm: 50 })).toEqual({ ok: true, value: { widthMm: 100, heightMm: 50, bleedMm: 0, minDpi: 300 } });
    expect(parseProfile({ widthMm: -1, heightMm: 50 }).ok).toBe(false);
    expect(parseProfile({ widthMm: 100, heightMm: 50, minDpi: 30 }).ok).toBe(false);
  });
});

describe('PDF checks', () => {
  it('reads the page size; TrimBox wins over MediaBox', () => {
    expect(pdfBoxMm(pdf(100, 50))!.map(Math.round)).toEqual([100, 50]);
    const withTrim = enc(`%PDF-1.7\n<< /MediaBox [0 0 ${mm(106)} ${mm(56)}] /TrimBox [${mm(3)} ${mm(3)} ${mm(103)} ${mm(53)}] >>`);
    expect(pdfBoxMm(withTrim)!.map(Math.round)).toEqual([100, 50]);
  });

  it('accepts trim size or size with bleed (and rotated); warns when bleed is missing', () => {
    expect(preflight(pdf(106, 56), PDF_SNIFF, profile).critical).toEqual([]);
    expect(preflight(pdf(56, 106), PDF_SNIFF, profile).critical).toEqual([]);
    const noBleed = preflight(pdf(100, 50), PDF_SNIFF, profile);
    expect(noBleed.critical).toEqual([]);
    expect(noBleed.warnings.join()).toContain('ללא גלישה');
  });

  it('wrong size and encrypted PDFs are critical', () => {
    expect(preflight(pdf(210, 297), PDF_SNIFF, profile).critical[0]).toContain('אינן תואמות');
    expect(preflight(pdf(106, 56, '/Encrypt 5 0 R '), PDF_SNIFF, profile).critical[0]).toContain('מוצפן');
  });

  it('unreadable size is a warning, not a block', () => {
    const r = preflight(enc('%PDF-1.7\n% compressed object streams\n'), PDF_SNIFF, profile);
    expect(r.critical).toEqual([]);
    expect(r.warnings.join()).toContain('לא ניתן לקרוא');
  });
});

describe('raster checks', () => {
  const png = (w: number, h: number) => ({ mimeType: 'image/png' as const, ext: 'png', widthPx: w, heightPx: h });
  it('effective DPI against the print size with bleed', () => {
    // 106×56 מ"מ ב-300 DPI ≈ 1252×661
    expect(preflight(new Uint8Array(), png(1260, 670), profile)).toMatchObject({ critical: [], info: { effectiveDpi: 301 } });
    const low = preflight(new Uint8Array(), png(1000, 528), profile);
    expect(low.critical).toEqual([]);
    expect(low.warnings.join()).toContain('מתחת ל-300');
    expect(preflight(new Uint8Array(), png(400, 211), profile).critical[0]).toContain('נמוכה מדי');
  });
  it('aspect ratio mismatch warns', () => {
    expect(preflight(new Uint8Array(), png(2000, 2000), profile).warnings.join()).toContain('יחס');
  });
  it('without a profile nothing is blocked', () => {
    expect(preflight(new Uint8Array(), png(10, 10), null).critical).toEqual([]);
  });
});
