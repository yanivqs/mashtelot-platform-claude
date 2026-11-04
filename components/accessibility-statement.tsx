import type { NurseryAccessibilityInfo } from '@/lib/accessibility';

/**
 * הצהרת נגישות (תקנה 35ה לתקנות שוויון זכויות לאנשים עם מוגבלות).
 * לא מצהירה על עמידה מלאה: רק על מה שנעשה בפועל, ובדיקה ידנית מוזכרת רק אם בעל האתר הזין אותה.
 */
const CODE_UPDATED_AT = '2026-11-03';

const dateFmt = new Intl.DateTimeFormat('he-IL', { dateStyle: 'long', timeZone: 'Asia/Jerusalem' });
const formatDate = (iso: string) => dateFmt.format(new Date(iso));

export function AccessibilityStatement({
  name,
  phone,
  email,
  physicalNote,
  info,
  children,
}: {
  name: string;
  phone?: string | null;
  email?: string | null;
  /** משתלה עם מקום פיזי: הפניה לבירור הסדרי הנגישות במקום */
  physicalNote?: boolean;
  info?: NurseryAccessibilityInfo;
  /** טופס הדיווח של החנות */
  children?: React.ReactNode;
}) {
  const updatedAt = info?.updatedAt && info.updatedAt.slice(0, 10) > CODE_UPDATED_AT ? info.updatedAt : CODE_UPDATED_AT;
  return (
    <article dir="rtl" className="mx-auto max-w-3xl px-6 py-12 leading-relaxed text-gray-700">
      <h1 className="text-3xl font-bold tracking-tight text-gray-900">הצהרת נגישות</h1>
      <p className="mt-4">
        {name} רואה חשיבות בהנגשת האתר לאנשים עם מוגבלות, ופועלת להתאים אותו לתקנות שוויון זכויות לאנשים עם מוגבלות
        (התאמות נגישות לשירות), התשע&quot;ג-2013, ולתקן הישראלי ת&quot;י 5568 ברמה AA.
      </p>

      <h2 className="mt-8 text-xl font-bold text-gray-900">מה נעשה באתר</h2>
      <ul className="mt-2 list-disc space-y-1 pr-6">
        <li>אפשר לנווט במקלדת, כולל קישור לדילוג ישירות לתוכן בתחילת כל עמוד.</li>
        <li>סימון ברור של הרכיב שנמצא בפוקוס.</li>
        <li>מבנה כותרות ותיוג רכיבים בעברית, מימין לשמאל, לטובת קוראי מסך.</li>
        <li>התאמה למסכים בכל גודל, כולל טלפון נייד, ואפשרות להגדיל את התצוגה בדפדפן.</li>
        <li>אפשר לעצור מעבר אוטומטי בין תמונות, והוא נעצר מעצמו למשתמשים שביקשו להפחית תנועה במכשיר.</li>
        <li>בדיקות נגישות אוטומטיות על עמודי החנות המרכזיים, בכל עדכון של האתר.</li>
      </ul>

      <h2 className="mt-8 text-xl font-bold text-gray-900">תפריט הנגישות</h2>
      <p className="mt-2">
        בכל עמוד יש כפתור שפותח תפריט נגישות, וגם קיצור המקשים Ctrl+F10. התפריט לא מחליף את התאמות האתר, אלא מאפשר לכל אחד
        לכוון את התצוגה לצרכיו. ההגדרות נשמרות בדפדפן שלכם בלבד ולא נשלחות אלינו.
      </p>
      <ul className="mt-2 list-disc space-y-1 pr-6">
        <li>התאמות מהירות: לקויי ראייה, דיסלקציה, רגישות להבהובים, קשב וריכוז, גיל השלישי ומוגבלות מוטורית.</li>
        <li>טקסט: הגדלה עד 200%, גובה שורה, מרווח בין אותיות, גופן פשוט ויישור לימין.</li>
        <li>צבעים: ניגודיות כהה או בהירה, שחור ולבן, ורוויית צבע נמוכה או גבוהה.</li>
        <li>
          ניווט וקריאה: עצירת תנועה, הדגשת קישורים וכותרות, סימון פוקוס, סמן עכבר גדול, כפתורים גדולים, סרגל ומסיכת קריאה,
          הסתרת תמונות, תיאור תמונות, מבנה העמוד והקראת טקסט (במכשירים שיש בהם קול בעברית).
        </li>
      </ul>

      {(info?.auditedAt || info?.testedWith) && (
        <>
          <h2 className="mt-8 text-xl font-bold text-gray-900">בדיקות שנעשו</h2>
          <ul className="mt-2 list-disc space-y-1 pr-6">
            {info.auditedAt && (
              <li>
                בדיקה ידנית{info.auditedBy ? ` בידי ${info.auditedBy}` : ''} בתאריך {formatDate(info.auditedAt)}.
              </li>
            )}
            {info.testedWith && <li>נבדק עם: {info.testedWith}.</li>}
          </ul>
        </>
      )}

      <h2 className="mt-8 text-xl font-bold text-gray-900">מגבלות ידועות</h2>
      <ul className="mt-2 list-disc space-y-1 pr-6">
        {!info?.auditedAt && <li>האתר טרם עבר בדיקה ידנית מלאה בידי מומחה נגישות, וייתכן שחלקים בו אינם נגישים במלואם.</li>}
        <li>תוכן של צד שלישי, כמו סרטוני YouTube ומפות Google, אינו בשליטתנו.</li>
      </ul>

      {info?.alternatives && (
        <>
          <h2 className="mt-8 text-xl font-bold text-gray-900">דרכי שירות חלופיות</h2>
          <p className="mt-2 whitespace-pre-line">{info.alternatives}</p>
        </>
      )}

      {physicalNote && (
        <>
          <h2 className="mt-8 text-xl font-bold text-gray-900">נגישות המקום הפיזי</h2>
          <p className="mt-2 whitespace-pre-line">{info?.physicalArrangements || 'לפרטים על הסדרי הנגישות במשתלה עצמה, אפשר לפנות אלינו בפרטים שלמטה.'}</p>
        </>
      )}

      <h2 className="mt-8 text-xl font-bold text-gray-900">נתקלתם בבעיה?</h2>
      <p className="mt-2">נשמח לשמוע ולתקן. אפשר לפנות אלינו בנושא נגישות:</p>
      <ul className="mt-2 space-y-1">
        <li>{name}</li>
        {info?.coordinatorName && <li>רכז/ת נגישות: {info.coordinatorName}</li>}
        {(info?.coordinatorPhone || phone) && (
          <li>
            טלפון:{' '}
            <a href={`tel:${info?.coordinatorPhone || phone}`} className="text-brand-700 underline" dir="ltr">
              {info?.coordinatorPhone || phone}
            </a>
          </li>
        )}
        {(info?.coordinatorEmail || email) && (
          <li>
            אימייל:{' '}
            <a href={`mailto:${info?.coordinatorEmail || email}`} className="text-brand-700 underline" dir="ltr">
              {info?.coordinatorEmail || email}
            </a>
          </li>
        )}
      </ul>

      {children}

      <p className="mt-8 text-sm text-gray-600">ההצהרה עודכנה ב-{formatDate(updatedAt)}.</p>
    </article>
  );
}
