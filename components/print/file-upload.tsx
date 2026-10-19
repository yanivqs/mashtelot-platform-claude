'use client';

import { useRef, useState } from 'react';
import { Loader2, Upload } from 'lucide-react';
import { finishUpload, type UploadStart } from '@/app/admin/(dash)/print-shop/artwork-actions';

const MAX = 50 * 1024 * 1024;

/**
 * העלאת קובץ דפוס (PT-08): קישור חתום מהשרת → העלאה ישירה לאחסון הפרטי → השרת בודק את הקובץ
 * לפי התוכן ורושם אותו. הבדיקה בדפדפן (גודל) היא רק נוחות — השרת קובע.
 */
export function PrintFileUpload({
  label,
  start,
  onDone,
}: {
  label: string;
  start: () => Promise<UploadStart>;
  onDone?: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function upload(file: File) {
    setError(null);
    setDone(false);
    if (file.size > MAX) return setError('הקובץ גדול מ-50MB');
    setBusy(true);
    try {
      const s = await start();
      if (!s.ok || !s.target || !s.ticket) throw new Error(s.error ?? 'ההעלאה נכשלה');
      const put = await fetch(s.target.url, { method: s.target.method, headers: { 'Content-Type': 'application/octet-stream', ...s.target.headers }, body: file });
      if (!put.ok) throw new Error(`ההעלאה נכשלה (${put.status})`);
      const f = await finishUpload({ ticket: s.ticket, originalName: file.name });
      if (!f.ok) throw new Error(f.error ?? 'ההעלאה נכשלה');
      setDone(true);
      onDone?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ההעלאה נכשלה');
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = '';
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <input
        ref={ref}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg,.tif,.tiff,.eps,application/pdf,image/png,image/jpeg,image/tiff,application/postscript"
        aria-label={label}
        className="hidden"
        onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
      />
      <button type="button" disabled={busy} onClick={() => ref.current?.click()} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        {busy ? 'מעלה...' : label}
      </button>
      <span className="text-xs text-gray-400">PDF, PNG, JPG, TIFF, EPS · עד 50MB</span>
      {done && <span className="text-xs text-green-700">הועלה ✓</span>}
      {error && <span className="w-full text-xs text-red-600">{error}</span>}
    </div>
  );
}
