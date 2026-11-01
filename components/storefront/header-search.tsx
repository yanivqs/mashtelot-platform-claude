'use client';

import { useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';

/** חיפוש בכותרת (מחשב): כפתור שנפתח לשדה חיפוש; שולח GET ל-/catalog?q=. */
export function HeaderSearch({ basePath }: { basePath: string }) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="חיפוש באתר"
        className="inline-flex items-center rounded-lg px-3 py-2 text-gray-700 hover:bg-gray-100"
      >
        <Search className="h-5 w-5" />
      </button>
    );
  }
  return (
    <form action={`${basePath}/catalog`} method="get" role="search" className="flex items-center gap-1">
      <input
        ref={inputRef}
        type="search"
        name="q"
        placeholder="חיפוש צמח או מוצר..."
        aria-label="חיפוש באתר"
        onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
        className="w-52 rounded-full border border-gray-200 bg-white px-4 py-1.5 text-sm outline-none focus:border-[var(--brand)] lg:w-64"
      />
      <button type="submit" aria-label="חיפוש" className="rounded-full p-2 text-gray-700 hover:bg-gray-100">
        <Search className="h-4 w-4" />
      </button>
      <button type="button" onClick={() => setOpen(false)} aria-label="סגירת החיפוש" className="rounded-full p-1.5 text-gray-600 hover:bg-gray-100">
        <X className="h-4 w-4" />
      </button>
    </form>
  );
}
