/**
 * שעון ישראל לשדות `datetime-local` (השרת רץ ב-UTC). כולל מעבר שעון קיץ/חורף.
 */
const TZ = 'Asia/Jerusalem';

function offsetMs(at: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(at);
  const n = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const asUtc = Date.UTC(n('year'), n('month') - 1, n('day'), n('hour'), n('minute'), n('second'));
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/** '2030-05-10T09:30' (שעון ישראל) → Date, או null אם לא תקין. */
export function parseIsraelLocal(value: string): Date | null {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!m) return null;
  const guess = Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!, +m[4]!, +m[5]!);
  if (Number.isNaN(guess)) return null;
  let t = guess - offsetMs(new Date(guess));
  t = guess - offsetMs(new Date(t));
  return new Date(t);
}

/** תאריך ושעה בעברית בשעון ישראל, לתצוגה. */
export function formatIsrael(d: Date): string {
  return new Intl.DateTimeFormat('he-IL', { timeZone: TZ, dateStyle: 'short', timeStyle: 'short' }).format(d);
}
