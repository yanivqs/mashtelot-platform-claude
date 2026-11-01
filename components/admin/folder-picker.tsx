'use client';

import { useEffect, useState } from 'react';
import { Loader2, Search, X } from 'lucide-react';
import { listFolderImages } from '@/lib/nursery-image-actions';
import type { FolderImage } from '@/lib/nursery-images';

/** חלון בחירת תמונה מתיקיית התמונות של המשתלה. */
export function FolderPicker({ onPick, onClose }: { onPick: (url: string) => void; onClose: () => void }) {
  const [images, setImages] = useState<FolderImage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    listFolderImages()
      .then((res) => {
        setImages(res.images);
        if (res.error) setError(res.error);
      })
      .catch(() => {
        setImages([]);
        setError('טעינת התיקייה נכשלה');
      });
  }, []);

  const term = q.trim().toLowerCase();
  const shown = images && term ? images.filter((i) => i.fileName.toLowerCase().includes(term)) : images;

  return (
    <div role="dialog" aria-modal="true" aria-label="בחירה מתיקיית התמונות" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-gray-100 p-3">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="חיפוש לפי שם קובץ..."
              aria-label="חיפוש בתיקיית התמונות"
              className="w-full rounded-lg border border-gray-200 py-1.5 pl-2 pr-8 text-sm outline-none focus:border-brand-500"
            />
          </div>
          <button type="button" onClick={onClose} aria-label="סגירה" className="rounded-full p-1.5 text-gray-500 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto p-3">
          {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
          {!shown ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
            </div>
          ) : shown.length === 0 ? (
            <p className="p-8 text-center text-sm text-gray-500">
              אין תמונות להצגה.{' '}
              <a href="/admin/products/images" target="_blank" rel="noreferrer" className="text-brand-700 underline">
                פתיחת תיקיית התמונות
              </a>
            </p>
          ) : (
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {shown.map((image) => (
                <li key={image.id}>
                  <button
                    type="button"
                    onClick={() => onPick(image.url)}
                    aria-label={`בחירת ${image.fileName}`}
                    className="block aspect-square w-full overflow-hidden rounded-lg border border-gray-200 hover:border-brand-500"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={image.url} alt="" loading="lazy" className="h-full w-full object-cover" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
