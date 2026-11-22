/**
 * פנייה מבעל משתלה שרוצה חנות, מטופס "צור קשר" בדף הנחיתה של הפלטפורמה (החלטת בעלים 2026-11-23).
 * הפנייה נשלחת במייל לכתובת הקשר של הפלטפורמה (ניהול → חשבונות → פרטי קשר של הפלטפורמה).
 * טהור — משותף לשרת ולבדיקות.
 */
export interface PlatformLead {
  contactName: string;
  nurseryName: string;
  phone: string;
  email: string;
  notes: string;
}

const text = (v: unknown, max: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

export function validateLead(raw: Record<string, unknown>): { ok: true; lead: PlatformLead } | { ok: false; error: string } {
  const lead: PlatformLead = {
    contactName: text(raw.contactName, 100),
    nurseryName: text(raw.nurseryName, 120),
    phone: text(raw.phone, 30),
    email: text(raw.email, 200).toLowerCase(),
    // בהערות שומרים שורות חדשות
    notes: String(raw.notes ?? '').replace(/\r\n/g, '\n').trim().slice(0, 2000),
  };
  if (!lead.contactName) return { ok: false, error: 'נא למלא שם איש קשר' };
  if (!lead.nurseryName) return { ok: false, error: 'נא למלא את שם המשתלה' };
  if (!lead.phone) return { ok: false, error: 'נא למלא טלפון' };
  if (!/^[0-9+\-\s()]{9,}$/.test(lead.phone) || lead.phone.replace(/\D/g, '').length < 9) return { ok: false, error: 'מספר הטלפון אינו תקין' };
  if (!lead.email) return { ok: false, error: 'נא למלא כתובת מייל' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email)) return { ok: false, error: 'כתובת המייל אינה תקינה' };
  return { ok: true, lead };
}
