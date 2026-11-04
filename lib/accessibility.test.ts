import { describe, expect, it } from 'vitest';
import { parseAccessibilityInfo, reportDaysLeft, reportDueDate, validateReport } from './accessibility';
import { auditRichHtml, auditThemeColors, contrastRatio } from './accessibility-audit';

describe('validateReport', () => {
  const base = { description: 'הכפתור לא נגיש', contactEmail: 'A@B.co' };

  it('requires a description and a way to reply', () => {
    expect(validateReport({ ...base, description: ' ' })).toEqual({ ok: false, error: 'נא לתאר את הבעיה' });
    expect(validateReport({ description: base.description })).toMatchObject({ ok: false });
    expect(validateReport({ description: base.description, contactPhone: '050-1234567' })).toMatchObject({ ok: true });
  });

  it('checks the formats and normalizes the address', () => {
    expect(validateReport({ ...base, contactEmail: 'לא כתובת' })).toMatchObject({ ok: false });
    expect(validateReport({ description: base.description, contactPhone: 'abc' })).toMatchObject({ ok: false });
    const ok = validateReport(base);
    expect(ok.ok && ok.input.contactEmail).toBe('a@b.co');
  });

  it('ignores non-text input', () => {
    expect(validateReport({ description: 5 as unknown as string, contactEmail: 'a@b.co' })).toMatchObject({ ok: false });
  });
});

describe('report deadline', () => {
  const from = new Date('2026-11-03T10:00:00Z');

  it('is 60 days after the notice', () => {
    expect(reportDueDate(from).toISOString()).toBe('2027-01-02T10:00:00.000Z');
    expect(reportDaysLeft(reportDueDate(from), from)).toBe(60);
  });

  it('counts past the date as negative', () => {
    const due = reportDueDate(from);
    expect(reportDaysLeft(due, due)).toBe(0);
    expect(reportDaysLeft(due, new Date(due.getTime() + 3 * 86400000))).toBe(-3);
  });
});

describe('parseAccessibilityInfo', () => {
  it('has safe defaults and rejects bad values', () => {
    const empty = parseAccessibilityInfo(null);
    expect(empty.buttonSide).toBe('left');
    expect(empty.updatedAt).toBeNull();
    const bad = parseAccessibilityInfo({ buttonSide: 'top', auditedAt: 'אתמול', coordinatorName: 7, updatedAt: 'x' });
    expect(bad).toMatchObject({ buttonSide: 'left', auditedAt: '', coordinatorName: '', updatedAt: null });
    expect(parseAccessibilityInfo({ buttonSide: 'right', auditedAt: '2026-10-01' })).toMatchObject({ buttonSide: 'right', auditedAt: '2026-10-01' });
  });
});

describe('auditRichHtml', () => {
  it('finds images without a description, also with an empty alt', () => {
    expect(auditRichHtml('<img src="a.jpg"><img src="b.jpg" alt=""><img src="c.jpg" alt="ורד">').imagesWithoutAlt).toBe(2);
  });

  it('finds empty and vague links, but accepts a linked image with a description', () => {
    const r = auditRichHtml('<a href="/a"></a><a href="/b">לחצו כאן</a><a href="/c"><img src="x" alt="קטלוג"></a><a href="/d">לקטלוג הצמחים</a>');
    expect(r.emptyLinks).toBe(1);
    expect(r.vagueLinks).toBe(1);
  });

  it('counts documents and videos that need a human check', () => {
    const r = auditRichHtml('<a href="/x/price.PDF?v=1">מחירון</a><a href="/y.docx">טופס</a><iframe src="https://youtube-nocookie.com/x"></iframe>');
    expect(r.documents).toBe(2);
    expect(r.videos).toBe(1);
  });

  it('notices skipped heading levels only', () => {
    expect(auditRichHtml('<h2>א</h2><h4>ב</h4>').skippedHeadings).toBe(true);
    expect(auditRichHtml('<h2>א</h2><h3>ב</h3><h2>ג</h2>').skippedHeadings).toBe(false);
  });

  it('clean content has no issues', () => {
    expect(auditRichHtml('<h2>כותרת</h2><p>טקסט <a href="/a">לקטלוג</a></p><img src="a" alt="ורד">')).toEqual({
      imagesWithoutAlt: 0,
      emptyLinks: 0,
      vagueLinks: 0,
      documents: 0,
      videos: 0,
      skippedHeadings: false,
    });
  });
});

describe('colors', () => {
  it('computes the WCAG contrast ratio', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#fff', '#fff')).toBeCloseTo(1, 5);
  });

  it('flags a background that the regular text cannot be read on', () => {
    expect(auditThemeColors({ primary: '#16a34a', accent: '#f97316', background: '#ffffff' })).toEqual([]);
    expect(auditThemeColors({ primary: '#16a34a', accent: '#f97316', background: '#1f2937' }).map((f) => f.id)).toEqual(['theme-background']);
  });
});
