'use client';

import { useActionState } from 'react';
import { useKeepFormValues } from '@/components/admin/use-keep-form-values';
import { useFormStatus } from 'react-dom';
import { ImageUpload } from '@/components/admin/image-upload';
import type { CarouselConfig } from '@/lib/theme';
import { updateNursery, type NurseryFormState } from './actions';
import { CarouselEditor } from './carousel-editor';
import { OpeningHoursEditor } from './opening-hours-editor';
import { WazeIcon } from '@/components/waze-icon';
import { wazeUrl } from '@/lib/waze';
import type { OpeningHoursRow } from '@/lib/theme';

export interface NurseryFormValues {
  id: string;
  name: string;
  subdomain: string;
  customDomain: string | null;
  ownerEmail: string;
  logoUrl: string | null;
  phoneNumber: string | null;
  contactEmail: string | null;
  aboutText: string | null;
  addressLine: string | null;
  city: string | null;
  mapLink: string | null;
  primaryColor: string | null;
  accentColor: string | null;
  backgroundColor: string;
  headerStyle: string;
  openingHours: OpeningHoursRow[];
  hero: {
    layout: string;
    headline: string | null;
    subheadline: string | null;
    imageUrl: string | null;
    ctaText: string | null;
    ctaHref: string | null;
  };
  stickyHeader: boolean;
  carousel: CarouselConfig;
}

const initial: NurseryFormState = {};
const field =
  'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-500';

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
      disabled={pending}
    >
      {pending ? 'שומר...' : 'שמירת שינויים'}
    </button>
  );
}

