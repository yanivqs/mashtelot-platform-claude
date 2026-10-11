'use client';

import { useRef } from 'react';
import { Menu } from 'lucide-react';

/** תפריט נייד מתקפל שנסגר בלחיצה על קישור (ה-layout לא נטען מחדש בניווט). */
export function MobileMenu({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  return (
    <details ref={ref} className="relative">
      <summary
        className="flex cursor-pointer list-none items-center rounded-lg p-2 text-gray-700 hover:bg-gray-100"
        aria-label="תפריט"
      >
        <Menu className="h-5 w-5" />
      </summary>
      <div
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('a')) ref.current?.removeAttribute('open');
        }}
        className="absolute left-0 top-full z-40 mt-2 max-h-[75vh] w-72 overflow-y-auto rounded-xl border border-gray-100 bg-white p-3 shadow-lg"
      >
        {children}
      </div>
    </details>
  );
}
