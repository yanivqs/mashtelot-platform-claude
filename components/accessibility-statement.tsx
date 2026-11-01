/** הצהרת נגישות (תקנה 35 לתקנות שוויון זכויות לאנשים עם מוגבלות). לא מצהירה על עמידה מלאה — רק על מה שנעשה בפועל. */
const UPDATED_AT = '1 בנובמבר 2026';

export function AccessibilityStatement({
  name,
  phone,
  email,
  physicalNote,
}: {
  name: string;
  phone?: string | null;
  email?: string | null;
  /** משתלה עם מקום פיזי: הפניה לבירור הסדרי הנגישות במקום */
  physicalNote?: boolean;
}) {
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
        <li>התאמה למסכים בכל גודל, כולל טלפון נייד.</li>
        <li>מעבר אוטומטי בין תמונות נעצר למשתמשים שביקשו להפחית תנועה במכשיר.</li>
        <li>בדיקות נגישות אוטומטיות על עמודי החנות המרכזיים.</li>
      </ul>

      <h2 className="mt-8 text-xl font-bold text-gray-900">מגבלות ידועות</h2>
      <ul className="mt-2 list-disc space-y-1 pr-6">
        <li>האתר טרם עבר בדיקה ידנית מלאה בידי מומחה נגישות, וייתכן שחלקים בו אינם נגישים במלואם.</li>
        <li>תוכן של צד שלישי, כמו סרטוני YouTube ומפות Google, אינו בשליטתנו.</li>
      </ul>

      {physicalNote && (
        <>
          <h2 className="mt-8 text-xl font-bold text-gray-900">נגישות המקום הפיזי</h2>
          <p className="mt-2">לפרטים על הסדרי הנגישות במשתלה עצמה, אפשר לפנות אלינו בפרטים שלמטה.</p>
        </>
      )}

      <h2 className="mt-8 text-xl font-bold text-gray-900">נתקלתם בבעיה?</h2>
      <p className="mt-2">נשמח לשמוע ולתקן. אפשר לפנות אלינו בנושא נגישות:</p>
      <ul className="mt-2 space-y-1">
        <li>{name}</li>
        {phone && (
          <li>
            טלפון: <a href={`tel:${phone}`} className="text-brand-700 underline" dir="ltr">{phone}</a>
          </li>
        )}
        {email && (
          <li>
            אימייל: <a href={`mailto:${email}`} className="text-brand-700 underline" dir="ltr">{email}</a>
          </li>
        )}
      </ul>

      <p className="mt-8 text-sm text-gray-600">ההצהרה עודכנה ב-{UPDATED_AT}.</p>
    </article>
  );
}
