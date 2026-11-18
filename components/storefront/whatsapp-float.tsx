import { whatsappHref } from '@/lib/channels';
import { WhatsApp } from '@/components/storefront/social-links';

/**
 * כפתור וואטסאפ צף בחנות. ממוקם בצד הנגדי לכפתור הנגישות ובאותו גובה, מעל הסרגל התחתון בנייד.
 * הירוק (#1DA851) עומד ביחס ניגודיות 3:1 מול הסמל הלבן (WCAG 1.4.11).
 */
export function WhatsAppFloat({ phone, nurseryName, side }: { phone: string; nurseryName: string; side: 'left' | 'right' }) {
  const href = whatsappHref(phone, `שלום ${nurseryName}, אשמח לקבל פרטים`);
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`שיחה בוואטסאפ עם ${nurseryName} (נפתח בחלון חדש)`}
      title="שיחה בוואטסאפ"
      data-testid="whatsapp-float"
      className={`fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] z-[45] flex h-12 w-12 items-center justify-center rounded-full border-2 border-white bg-[#1DA851] text-white shadow-[0_2px_10px_rgba(0,0,0,0.35)] transition hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900 md:bottom-5 ${
        side === 'left' ? 'left-3' : 'right-3'
      }`}
    >
      <WhatsApp className="h-7 w-7" />
    </a>
  );
}
