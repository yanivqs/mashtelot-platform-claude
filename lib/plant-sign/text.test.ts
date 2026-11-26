import { describe, expect, it } from 'vitest';
import { composeSignDescription, DESCRIPTION_TARGET, mergeTraits, plainText, signDescription, truncate } from './text';

describe('composeSignDescription', () => {
  it('צמח עם הרבה נתונים: פסקה במשפטים שלמים, עד יעד האורך', () => {
    const text = composeSignDescription({
      description: 'שיח בינוני, אוורירי',
      height: 'מ- 1 מטר עד 2 מטר',
      uniqueness: 'מושך פרפרים, מושך צופיות, פריחה ריחנית, פריחה מעניינת',
      floweringSeason: 'באביב ובקיץ',
      flowerColor: 'אדום',
      evergreen: 'ירוק-עד',
      growthRate: 'מהיר',
      care: 'גיזום באביב; דישון בקיץ',
    });
    expect(text.startsWith('שיח בינוני, אוורירי, בגובה מ-1 מטר עד 2 מטר.')).toBe(true);
    expect(text).toContain('מושך פרפרים וצופיות, פריחה ריחנית ומעניינת.');
    expect(text).toContain('פריחה באביב ובקיץ, בגוון אדום.');
    expect(text.length).toBeLessThanOrEqual(DESCRIPTION_TARGET);
    expect(text.endsWith('.')).toBe(true);
  });

  it('בלי תיאור — פתיחה מסוג הצמח (ביחיד)', () => {
    expect(composeSignDescription({ plantType: 'שיחים', evergreen: 'ירוק-עד' })).toBe('שיח. עלווה ירוקה כל השנה.');
    expect(composeSignDescription({ plantType: 'מטפסים', height: "5 מ'" })).toBe("צמח מטפס, בגובה 5 מ'.");
  });

  it('עונה "רוב השנה", שלל צבעים וכמה גוונים', () => {
    expect(composeSignDescription({ floweringSeason: 'רוב השנה', flowerColor: 'שלל צבעים' })).toBe('פריחה לאורך רוב השנה, בשלל צבעים.');
    expect(composeSignDescription({ floweringSeason: 'קיץ', flowerColor: 'לבן, ורוד' })).toBe('פריחה בקיץ, בגוונים לבן, ורוד.');
  });

  it('פריחה לא משמעותית — לא מוזכרת', () => {
    expect(composeSignDescription({ flowering: 'לא משמעותית', floweringSeason: 'באביב', flowerColor: 'לבן' })).toBe('');
  });

  it('צמח בלי נתונים — ריק', () => {
    expect(composeSignDescription({})).toBe('');
  });

  it('"עונתי- חורפי" מנורמל', () => {
    expect(composeSignDescription({ description: 'עונתי- חורפי' })).toBe('עונתי-חורפי.');
  });
});

describe('mergeTraits', () => {
  it('מאחד תכונות עם אותה מילה ראשונה', () => {
    expect(mergeTraits('פריחה שופעת, פריחה בולטת, פריחה ממושכת')).toBe('פריחה שופעת, בולטת וממושכת');
    expect(mergeTraits('מושך צופיות')).toBe('מושך צופיות');
    expect(mergeTraits('לבלוב מאדים, עלווה מבריקה')).toBe('לבלוב מאדים, עלווה מבריקה');
  });
});

describe('signDescription — סדר העדיפויות', () => {
  const plant = { plantType: 'שיחים' };
  it('טקסט שנשמר בשלט ← תיאור המשתלה ← הרכבה', () => {
    expect(signDescription({ saved: 'טקסט שלי', productDescription: '<p>תיאור ארוך של המשתלה לצמח הזה</p>', plant })).toBe('טקסט שלי');
    expect(signDescription({ saved: null, productDescription: '<p>תיאור ארוך של המשתלה&nbsp;לצמח הזה</p>', plant })).toBe(
      'תיאור ארוך של המשתלה לצמח הזה',
    );
    expect(signDescription({ saved: null, productDescription: 'קצר', plant })).toBe('שיח.');
  });
});

describe('truncate / plainText', () => {
  it('קיצור במשפט שלם, או במילה עם שלוש נקודות', () => {
    expect(truncate('משפט ראשון ארוך. משפט שני ארוך מאוד מאוד', 30)).toBe('משפט ראשון ארוך.');
    expect(truncate('מילה מילה מילה מילה מילה', 12)).toBe('מילה מילה…');
  });
  it('HTML → טקסט', () => {
    expect(plainText('<p>שורה&nbsp;א</p><p>שורה &amp; ב</p>')).toBe('שורה א שורה & ב');
  });
});
