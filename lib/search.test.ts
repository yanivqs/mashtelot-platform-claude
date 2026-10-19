import { describe, expect, it } from 'vitest';
import {
  buildSearchDoc,
  buildSynonymIndex,
  compileQuery,
  editDistance,
  normalizeText,
  parseSynonymGroup,
  scoreDoc,
  wordForms,
} from './search';

const syn = buildSynonymIndex([
  ['סוקולנט', 'בשרנים'],
  ['ריחן', 'בזיליקום'],
  ['צמחי בית', 'צמחי פנים'],
  ['בוגנוויליה', 'בוגונביליה'],
]);
const match = (q: string, ...doc: string[]) => scoreDoc(compileQuery(q, syn)!, buildSearchDoc(doc));

describe('normalizeText', () => {
  it('removes niqqud, final letters, quotes and punctuation', () => {
    expect(normalizeText('שָׁלוֹם')).toBe('שלומ');
    expect(normalizeText('"זנב-שועל"')).toBe('זנב שועל');
    expect(normalizeText('עץ  ')).toBe('עצ');
    expect(normalizeText('Lavandula Angustifolia')).toBe('lavandula angustifolia');
    expect(normalizeText('צ׳ילי')).toBe('צילי');
  });
});

describe('wordForms', () => {
  it('strips up to two prefixes and plural suffixes, keeping a 3-letter stem', () => {
    expect(wordForms('והורדימ')).toEqual(expect.arrayContaining(['והורדימ', 'הורדימ', 'ורדימ', 'ורד']));
    expect(wordForms('ורדימ')).toContain('ורד');
    expect(wordForms('לבנדר')).toContain('בנדר');
    // אין קיצור מתחת לשורש של 3 אותיות
    expect(wordForms('שמ')).toEqual(['שמ']);
  });
  it('leaves latin words untouched', () => {
    expect(wordForms('rosa')).toEqual(['rosa']);
  });
});

describe('editDistance', () => {
  it('counts substitutions, insertions and adjacent transpositions', () => {
    expect(editDistance('לבנדר', 'לבדנר', 2)).toBe(1);
    expect(editDistance('לבנדר', 'לבנדרר', 2)).toBe(1);
    expect(editDistance('abc', 'xyz', 1)).toBe(2);
  });
});

describe('scoreDoc', () => {
  it('keeps the old substring behavior', () => {
    expect(match('ורד', 'ורד אדום')).toBeGreaterThan(0);
    expect(match('אדו', 'ורד אדום')).toBeGreaterThan(0);
  });

  it('matches plural/singular and prefixed forms', () => {
    expect(match('ורדים', 'ורד אדום')).toBeGreaterThan(0);
    expect(match('הורדים', 'ורד אדום')).toBeGreaterThan(0);
    expect(match('ורד', 'שתילי ורדים')).toBeGreaterThan(0);
  });

  it('final letters do not matter', () => {
    expect(match('עצ', 'עץ זית')).toBeGreaterThan(0);
    expect(match('עץ', 'עצי פרי')).toBeGreaterThan(0);
  });

  it('tolerates typos by word length', () => {
    expect(match('לבדנר', 'לבנדר רפואי')).toBeGreaterThan(0); // 5 אותיות, חילוף אחד
    expect(match('בוגנויליה', 'בוגנוויליה סגולה')).toBeGreaterThan(0); // 9 אותיות
    expect(match('lavandla', 'Lavandula angustifolia')).toBeGreaterThan(0);
    expect(match('זת', 'זית סורי')).toBe(0); // מילה קצרה — ללא סובלנות
  });

  it('expands synonyms (single words and phrases)', () => {
    expect(match('סוקולנט', 'בשרנים מעורבים')).toBeGreaterThan(0);
    expect(match('בזיליקום', 'ריחן ריחני')).toBeGreaterThan(0);
    expect(match('צמחי בית', 'מבחר צמחי פנים')).toBeGreaterThan(0);
  });

  it('requires every query word (AND)', () => {
    expect(match('ורד לבן', 'ורד אדום')).toBe(0);
    expect(match('ורד אדום', 'ורד אדום מטפס')).toBeGreaterThan(0);
  });

  it('does not over-match through stripped prefixes', () => {
    expect(match('שמיר', 'מירטוס מצוי')).toBe(0);
    expect(match('מנטה', 'נטע צעיר')).toBe(0);
  });

  it('ranks exact above prefix above typo', () => {
    const exact = match('ורד', 'ורד');
    const prefix = match('ורד', 'ורדינה');
    const typo = match('לבנדר', 'לבדנר');
    expect(exact).toBeGreaterThan(prefix);
    expect(prefix).toBeGreaterThan(typo);
  });

  it('empty query compiles to null', () => {
    expect(compileQuery('  ', syn)).toBeNull();
    expect(compileQuery('"-"', syn)).toBeNull();
  });
});

describe('synonym groups', () => {
  it('parses comma/newline separated input and drops duplicates', () => {
    expect(parseSynonymGroup('נענע, מנטה ,\nנענע')).toEqual(['נענע', 'מנטה']);
  });
  it('ignores groups with fewer than two distinct terms', () => {
    expect(buildSynonymIndex([['ורד'], ['ורד', 'ורד']]).size).toBe(0);
  });
  it('merges overlapping groups', () => {
    const idx = buildSynonymIndex([['א1', 'ב1'], ['ב1', 'ג1']]);
    expect(idx.get('ב1')).toEqual(expect.arrayContaining(['א1', 'ב1', 'ג1']));
  });
});
