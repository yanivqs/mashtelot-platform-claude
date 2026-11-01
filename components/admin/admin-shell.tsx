'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';

/**
 * מעטפת האדמין: בדסקטופ תפריט צד קבוע; בנייד סרגל עליון עם ☰ שפותח את התפריט כמגירה
 * (סגירה במעבר דף, בלחיצה על קישור, ברקע או ב-Escape).
 */
export function AdminShell({ title, sidebar, children }: { title: string; sidebar: React.ReactNode; children: React.ReactNode }) {
  const pathname = usePathname();
  // המגירה פתוחה רק בדף שבו נפתחה — מעבר דף סוגר אותה
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const setOpen = (v: boolean) => setOpenOn(v ? pathname : null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpenOn(null);
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <div dir="rtl" className="min-h-screen bg-gray-50 text-gray-900 md:flex">
      <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-gray-200 bg-white px-3 py-2 md:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="פתיחת תפריט הניהול"
          aria-expanded={open}
          className="rounded-lg p-2 text-gray-700 hover:bg-gray-100"
        >
          <Menu className="h-5 w-5" />
        </button>
        <p className="truncate text-sm font-bold">{title}</p>
      </header>

      {open && <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={() => setOpen(false)} aria-hidden />}

      <aside
        aria-label="תפריט הניהול"
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('a')) setOpen(false);
        }}
        className={`fixed inset-y-0 right-0 z-50 flex w-72 max-w-[85vw] flex-col overflow-y-auto border-l border-gray-200 bg-white shadow-xl transition-transform duration-200 md:static md:z-auto md:w-60 md:max-w-none md:translate-x-0 md:shadow-none ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="סגירת התפריט"
          className="absolute left-2 top-2 rounded-lg p-2 text-gray-500 hover:bg-gray-100 md:hidden"
        >
          <X className="h-5 w-5" />
        </button>
        {sidebar}
      </aside>

      <main className="min-w-0 flex-1 overflow-x-hidden p-4 sm:p-6 md:p-8">{children}</main>
    </div>
  );
}
