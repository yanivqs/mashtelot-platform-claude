/**
 * רענון דפי החנות אחרי שמירה בניהול. דפי החנות שמורים במטמון עד שעה (revalidate), ולכן כל שמירה
 * שמשנה את מה שמוצג בחנות צריכה לרענן אותם — אחרת הלקוח רואה את המידע הישן.
 *
 * למה תבנית הנתיב ולא כתובת המשתלה: Next מתייג כל דף שמור בתגיות שנגזרות מתבנית הנתיב
 * (/[tenant]/layout, /[tenant]/product/layout...) ובכתובת המדויקת של הדף בלבד
 * (node_modules/next/dist/server/lib/implicit-tags.js). לכן revalidatePath('/demo-nursery', 'layout')
 * לא תופס אף דף, ורק revalidatePath('/[tenant]', 'layout') מרענן את דפי החנות.
 * המחיר: רענון של כל החנויות, שנבנות מחדש רק בביקור הבא בכל דף — זניח במספר המשתלות הנוכחי.
 */
import 'server-only';
import { revalidatePath } from 'next/cache';

/** רענון דפי החנות אחרי שמירה שמשנה את מה שמוצג בה (מוצר, קטגוריה, עיצוב, תוכן, הגדרות) */
export function refreshStore(): void {
  revalidatePath('/[tenant]', 'layout');
}
