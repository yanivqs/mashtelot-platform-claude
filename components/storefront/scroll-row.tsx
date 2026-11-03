'use client';

import { useEffect, useRef, type RefObject } from 'react';

/**
 * פס גלילה דק שמראה שאפשר לגלול לרוחב. נבנה ידנית כי בטלפונים פס הגלילה של הדפדפן מוסתר.
 * נעלם כשהכול נכנס למסך. בכיוון ימין לשמאל scrollLeft שלילי, והסמן מתחיל מימין.
 */
function ScrollBarTrack({ target }: { target: RefObject<HTMLElement | null> }) {
  const track = useRef<HTMLDivElement>(null);
  const thumb = useRef<HTMLDivElement>(null);

  const sync = () => {
    const el = target.current;
    if (!el || !track.current || !thumb.current) return;
    const max = el.scrollWidth - el.clientWidth;
    track.current.hidden = max <= 1;
    if (max <= 1) return;
    const width = el.clientWidth / el.scrollWidth;
    thumb.current.style.width = `${width * 100}%`;
    thumb.current.style.insetInlineStart = `${(Math.min(1, Math.abs(el.scrollLeft) / max) * (1 - width) * 100).toFixed(2)}%`;
  };

  // גם אחרי כל רינדור: מעבר בין קטגוריות מחליף את הכפתורים בלי לשנות את גודל השורה
  useEffect(sync);

  useEffect(() => {
    const el = target.current;
    if (!el) return;
    el.addEventListener('scroll', sync, { passive: true });
    const observer = new ResizeObserver(sync);
    observer.observe(el);
    return () => {
      el.removeEventListener('scroll', sync);
      observer.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  return (
    <div ref={track} hidden aria-hidden="true" data-testid="scroll-bar" className="relative mt-1.5 h-[3px] overflow-hidden rounded-full bg-orange-100">
      <div ref={thumb} data-testid="scroll-bar-thumb" className="absolute inset-y-0 rounded-full bg-orange-500" />
    </div>
  );
}

/** אזור גלילה אופקית עם פס גלילה כתום. המחלקות קובעות את הפריסה של הילדים. */
export function ScrollArea({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div>
      <div ref={ref} className={className}>
        {children}
      </div>
      <ScrollBarTrack target={ref} />
    </div>
  );
}

/**
 * שורה אחת בגלילה אופקית בנייד, ושבירת שורות רגילה במחשב.
 * הפריט הפעיל (aria-current) נגלל למרכז, בלי להזיז את העמוד עצמו.
 */
export function ScrollRow({ children, className = '', bar = false }: { children: React.ReactNode; className?: string; bar?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const row = ref.current;
    const active = row?.querySelector('[aria-current="true"]');
    if (!row || !active) return;
    const rowBox = row.getBoundingClientRect();
    const box = active.getBoundingClientRect();
    row.scrollLeft += box.left + box.width / 2 - (rowBox.left + rowBox.width / 2);
  }, []);

  const content = (
    <div
      ref={ref}
      className={`-mx-6 flex items-center gap-2 overflow-x-auto px-6 pb-1 [scrollbar-width:none] md:mx-0 md:flex-wrap md:overflow-visible md:px-0 md:pb-0 ${className}`}
    >
      {children}
    </div>
  );
  if (!bar) return content;
  return (
    <div>
      {content}
      <ScrollBarTrack target={ref} />
    </div>
  );
}
