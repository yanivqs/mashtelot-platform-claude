'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

export function PromoPopup({
  id,
  title,
  text,
}: {
  id: string;
  title: string;
  text: string;
}) {
  const [open, setOpen] = useState(false);
  const storageKey = `promo-dismissed:${id}`;

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(storageKey) === '1';
    } catch {
      /* ignore */
    }
    if (dismissed) return;
    const t = setTimeout(() => setOpen(true), 1200);
    return () => clearTimeout(t);
  }, [storageKey]);

  function close() {
    setOpen(false);
    try {
      localStorage.setItem(storageKey, '1');
    } catch {
      /* ignore */
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={close}
    >
      <div
        className="relative w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={close}
          aria-label="סגירה"
          className="absolute left-4 top-4 text-gray-400 hover:text-gray-700"
        >
          <X className="h-5 w-5" />
        </button>
        <h2 className="text-xl font-bold text-brand-900">{title}</h2>
        <p className="mt-3 whitespace-pre-line text-gray-600">{text}</p>
        <button
          onClick={close}
          className="mt-6 rounded-lg bg-[var(--brand,#16a34a)] px-6 py-2.5 font-medium text-white transition hover:brightness-95"
        >
          הבנתי
        </button>
      </div>
    </div>
  );
}
