'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { ImageUpload } from '@/components/admin/image-upload';

/**
 * רשימת תמונות בטופס: העלאה או בחירה מתיקיית התמונות, הסרה ושינוי סדר.
 * כל תמונה נשלחת כ-hidden input בשם `name`, בסדר שמוצג.
 */
export function ImageList({
  name,
  initialUrls,
  max = 8,
  label,
  hint,
  className,
}: {
  name: string;
  initialUrls: string[];
  max?: number;
  label: string;
  hint?: string;
  className?: string;
}) {
  const [urls, setUrls] = useState(initialUrls);
  const [uploaderKey, setUploaderKey] = useState(0);
  const move = (i: number, d: -1 | 1) =>
    setUrls((prev) => {
      const j = i + d;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  return (
    <div className={className}>
      <span className="mb-1 block text-xs font-medium text-gray-700">
        {label} ({urls.length}/{max})
      </span>
      {hint && <p className="mb-2 text-xs text-gray-600">{hint}</p>}
      <ul className="flex flex-wrap items-start gap-2">
        {urls.map((u, i) => (
          <li key={u} className="w-20">
            <input type="hidden" name={name} value={u} />
            <div className="relative h-20 w-20 overflow-hidden rounded-lg border border-gray-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt={`תמונה ${i + 1}`} className="h-full w-full object-cover" />
              <button
                type="button"
                aria-label={`הסרת תמונה ${i + 1}`}
                onClick={() => setUrls((prev) => prev.filter((x) => x !== u))}
                className="absolute left-0.5 top-0.5 rounded-full bg-white/90 p-1 text-red-600 hover:bg-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            {urls.length > 1 && (
              <div className="mt-1 flex justify-between">
                <button
                  type="button"
                  aria-label={`הזזת תמונה ${i + 1} קדימה`}
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                  className="rounded p-1 text-gray-600 hover:bg-gray-100 disabled:opacity-30"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label={`הזזת תמונה ${i + 1} אחורה`}
                  disabled={i === urls.length - 1}
                  onClick={() => move(i, 1)}
                  className="rounded p-1 text-gray-600 hover:bg-gray-100 disabled:opacity-30"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              </div>
            )}
          </li>
        ))}
        {urls.length < max && (
          <li>
            <ImageUpload
              key={uploaderKey}
              folder="plants"
              nurseryFolder
              onChange={(url) => {
                if (!url) return;
                setUrls((prev) => (prev.includes(url) ? prev : [...prev, url]));
                setUploaderKey((k) => k + 1);
              }}
            />
          </li>
        )}
      </ul>
    </div>
  );
}