function Text({
  name,
  label,
  defaultValue,
  full,
  placeholder,
  dir,
}: {
  name: string;
  label: string;
  defaultValue?: string | null;
  full?: boolean;
  placeholder?: string;
  dir?: 'ltr';
}) {
  return (
    <label className={`text-sm ${full ? 'sm:col-span-2' : ''}`}>
      <span className="mb-1 block font-medium text-gray-700">{label}</span>
      <input
        name={name}
        defaultValue={defaultValue ?? ''}
        placeholder={placeholder}
        dir={dir}
        className={field}
      />
    </label>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="sm:col-span-2">
      <legend className="mb-3 mt-2 border-b border-gray-100 pb-1 text-sm font-bold text-gray-900">
        {title}
      </legend>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

export function NurseryProfileForm({
  nursery,
  scope,
  canEditDesign = true,
  canEditCarousel = true,
}: {
  nursery: NurseryFormValues;
  scope: 'owner' | 'super';
  canEditDesign?: boolean;
  canEditCarousel?: boolean;
}) {
  const [state, formAction] = useActionState(updateNursery, initial);
  const keep = useKeepFormValues(state);
  const isSuper = scope === 'super';
  const showDesign = isSuper || canEditDesign;
  const showCarousel = showDesign && (isSuper || canEditCarousel);
  const carouselHidden = (
    <>
      <input type="hidden" name="carouselSlides" value={JSON.stringify(nursery.carousel.slides)} />
      <input type="hidden" name="carouselInterval" value={nursery.carousel.intervalSec} />
    </>
  );

  return (
    <form ref={keep} action={formAction} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="id" value={nursery.id} />

      <Section title="כללי">
        <Text name="name" label="שם המשתלה" defaultValue={nursery.name} />
        {isSuper && (
          <>
            <Text name="subdomain" label="תת-דומיין" defaultValue={nursery.subdomain} dir="ltr" />
            <Text
              name="customDomain"
              label="דומיין מותאם אישית"
              defaultValue={nursery.customDomain}
              dir="ltr"
              placeholder="www.example.co.il"
            />
            <Text name="ownerEmail" label="אימייל בעלים" defaultValue={nursery.ownerEmail} dir="ltr" />
          </>
        )}
        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block font-medium text-gray-700">טקסט "אודות"</span>
          <textarea name="aboutText" rows={3} defaultValue={nursery.aboutText ?? ''} className={field} />
        </label>
        <div className="sm:col-span-2">
          <ImageUpload name="logoUrl" defaultValue={nursery.logoUrl} label="לוגו" folder="logos" />
        </div>
      </Section>

      <Section title="יצירת קשר ומיקום">
        <Text name="phoneNumber" label="טלפון" defaultValue={nursery.phoneNumber} dir="ltr" />
        <Text name="contactEmail" label="אימייל ליצירת קשר" defaultValue={nursery.contactEmail} dir="ltr" />
        <Text name="addressLine" label="כתובת" defaultValue={nursery.addressLine} />
        <Text name="city" label="עיר / יישוב" defaultValue={nursery.city} />
        <div className="sm:col-span-2">
          <button
            type="button"
            onClick={(e) => {
              const form = e.currentTarget.form;
              const get = (n: string) => String((form?.elements.namedItem(n) as HTMLInputElement | null)?.value ?? '').trim();
              const address = [get('addressLine'), get('city')].filter(Boolean).join(', ');
              if (address) window.open(wazeUrl(address), '_blank', 'noopener');
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-sm font-medium text-sky-800 hover:bg-sky-100"
          >
            <WazeIcon />
            בדיקת הכתובת ב-Waze
          </button>
          <span className="mr-2 text-xs text-gray-500">בחנות יוצג אייקון Waze ליד הכתובת, שפותח ניווט אליה.</span>
        </div>
        <Text
          name="mapLink"
          label="קישור למפה (Google Maps)"
          defaultValue={nursery.mapLink}
          dir="ltr"
          full
          placeholder="https://maps.google.com/... או קישור embed"
        />
        <OpeningHoursEditor initial={nursery.openingHours} />
      </Section>

      {!showDesign && (
        <>
          <input type="hidden" name="heroLayout" value={nursery.hero.layout} />
          <input type="hidden" name="heroHeadline" value={nursery.hero.headline ?? ''} />
          <input type="hidden" name="heroSubheadline" value={nursery.hero.subheadline ?? ''} />
          <input type="hidden" name="heroImageUrl" value={nursery.hero.imageUrl ?? ''} />
          <input type="hidden" name="heroCtaText" value={nursery.hero.ctaText ?? ''} />
          <input type="hidden" name="heroCtaHref" value={nursery.hero.ctaHref ?? ''} />
          <input type="hidden" name="primaryColor" value={nursery.primaryColor ?? ''} />
          <input type="hidden" name="accentColor" value={nursery.accentColor ?? ''} />
          <input type="hidden" name="backgroundColor" value={nursery.backgroundColor} />
          <input type="hidden" name="headerStyle" value={nursery.headerStyle} />
          {nursery.stickyHeader && <input type="hidden" name="stickyHeader" value="on" />}
          {carouselHidden}
        </>
      )}

      {showDesign && (
      <Section title="עיצוב ו-Hero">
        <label className="text-sm">
          <span className="mb-1 block font-medium text-gray-700">פריסת ה-Hero</span>
          <select name="heroLayout" defaultValue={nursery.hero.layout} className={field}>
            <option value="centered">ממורכז</option>
            <option value="split">טקסט + תמונה</option>
            <option value="image">תמונת רקע מלאה</option>
            {(showCarousel || nursery.hero.layout === 'carousel') && (
              <option value="carousel">קרוסלת תמונות</option>
            )}
          </select>
        </label>
        <label className="flex items-center gap-2 self-end text-sm">
          <input
            type="checkbox"
            name="stickyHeader"
            defaultChecked={nursery.stickyHeader}
            className="h-4 w-4 rounded border-gray-300"
          />
          <span className="font-medium text-gray-700">כותרת עליונה נדבקת (sticky)</span>
        </label>
        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block font-medium text-gray-700">סגנון הכותרת בנייד</span>
          <select name="headerStyle" defaultValue={nursery.headerStyle} className={field}>
            <option value="classic">קלאסי — סרגל עליון + ניווט תחתון</option>
            <option value="float">צף — לוגו, תפריט וחיפוש יורדים לתחתית המסך בגלילה</option>
            <option value="floatTop">צף — לוגו, תפריט וחיפוש מוצגים בחלק העליון</option>
          </select>
        </label>
        <Text name="heroHeadline" label="כותרת ראשית" defaultValue={nursery.hero.headline} full />
        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block font-medium text-gray-700">כותרת משנה</span>
          <textarea
            name="heroSubheadline"
            rows={2}
            defaultValue={nursery.hero.subheadline ?? ''}
            className={field}
          />
        </label>
        <Text name="heroCtaText" label="טקסט כפתור" defaultValue={nursery.hero.ctaText} placeholder="לכל הקטלוג" />
        <Text name="heroCtaHref" label="קישור כפתור" defaultValue={nursery.hero.ctaHref} dir="ltr" placeholder="/catalog" />
        <div className="sm:col-span-2">
          <ImageUpload
            name="heroImageUrl"
            defaultValue={nursery.hero.imageUrl}
            label="תמונת Hero (לפריסת טקסט+תמונה / רקע מלא)"
            folder="logos"
            hint="מידה מומלצת: רקע מלא 1920×800 פיקסלים; טקסט+תמונה 1200×900 פיקסלים. כדאי שהעיקר יהיה במרכז התמונה."
          />
        </div>
        <Text name="primaryColor" label="צבע ראשי (hex)" defaultValue={nursery.primaryColor} dir="ltr" placeholder="#16a34a" />
        <Text name="accentColor" label="צבע משני (hex)" defaultValue={nursery.accentColor} dir="ltr" placeholder="#16a34a" />
        <Text name="backgroundColor" label="צבע רקע החנות (hex)" defaultValue={nursery.backgroundColor} dir="ltr" placeholder="#ffffff" />
        {showCarousel ? <CarouselEditor carousel={nursery.carousel} /> : carouselHidden}
      </Section>
      )}

      <div className="flex items-center gap-3 sm:col-span-2">
        <SaveButton />
        {state.ok && <span className="text-sm text-green-700">נשמר ✓</span>}
        {state.error && <span className="text-sm text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}
