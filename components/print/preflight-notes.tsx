import type { PreflightResult } from '@/lib/print-preflight';

/** תוצאת בדיקת קובץ בסיסית (PT-09) — תצוגה בלבד; ההחלטה (חסימת שחרור) נאכפת בשרת. */
export function PreflightNotes({ result }: { result: PreflightResult | null | undefined }) {
  if (!result) return null;
  const { critical, warnings, info } = result;
  const facts = [
    info.pdfSizeMm ? `מידות הדף ${info.pdfSizeMm[0]}×${info.pdfSizeMm[1]} מ"מ` : null,
    info.effectiveDpi ? `רזולוציה אפקטיבית ${info.effectiveDpi} DPI` : null,
  ].filter(Boolean);
  return (
    <div className="space-y-1 text-xs" data-testid="preflight">
      <p className="font-medium text-gray-700">
        בדיקת קובץ: {critical.length ? <span className="text-rose-700">נכשלה</span> : warnings.length ? <span className="text-amber-700">עם הערות</span> : <span className="text-green-700">תקינה</span>}
        {facts.length > 0 && <span className="font-normal text-gray-500"> · {facts.join(' · ')}</span>}
      </p>
      {critical.map((c) => (
        <p key={c} className="text-rose-700">✕ {c}</p>
      ))}
      {warnings.map((w) => (
        <p key={w} className="text-amber-700">! {w}</p>
      ))}
      <p className="text-gray-400">בדיקת קובץ בסיסית — אינה מחליפה בדיקת דפוס מקצועית</p>
    </div>
  );
}
