/** ייבוא מאגר דוגמאות מקובץ CSV (סקריפט הייבוא והבדיקות). בשרת בלבד — csv-parse לא נכנס לדפדפן. */
import { parse } from 'csv-parse/sync';

// ---------- ייבוא מ-CSV ----------

export interface CsvDesign {
  code: string;
  title: string;
  imageUrl: string;
  tags: string[];
  sortOrder: number;
  isActive: boolean;
}

export interface CsvImport {
  designs: CsvDesign[];
  /** תיאור כללי של הקטגוריה (מהשורה הראשונה שיש בה תיאור), בלי HTML */
  description: string | null;
  notes: string[];
}

// בשם קובץ התמונה הקוד צמוד לקו תחתון ("c4471cb9f_SC9599-6.jpg"), ולכן לא \b
const CODE_RE = /(?<![A-Z])(SC\d{4,})(?!\d)/i;

const stripHtml = (s: string) =>
  s
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();

/** "\n" שנשמר כטקסט בקובץ — לשורה חדשה; מרכאות כפולות מיותרות מסביב — מוסרות */
const cleanText = (s: string) =>
  stripHtml(
    s
      .replace(/\\n/g, '\n')
      .replace(/^"+|"+$/g, '')
      .replace(/""/g, '"'),
  )
    .split('\n')
    .map((l) => l.trimEnd())
    .join('\n')
    .trim();

/**
 * ניקוי (החלטת בעלים): דוגמא כפולה (אותו קוד ואותו שם) נכנסת פעם אחת; קוד שחוזר עם שם אחר מקבל
 * את הקוד שבשם קובץ התמונה, אם הוא פנוי (SC9598 "שרטוט פרח 6" → SC9599). אפשרויות גודל בקובץ — מתעלמים.
 */
export function parseCardsCsv(text: string): CsvImport {
  const rows = parse(text.replace(/^﻿/, ''), { columns: true, skip_empty_lines: true, relax_quotes: true }) as Array<Record<string, string>>;
  const notes: string[] = [];
  const byCode = new Map<string, CsvDesign>();
  const pending: Array<{ row: Record<string, string>; code: string; title: string; index: number }> = [];
  let description: string | null = null;

  rows.forEach((row, index) => {
    const name = (row.name ?? '').trim();
    const code = (name.match(CODE_RE)?.[1] ?? row.sku?.match(CODE_RE)?.[1] ?? '').toUpperCase();
    if (!code) {
      notes.push(`שורה ${index + 2} בלי קוד — דולגה`);
      return;
    }
    const title = cleanText(name.replace(CODE_RE, '').replace(/^[\s\-–—:]+/, '')) || code;
    if (!description && row.description) description = cleanText(row.description) || null;
    pending.push({ row, code, title, index });
  });

  const usedCodes = new Set(pending.map((p) => p.code));
  for (const p of pending) {
    const imageUrl = (p.row.images ?? '').split('|')[0]!.trim();
    let code = p.code;
    const existing = byCode.get(code);
    if (existing) {
      if (existing.title === p.title) {
        notes.push(`${code} מופיע פעמיים — נכנס פעם אחת`);
        continue;
      }
      const fromImage = imageUrl.match(CODE_RE)?.[1]?.toUpperCase();
      if (fromImage && fromImage !== code && !usedCodes.has(fromImage)) {
        notes.push(`${code} "${p.title}" — קיבל את הקוד ${fromImage} לפי שם התמונה`);
        code = fromImage;
        usedCodes.add(code);
      } else {
        notes.push(`${code} "${p.title}" — קוד כפול בלי קוד חלופי, דולג`);
        continue;
      }
    }
    if (!/^https:\/\//.test(imageUrl)) {
      notes.push(`${code} בלי תמונה — דולג`);
      continue;
    }
    const tags = [...new Set((p.row.filterTags ?? '').split('|').map((t) => t.trim()).filter(Boolean))];
    const sort = Number(p.row.sortOrder);
    byCode.set(code, {
      code,
      title: p.title,
      imageUrl,
      tags,
      sortOrder: Number.isFinite(sort) ? sort : p.index * 10,
      isActive: String(p.row.isActive ?? 'TRUE').toUpperCase() !== 'FALSE',
    });
  }

  const designs = [...byCode.values()].sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code));
  return { designs, description, notes };
}
