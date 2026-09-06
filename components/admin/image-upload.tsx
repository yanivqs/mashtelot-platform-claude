'use client';

import { useRef, useState, useTransition } from 'react';
import { ImagePlus, Loader2, X } from 'lucide-react';
import { uploadImage } from '@/lib/upload-actions';

interface Props {
  /** שם השדה הנסתר שיכיל את ה-URL ויישלח עם הטופס (טפסי FormData) */
  name?: string;
  /** ערך קיים (עריכה) */
  defaultValue?: string | null;
  label?: string;
  /** תיקיית יעד ב-Blob: plants | logos | artwork | misc */
  folder?: 'plants' | 'logos' | 'artwork' | 'misc';
  /** קריאה חוזרת עם ה-URL בכל שינוי (טפסים מבוקרים) */
  onChange?: (url: string) => void;
}

export function ImageUpload({ name, defaultValue, label, folder = 'misc', onChange }: Props) {
  const [url, setUrlState] = useState(defaultValue ?? '');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function setUrl(next: string) {
    setUrlState(next);
    onChange?.(next);
  }

  function handleFile(file: File) {
    setError(null);
    const fd = new FormData();
    fd.set('file', file);
    fd.set('folder', folder);
    startTransition(async () => {
      const res = await uploadImage(fd);
      if (res.url) setUrl(res.url);
      else setError(res.error ?? 'העלאה נכשלה');
    });
  }

  return (
    <div className="text-sm">
      {label && <span className="mb-1 block font-medium text-gray-700">{label}</span>}
      {name && <input type="hidden" name={name} value={url} />}

      <div className="flex items-center gap-3">
        <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="" className="h-full w-full object-cover" />
          ) : (
            <ImagePlus className="h-6 w-6 text-gray-300" />
          )}
          {pending && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/70">
              <Loader2 className="h-5 w-5 animate-spin text-brand-600" />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={pending}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            {url ? 'החלפת תמונה' : 'העלאת תמונה'}
          </button>
          {url && (
            <button
              type="button"
              onClick={() => setUrl('')}
              className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-800"
            >
              <X className="h-3 w-3" /> הסרה
            </button>
          )}
          <span className="text-[11px] text-gray-400">JPG/PNG/WEBP · עד 5MB</span>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = '';
        }}
      />

      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
