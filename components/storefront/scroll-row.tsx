'use client';

import { useEffect, useRef } from 'react';

/**
 * שורה אחת בגלילה אופקית בנייד, ושבירת שורות רגילה במחשב.
 * הפריט הפעיל (aria-current) נגלל למרכז, בלי להזיז את העמוד עצמו.
 */
export function ScrollRow({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const row = ref.current;
    const active = row?.querySelector('[aria-current="true"]');
    if (!row || !active) return;
    const rowBox = row.getBoundingClientRect();
    const box = active.getBoundingClientRect();
    row.scrollLeft += box.left + box.width / 2 - (rowBox.left + rowBox.width / 2);
  }, []);

  return (
    <div
      ref={ref}
      className={`-mx-6 flex items-center gap-2 overflow-x-auto px-6 pb-1 [scrollbar-width:none] md:mx-0 md:flex-wrap md:overflow-visible md:px-0 md:pb-0 ${className}`}
    >
      {children}
    </div>
  );
}
