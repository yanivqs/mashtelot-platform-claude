import { describe, expect, it } from 'vitest';
import { lightRange, lightScale, waterAmount, waterScale } from './scales';

describe('lightRange — ניסוחי הקטלוג', () => {
  it.each([
    ['שמש מלאה', [0, 0]],
    ['קרינת שמש ישירה', [0, 0]],
    ['קרינת שמש ישירה או הצללה חלקית', [0, 1]],
    ['צל חלקי', [1, 1]],
    ['הצללה חלקית', [1, 1]],
    ['הצללה חלקית עד מלאה', [1, 3]],
    ['קרינת שמש ישירה עד הצללה מלאה', [0, 3]],
    ['קרינת שמש ישירה או הצללה קלה מאוד', [0, 1]],
    ['צל מלא', [3, 3]],
    ['הצללה חלקית או אור מלא בבית', [0, 2]],
    ['הרבה אור ללא קרינת שמש ישירה', [2, 2]],
    ['שמש מלאה או לפחות חצי יום שמש', [0, 1]],
    ['שמש חלקית', [1, 1]],
    ['אור עקיף (צמח בית)', [2, 2]],
    ['שמש מלאה עד צל חלקי', [0, 1]],
    ['צל חלקי עד צל מלא', [1, 3]],
  ])('%s', (text, range) => {
    expect(lightRange(text)).toEqual(range);
  });

  it('ריק או לא מזוהה — null', () => {
    expect(lightRange(null)).toBeNull();
    expect(lightRange('')).toBeNull();
    expect(lightRange('לפי העונה')).toBeNull();
  });
});

describe('lightScale', () => {
  it('כותרת קצרה והסבר קבוע כשהניסוח רק חוזר על הכותרת', () => {
    const s = lightScale('קרינת שמש ישירה או הצללה חלקית');
    expect(s.title).toBe('שמש עד חצי צל');
    expect(s.note).not.toContain('קרינת');
  });

  it('ניסוח עם הסתייגות (אזור / בבית) נשמר כהסבר', () => {
    expect(lightScale('באזורים החמים הצללה חלקית בשאר המקומות קרינת שמש ישירה').note).toContain('באזורים החמים');
  });

  it('בחירה ידנית גוברת', () => {
    const s = lightScale('שמש מלאה', { range: [2, 3], note: 'ליד חלון' });
    expect(s.range).toEqual([2, 3]);
    expect(s.note).toBe('ליד חלון');
  });

  it('לא מזוהה — "לפי הנחיות המשתלה" או הניסוח המקורי', () => {
    expect(lightScale(null)).toMatchObject({ range: null, note: 'לפי הנחיות המשתלה' });
    expect(lightScale('לפי העונה')).toMatchObject({ range: null, note: 'לפי העונה' });
  });
});

describe('waterAmount', () => {
  it.each([
    ['בינונית', 2],
    ['מועטה, חסכוני במים', 1],
    ['נמוכה', 1],
    ['מועטה-בינונית', 1.5],
    ['בינונית-מרובה', 2.5],
    ['בינונית-מועטה', 1.5],
    ['גבוהה', 3],
    ['מרובה', 3],
    ['מועטה עד מרובה', 2],
    // מה שאחרי "אך" — הסתייגות, לא נספר
    ['מועטה, חסכוני במים אך נהנה מהשקיה רגילה', 1],
    ['מועטה אך נהנה מהשקייה מרובה', 1],
  ])('%s → %s', (text, amount) => {
    expect(waterAmount(text)).toBe(amount);
  });

  it('ריק — 0', () => {
    expect(waterAmount(null)).toBe(0);
  });
});

describe('waterScale', () => {
  it('ערך פשוט — הסבר קבוע', () => {
    expect(waterScale('בינונית')).toMatchObject({ amount: 2, title: 'השקיה בינונית', note: 'להשקות כשהשכבה העליונה של האדמה מתייבשת.' });
  });

  it('ניסוח מפורט — נשמר כהסבר', () => {
    expect(waterScale('מועטה, חסכוני במים אך נהנה מהשקיה רגילה').note).toBe('מועטה, חסכוני במים אך נהנה מהשקיה רגילה');
  });

  it('בחירה ידנית גוברת', () => {
    expect(waterScale('מועטה', { amount: 3 })).toMatchObject({ amount: 3, title: 'השקיה מרובה' });
  });
});
