'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { renderSign, SIGN_CSS, SIGN_H, SIGN_W, signFontCss } from '@/lib/plant-sign/render';
import { fitSignText } from '@/lib/plant-sign/fit';
import type { SignData } from '@/lib/plant-sign/types';

/** מ"מ → פיקסלי CSS */
const MM = 96 / 25.4;

/**
 * הסגנונות והגופנים של השלט — פעם אחת בדף.
 * בהדפסה מהדפדפן השלט מוסתר: את הקובץ לדפוס מפיק רק בית הדפוס.
 */
export function SignStyles() {
  return <style>{`${signFontCss({ base: '/fonts/sign' })}\n${SIGN_CSS}\n@media print{.ps-sheet{display:none!important}}`}</style>;
}

/** תצוגה מקדימה של שלט: אותו HTML כמו ב-PDF, מוקטן לרוחב המכל */
export function SignPreview({ data, uid, watermark = true, label }: { data: SignData; uid: string; watermark?: boolean; label?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  const html = useMemo(() => renderSign(data, { uid, watermark }), [data, uid, watermark]);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / (SIGN_W * MM));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const el = sheet.current;
    if (!el) return;
    fitSignText(el);
    // אחרי טעינת הגופנים המידות משתנות — מתאימים שוב
    document.fonts?.ready.then(() => {
      if (!cancelled && sheet.current) fitSignText(sheet.current);
    });
    return () => {
      cancelled = true;
    };
  }, [html]);

  return (
    <div
      ref={box}
      role="img"
      aria-label={label ?? `תצוגה מקדימה של שלט: ${data.hebrewName}`}
      className="relative w-full overflow-hidden rounded-md shadow-sm ring-1 ring-black/5 select-none"
      style={{ aspectRatio: `${SIGN_W} / ${SIGN_H}` }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div
        ref={sheet}
        aria-hidden
        className="absolute right-0 top-0 origin-top-right"
        style={{ transform: `scale(${scale})`, visibility: scale ? 'visible' : 'hidden' }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
