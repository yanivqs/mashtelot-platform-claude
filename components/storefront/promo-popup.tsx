'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

/** פופאפ מבצע בחלון מודאלי של הדפדפן: הפוקוס עובר אליו ונשאר בו, Esc סוגר והפוקוס חוזר למקום. */
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
  const dialogRef = useRef<HTMLDialogElement>(null);
  const storageKey = `promo-dismissed:${id}`;

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(storageKey) === '1';
    } catch {
      /* ignore */
    }
    if (dismissed) return;
    const t = setTimeout(() => {
      // לא קופץ מעל חלון פתוח, למשל תפריט הנגישות
      if (!document.querySelector('dialog[open]')) setOpen(true);
    }, 1200);
    return () => clearTimeout(t);
  }, [storageKey]);

  useEffect(() => {
    if (open) dialogRef.current?.showModal();
  }, [open]);

  function dismiss() {
    setOpen(false);
    try {
      localStorage.setItem(storageKey, '1');
    } catch {
      /* ignore */
    }
  }

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      aria-label={title}
      onClose={dismiss}
      onClick={(e) => {
        if (e.target === dialogRef.current) dialogRef.current?.close();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl bg-white p-0 shadow-xl backdrop:bg-black/40"
    >
      <div className="relative p-8 text-center">
        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          aria-label="סגירה"
          className="absolute left-4 top-4 text-gray-600 hover:text-gray-700"
        >
          <X className="h-5 w-5" />
        </button>
        <h2 className="text-xl font-bold text-brand-900">{title}</h2>
        <p className="mt-3 whitespace-pre-line text-gray-600">{text}</p>
        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          className="mt-6 rounded-lg bg-[var(--brand,#16a34a)] px-6 py-2.5 font-medium text-white transition hover:brightness-95"
        >
          הבנתי
        </button>
      </div>
    </dialog>
  );
}
