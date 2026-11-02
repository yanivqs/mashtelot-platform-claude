import { expect, test, type Page } from './fixtures';
import { ADMIN } from '../playwright.config';
import { E2E_OWNER2, E2E_PRINT_TEMPLATE, E2E_SUPER5 as E2E_SUPER } from './global-setup';

async function login(page: Page, user: { email: string; password: string }) {
  await page.context().clearCookies();
  await page.goto(`${ADMIN}/admin/login`);
  await page.locator('input[name="email"]').fill(user.email);
  await page.locator('input[name="password"]').fill(user.password);
  await page.getByRole('button', { name: 'כניסה' }).click();
  await expect(page).toHaveURL(`${ADMIN}/admin`);
}

test('editor: tabs, drag, duplicate; nursery: calculator, review reasons, job and reorder at the updated price', async ({ page }) => {
  test.setTimeout(90000);
  await login(page, E2E_SUPER);
  await page.getByRole('link', { name: 'תבניות דפוס' }).click();
  await page.getByLabel('שם המוצר').fill(E2E_PRINT_TEMPLATE);
  await page.getByRole('button', { name: 'יצירה' }).click();
  await expect(page.getByRole('heading', { level: 1, name: E2E_PRINT_TEMPLATE })).toBeVisible();
  const cards = page.getByTestId('template-field-card');
  const addField = page.getByRole('button', { name: 'הוספת שדה' });

  // שדה 1: חומר. אין מפתחות באנגלית בעורך
  await addField.click();
  await expect(page.getByLabel(/מפתח שדה/)).toHaveCount(0);
  await page.getByLabel('שם שדה 1').fill('חומר');
  await cards.nth(0).getByRole('button', { name: 'הוספת אפשרות' }).click();
  await cards.nth(0).getByRole('button', { name: 'הוספת אפשרות' }).click();
  await page.getByLabel('שם אפשרות 1 בשדה 1').fill('נייר');
  await page.getByLabel('שם אפשרות 2 בשדה 1').fill('PVC');
  await cards.nth(0).getByLabel('תוספת ליחידה לאפשרות 2').fill('0.5');

  // שדה 2: סוג דבק, חובה, מוצג רק אם חומר = PVC
  await addField.click();
  await page.getByLabel('שם שדה 2').fill('סוג דבק');
  await cards.nth(1).getByRole('button', { name: 'הוספת אפשרות' }).click();
  await page.getByLabel('שם אפשרות 1 בשדה 2').fill('קבוע');
  await page.getByLabel('שדה 2 חובה').check();
  await page.getByLabel('שדה תנאי לשדה 2').selectOption({ label: 'חומר' });
  await page.getByLabel('ערך תנאי לשדה 2').selectOption({ label: 'PVC' });

  // שדה 3: טקסט, ושכפול שלו מיד מתחתיו
  await addField.click();
  await page.getByLabel('שם שדה 3').fill('טקסט');
  await page.getByLabel('סוג שדה 3').selectOption('text');
  await page.getByLabel('שדה 3 חובה').check();
  await page.getByRole('button', { name: 'שכפול שדה 3' }).click();
  await expect(page.getByLabel('שם שדה 4')).toHaveValue('טקסט (עותק)');
  await page.getByLabel('שם שדה 4').fill('כיתוב נוסף');
  await page.getByLabel('שדה 4 חובה').uncheck();

  // גרירה: השדה האחרון עובר לראש הרשימה (מסך גבוה, כדי ששני הקלפים ייראו יחד)
  await page.setViewportSize({ width: 1280, height: 2200 });
  await cards.nth(3).getByTestId('field-drag-handle').dragTo(cards.nth(0));
  await expect(page.getByLabel('שם שדה 1')).toHaveValue('כיתוב נוסף');
  await expect(page.getByLabel('שם שדה 2')).toHaveValue('חומר');
  // חצים: מחזירים את "טקסט" מקום אחד למעלה ושוב למטה
  await page.getByRole('button', { name: 'הזזת שדה 4 למעלה' }).click();
  await expect(page.getByLabel('שם שדה 3')).toHaveValue('טקסט');
  await page.getByRole('button', { name: 'הזזת שדה 3 למטה' }).click();
  await expect(page.getByLabel('שם שדה 4')).toHaveValue('טקסט');

  // לשונית תמחור: מדרגה וכמויות בטבלה
  await page.getByRole('tab', { name: 'כמויות ותמחור' }).click();
  await page.getByLabel(/מחיר ליחידה מתחת למדרגות/).fill('1');
  await page.getByLabel('עלות הקמה להזמנה (₪)').fill('50');
  await page.getByLabel('כמות מינימום').fill('100');
  await page.getByRole('button', { name: 'הוספת כמות' }).click();
  await page.getByLabel('כמות מוגדרת 1').fill('500');
  await page.getByRole('button', { name: 'הוספת כמות' }).click();
  await page.getByLabel('כמות מוגדרת 2').fill('1000');
  await page.getByRole('button', { name: 'הוספת מדרגה' }).click();
  await page.getByLabel('מדרגה 1: מכמות').fill('500');
  await page.getByLabel('מדרגה 1: מחיר').fill('0.8');

  // סימון "תמיד דורש הצעת צוות" מעל מחירון מקבל אזהרה. ברירת המחדל: מחיר מיידי
  await expect(page.getByTestId('quote-only-warning')).toHaveCount(0);
  await page.getByText('תמיד דורש הצעת צוות', { exact: true }).click();
  await expect(page.getByTestId('quote-only-warning')).toBeVisible();
  await page.getByText('תמיד דורש הצעת צוות', { exact: true }).click();
  await expect(page.getByTestId('quote-only-warning')).toHaveCount(0);

  await page.getByRole('tab', { name: 'בדיקת קובץ' }).click();
  await page.getByLabel('רוחב המוצר במ״מ').fill('100');
  await page.getByLabel('גובה המוצר במ״מ').fill('50');
  await page.getByLabel('גלישה במ״מ').fill('3');

  await page.getByRole('button', { name: 'שמירת טיוטה' }).click();
  await expect(page.getByText('הטיוטה נשמרה ✓')).toBeVisible();
  await page.getByRole('button', { name: 'פרסום גרסה 1' }).click();
  await expect(page.getByRole('heading', { name: 'גרסה 1 — מפורסמת (נעולה)' })).toBeVisible();
  await expect(page.getByText('מוצג רק אם חומר = PVC')).toBeVisible();
  await expect(page.getByText(/ייצור 100×50 מ"מ, גלישה 3, 300 DPI/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'יצירת גרסה חדשה (טיוטה)' })).toBeVisible();
  // הגרסה המפורסמת מציגה את כל מה שהוגדר
  const published = page.getByTestId('published-version');
  await expect(published).toContainText('PVC');
  await expect(published).toContainText('0.5');
  await expect(published).toContainText(/500, ?1,000/);
  await expect(published).toContainText('מ-500');
  await expect(published).toContainText('מחיר מיידי');
  const editorUrl = page.url();
  await page.getByText('מוצג למשתלות להזמנה').click();
  await page.getByRole('button', { name: 'שמירת פרטי המוצר' }).click();
  await expect(page.getByText('נשמר ✓')).toBeVisible();

  // בעל המשתלה: קטלוג ← דף מוצר
  await login(page, E2E_OWNER2);
  await page.goto(`${ADMIN}/admin/print-shop`);
  await page.getByRole('link', { name: new RegExp(E2E_PRINT_TEMPLATE) }).click();
  await expect(page.getByRole('heading', { level: 1, name: E2E_PRINT_TEMPLATE })).toBeVisible();

  const material = page.getByLabel(/^חומר/);
  const glue = page.getByLabel(/^סוג דבק/);
  const send = page.getByRole('button', { name: /קבלת מחיר והזמנה|שליחה לבדיקה/ });

  // הסדר אצל המשתלה זהה לסדר בעורך
  await page.getByLabel('כיתוב נוסף').fill('מבצע');
  const order = await page.evaluate(() => {
    const a = document.querySelector('label[for^="pf-"]')!;
    const b = document.querySelector('[role="group"][aria-label="כמות"]')!;
    return { firstText: a.textContent, fieldComesFirst: Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) };
  });
  expect(order).toEqual({ firstText: 'כיתוב נוסף', fieldComesFirst: true });

  // שדה מותנה מופיע רק כשבוחרים PVC, ונעלם כשמבטלים
  await expect(material.locator('option', { hasText: 'PVC' })).toHaveText(/0\.5/);
  await expect(glue).toHaveCount(0);
  await material.selectOption('opt_2');
  await expect(glue).toBeVisible();
  await material.selectOption('');
  await expect(glue).toHaveCount(0);
  await material.selectOption('opt_2');

  // חוסרים חוסמים שליחה
  await expect(page.getByTestId('print-missing')).toContainText('סוג דבק: יש לבחור');
  await expect(page.getByTestId('print-missing')).toContainText('טקסט: שדה חובה');
  await expect(send).toBeDisabled();
  await glue.selectOption('opt_1');
  await page.getByRole('textbox', { name: /^טקסט/ }).fill('ורד אדום');
  await expect(send).toBeEnabled();

  // (0.8 מדרגת 500 + 0.5 PVC) × 500 + הקמה 50 = 700
  await expect(page.getByTestId('print-price')).toContainText('700');

  // כמות שלא ברשימה עוברת לבדיקת צוות, בלי מחיר
  await page.getByLabel('כמות אחרת').fill('750');
  await expect(page.getByTestId('print-review')).toContainText('כמות מותאמת אישית');
  await expect(page.getByTestId('print-price')).toHaveCount(0);

  await page.getByRole('group', { name: 'כמות' }).getByRole('button', { name: '500' }).click();
  await expect(page.getByTestId('print-price')).toContainText('700');
  await send.click();
  await expect(page.getByTestId('print-confirmation')).toContainText('ההזמנה התקבלה');
  await expect(page.getByTestId('print-confirmation')).toContainText('700');

  // העבודות שלי: שם, תאריך, תיאור, כמות, מחיר
  await page.getByRole('link', { name: 'לעבודות שלי' }).click();
  const job = page.getByTestId('job-card').filter({ hasText: E2E_PRINT_TEMPLATE });
  await expect(job).toContainText('חומר: PVC');
  await expect(job).toContainText('טקסט: ורד אדום');
  await expect(job).toContainText(/הזמנה אחרונה:/);
  await expect(job).toContainText(/כמות:\s*500/);
  await expect(job).toContainText(/מחיר אחרון:.*700/);

  // הזמנה חוזרת: מחיר מעודכן מול האחרון. 1.3 × 1000 + 50 = 1350
  await job.getByRole('button', { name: 'הזמן שוב' }).click();
  await job.getByRole('group', { name: 'כמות' }).getByRole('button', { name: '1,000' }).click();
  await expect(job.getByTestId('reorder-price')).toContainText('1,350');
  await expect(job.getByTestId('reorder-price')).toContainText('בהזמנה האחרונה');
  await job.getByRole('button', { name: 'שליחת הזמנה' }).click();
  await expect(job.getByText(/ההזמנה התקבלה ✓/)).toBeVisible();
  await page.reload();
  await expect(job).toContainText(/הוזמנה:\s*2 פעמים/);
  await expect(job).toContainText(/מחיר אחרון:.*1,350/);

  // שינוי שם
  await job.getByRole('button', { name: /שינוי שם/ }).click();
  await page.getByLabel('שם העבודה').fill('מדבקת ורד');
  await page.getByRole('button', { name: 'שמירה' }).click();
  await expect(page.getByRole('heading', { name: 'מדבקת ורד' })).toBeVisible();

  // בית הדפוס רואה את ההזמנה עם הערכים
  await login(page, E2E_SUPER);
  await page.goto(`${ADMIN}/admin/print-orders`);
  await expect(page.getByText(/חומר: PVC · סוג דבק: קבוע · טקסט: ורד אדום/).first()).toBeVisible();

  // גרסה חדשה נפתחת עם כל מה שהוגדר בקודמת
  await page.goto(editorUrl);
  await page.getByRole('button', { name: 'יצירת גרסה חדשה (טיוטה)' }).click();
  await expect(page.getByLabel('שם שדה 2')).toHaveValue('חומר');
  await expect(page.getByLabel('שם אפשרות 2 בשדה 2')).toHaveValue('PVC');
  await expect(page.getByTestId('template-field-card').nth(1).getByLabel('תוספת ליחידה לאפשרות 2')).toHaveValue('0.5');
  await expect(page.getByLabel('שדה תנאי לשדה 3')).toHaveValue(/field_/);
  await page.getByRole('tab', { name: 'כמויות ותמחור' }).click();
  await expect(page.getByLabel('כמות מוגדרת 2')).toHaveValue('1000');
  await expect(page.getByLabel('מדרגה 1: מחיר')).toHaveValue('0.8');
  await expect(page.getByLabel('עלות הקמה להזמנה (₪)')).toHaveValue('50');
  await page.getByRole('tab', { name: 'בדיקת קובץ' }).click();
  await expect(page.getByLabel('רוחב המוצר במ״מ')).toHaveValue('100');
});
