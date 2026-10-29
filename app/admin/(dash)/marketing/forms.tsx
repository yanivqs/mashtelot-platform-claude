'use client';

import { useActionState, useState } from 'react';
import { useKeepFormValues } from '@/components/admin/use-keep-form-values';
import { useFormStatus } from 'react-dom';
import { createCoupon, createPromotion, saveAnnouncement, type MarketingState } from './actions';

const initial: MarketingState = {};
const field =
  'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-500';

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
      disabled={pending}
    >
      {pending ? 'שומר...' : label}
    </button>
  );
}

export function CouponForm() {
  const [state, action] = useActionState(createCoupon, initial);
  const keep = useKeepFormValues(state);
  return (
    <form ref={keep} action={action} className="flex flex-wrap items-end gap-3">
      <label className="text-sm">
        <span className="mb-1 block font-medium text-gray-700">קוד</span>
        <input name="code" required placeholder="SPRING10" className={`${field} w-40`} />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium text-gray-700">אחוז הנחה</span>
        <input name="discountPct" type="number" min="1" max="100" required className={`${field} w-28`} />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium text-gray-700">בתוקף מ-</span>
        <input name="startsAt" type="date" className={`${field} w-40`} />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium text-gray-700">בתוקף עד</span>
        <input name="endsAt" type="date" className={`${field} w-40`} />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium text-gray-700">מגבלת שימושים</span>
        <input name="usageLimit" type="number" min="1" placeholder="ללא הגבלה" className={`${field} w-32`} />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium text-gray-700">מגבלה ללקוח</span>
        <input name="perCustomerLimit" type="number" min="1" placeholder="ללא הגבלה" className={`${field} w-32`} />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium text-gray-700">מינימום הזמנה (₪)</span>
        <input name="minOrderAmount" type="number" min="0" step="0.01" placeholder="ללא" className={`${field} w-32`} />
      </label>
      <Submit label="הוספת קופון" />
      {state.ok && <span className="text-sm text-green-700">נוסף ✓</span>}
      {state.error && <span className="text-sm text-red-600">{state.error}</span>}
    </form>
  );
}

export function PromotionForm() {
  const [state, action] = useActionState(createPromotion, initial);
  const keep1 = useKeepFormValues(state);
  return (
    <form ref={keep1} action={action} className="space-y-3">
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-gray-700">כותרת (פנימי)</span>
        <input name="title" required className={field} />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-gray-700">טקסט הפופאפ (מוצג ללקוח)</span>
        <textarea name="popupText" rows={2} required className={field} />
      </label>
      <div className="flex items-center gap-3">
        <Submit label="הוספת פופאפ" />
        {state.ok && <span className="text-sm text-green-700">נוסף ✓</span>}
        {state.error && <span className="text-sm text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}

export interface AnnouncementValues {
  enabled: boolean;
  text: string | null;
  linkText: string | null;
  href: string | null;
  tone: 'brand' | 'accent';
}

/** הודעת סטיקי בראש החנות, עם קישור לדף באתר (בחירה מהרשימה או נתיב חופשי). */
export function AnnouncementForm({ value, links }: { value: AnnouncementValues; links: { href: string; label: string }[] }) {
  const [state, action] = useActionState(saveAnnouncement, initial);
  const keep = useKeepFormValues(state);
  const [href, setHref] = useState(value.href ?? '');
  return (
    <form ref={keep} action={action} className="grid gap-3 sm:grid-cols-2">
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input name="enabled" type="checkbox" defaultChecked={value.enabled} className="h-4 w-4" />
        <span className="font-medium text-gray-700">להציג את ההודעה בראש כל דפי החנות</span>
      </label>
      <label className="text-sm sm:col-span-2">
        <span className="mb-1 block font-medium text-gray-700">טקסט ההודעה</span>
        <input name="text" maxLength={140} defaultValue={value.text ?? ''} placeholder="משלוח חינם בהזמנה מעל ₪300" className={field} />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium text-gray-700">טקסט הקישור</span>
        <input name="linkText" maxLength={40} defaultValue={value.linkText ?? ''} placeholder="לצמחי הבית" className={field} />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium text-gray-700">צבע</span>
        <select name="tone" defaultValue={value.tone} className={field}>
          <option value="brand">צבע ראשי</option>
          <option value="accent">צבע משני</option>
        </select>
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium text-gray-700">קישור לדף באתר</span>
        <select value={links.some((l) => l.href === href) ? href : ''} onChange={(e) => e.target.value && setHref(e.target.value)} className={field}>
          <option value="">בחירה מהרשימה…</option>
          {links.map((l) => (
            <option key={l.href} value={l.href}>
              {l.label}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium text-gray-700">או נתיב / כתובת</span>
        <input name="href" dir="ltr" value={href} onChange={(e) => setHref(e.target.value)} placeholder="/catalog?category=..." className={field} />
      </label>
      <div className="flex items-center gap-3 sm:col-span-2">
        <Submit label="שמירת ההודעה" />
        {state.ok && <span className="text-sm text-green-700">נשמר ✓</span>}
        {state.error && <span className="text-sm text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}
