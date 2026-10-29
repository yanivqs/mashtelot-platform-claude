import Link from 'next/link';
import type { AnnouncementConfig } from '@/lib/theme';

/** הודעת סטיקי בראש החנות (נערכת בניהול ← שיווק). גובה קבוע — הכותרת נדבקת מתחתיה. */
export function AnnouncementBar({ announcement, basePath }: { announcement: AnnouncementConfig; basePath: string }) {
  if (!announcement.enabled || !announcement.text) return null;
  const href = announcement.href?.startsWith('/') ? `${basePath}${announcement.href}` || '/' : announcement.href;
  const bg = announcement.tone === 'accent' ? 'bg-[var(--accent)]' : 'bg-[var(--brand)]';
  const content = (
    <>
      <span className="truncate">{announcement.text}</span>
      {href && (
        <span className="shrink-0 font-bold underline underline-offset-2">{announcement.linkText || 'לפרטים'} ←</span>
      )}
    </>
  );
  return (
    <div role="region" aria-label="הודעה" className={`sticky top-0 z-40 h-9 ${bg} text-white`} data-testid="announcement-bar">
      {href ? (
        <Link href={href} className="mx-auto flex h-full max-w-6xl items-center justify-center gap-2 px-4 text-[13px] font-medium">
          {content}
        </Link>
      ) : (
        <p className="mx-auto flex h-full max-w-6xl items-center justify-center gap-2 px-4 text-[13px] font-medium">{content}</p>
      )}
    </div>
  );
}
