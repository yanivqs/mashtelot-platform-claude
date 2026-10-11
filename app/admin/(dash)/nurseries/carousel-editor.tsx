'use client';

import { useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { ImageUpload } from '@/components/admin/image-upload';
import { MAX_CAROUSEL_SLIDES, type CarouselConfig } from '@/lib/theme';

interface EditableSlide {
  key: number;
  imageUrl: string;
  headline: string;
  subheadline: string;
  ctaText: string;
  ctaHref: string;
}

const field =
  'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-500';

let nextKey = 1;

/** עורך שקופיות הקרוסלה. נשלח עם הטופס כ-JSON בשדה נסתר `carouselSlides`. */
export function CarouselEditor({ carousel }: { carousel: CarouselConfig }) {
  const [slides, setSlides] = useState<EditableSlide[]>(() =>
    carousel.slides.map((s) => ({
      key: nextKey++,
      imageUrl: s.imageUrl,
      headline: s.headline ?? '',
      subheadline: s.subheadline ?? '',
      ctaText: s.ctaText ?? '',
      ctaHref: s.ctaHref ?? '',
    })),
  );

  const patch = (key: number, p: Partial<EditableSlide>) =>
    setSlides((all) => all.map((s) => (s.key === key ? { ...s, ...p } : s)));
  const move = (i: number, dir: -1 | 1) =>
    setSlides((all) => {
      const j = i + dir;
      if (j < 0 || j >= all.length) return all;
      const copy = [...all];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });

  const serialized = JSON.stringify(
    slides
      .filter((s) => s.imageUrl)
      .map(({ imageUrl, headline, subheadline, ctaText, ctaHref }) => ({
        imageUrl,
        headline,
        subheadline,
        ctaText,
        ctaHref,
      })),
  );

  return (
    <div className="space-y-4 sm:col-span-2">
      <input type="hidden" name="carouselSlides" value={serialized} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-gray-700">קרוסלת תמונות</p>
          <p className="text-xs text-gray-500">
            מוצגת בראש עמוד הבית כשפריסת ה-Hero היא &quot;קרוסלת תמונות&quot;. טקסט ריק בשקופית =
            הכותרות הכלליות למעלה. עד {MAX_CAROUSEL_SLIDES} תמונות, מומלץ ביחס רוחב 16:9.
          </p>
        </div>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-gray-700">מעבר כל (שניות)</span>
          <input
            name="carouselInterval"
            type="number"
            min={3}
            max={20}
            defaultValue={carousel.intervalSec}
            className={`${field} w-24`}
          />
        </label>
      </div>

      {slides.map((s, i) => (
        <div key={s.key} className="rounded-xl border border-gray-200 p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-bold text-gray-800">שקופית {i + 1}</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => move(i, -1)}
                disabled={i === 0}
                className="rounded p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30"
                aria-label="הזזה למעלה"
              >
                <ArrowUp className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => move(i, 1)}
                disabled={i === slides.length - 1}
                className="rounded p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30"
                aria-label="הזזה למטה"
              >
                <ArrowDown className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setSlides((all) => all.filter((x) => x.key !== s.key))}
                className="rounded p-1 text-gray-500 hover:bg-red-50 hover:text-red-600"
                aria-label="מחיקת שקופית"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
            <ImageUpload
              defaultValue={s.imageUrl}
              folder="logos"
              onChange={(url) => patch(s.key, { imageUrl: url })}
            />
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                value={s.headline}
                onChange={(e) => patch(s.key, { headline: e.target.value })}
                placeholder="כותרת (אופציונלי)"
                className={`${field} sm:col-span-2`}
              />
              <input
                value={s.subheadline}
                onChange={(e) => patch(s.key, { subheadline: e.target.value })}
                placeholder="כותרת משנה (אופציונלי)"
                className={`${field} sm:col-span-2`}
              />
              <input
                value={s.ctaText}
                onChange={(e) => patch(s.key, { ctaText: e.target.value })}
                placeholder="טקסט כפתור"
                className={field}
              />
              <input
                value={s.ctaHref}
                onChange={(e) => patch(s.key, { ctaHref: e.target.value })}
                placeholder="/catalog?category=..."
                dir="ltr"
                className={field}
              />
            </div>
          </div>
          {!s.imageUrl && <p className="mt-2 text-xs text-amber-700">שקופית ללא תמונה לא תישמר.</p>}
        </div>
      ))}

      {slides.length < MAX_CAROUSEL_SLIDES && (
        <button
          type="button"
          onClick={() =>
            setSlides((all) => [
              ...all,
              { key: nextKey++, imageUrl: '', headline: '', subheadline: '', ctaText: '', ctaHref: '' },
            ])
          }
          className="inline-flex items-center gap-1 rounded-lg border border-dashed border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <Plus className="h-4 w-4" /> הוספת שקופית
        </button>
      )}
    </div>
  );
}
