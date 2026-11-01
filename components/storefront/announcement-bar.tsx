import Link from 'next/link';
import type { AnnouncementConfig } from '@/lib/theme';
import { AnnouncementHeight } from '@/components/storefront/announcement-height';

/** הודעת סטיקי בראש החנות (נערכת בניהול ← שיווק). טקסט ארוך נשבר לשורה נוספת — הכותרת נדבקת מתחתיה. */
export function AnnouncementBar({ announcement, basePath }: { announcement: AnnouncementConfig; basePath: string }) {
  if (!announcement.enabled || !announcement.text) return null;
  const href = announcement.href?.startsWith('/') ? `${basePath}${announcement.href}` || '/' : announcement.href;
  const bg = announcement.tone === 'accent' ? 'bg-[var(--accent-strong)]' : 'bg-[var(--brand)]';
  const inner = 'mx-auto flex min-h-9 max-w-6xl flex-wrap items-center justify-center gap-x-2 px-4 py-1 text-center text-[13px] font-medium leading-snug';
  const content = (
    <>
      <span>{announcement.text}</span>
      {href && (
        <span className="shrink-0 font-bold underline underline-offset-2">{announcement.linkText || 'לפרטים'} ←</span>
      )}
    </>
  );
  return (
    <div role="region" aria-label="הודעה" className={`sticky top-0 z-40 ${bg} text-white`} data-testid="announcement-bar">
      <AnnouncementHeight />
      {href ? (
        <Link href={href} className={inner}>
          {content}
        </Link>
      ) : (
        <p className={inner}>{content}</p>
      )}
    </div>
  );
}
