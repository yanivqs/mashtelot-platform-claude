import type { ChannelProvider } from '@prisma/client';
import type { EnabledChannel } from '@/lib/channels';

type IconProps = { className?: string };

const Facebook = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
    <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5 3.66 9.15 8.44 9.94v-7.03H7.9v-2.9h2.54V9.85c0-2.52 1.5-3.91 3.77-3.91 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56v1.87h2.78l-.44 2.9h-2.34V22c4.78-.79 8.44-4.94 8.44-9.94Z" />
  </svg>
);

const Instagram = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
    <path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.72 3.72 0 0 1-1.38-.9 3.72 3.72 0 0 1-.9-1.38c-.16-.42-.36-1.06-.41-2.23-.06-1.27-.07-1.65-.07-4.85s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16Zm0 1.62c-3.15 0-3.5.01-4.74.07-1.14.05-1.76.24-2.17.4-.55.22-.94.47-1.35.88-.41.41-.66.8-.88 1.35-.16.41-.35 1.03-.4 2.17-.06 1.24-.07 1.59-.07 4.74s.01 3.5.07 4.74c.05 1.14.24 1.76.4 2.17.22.55.47.94.88 1.35.41.41.8.66 1.35.88.41.16 1.03.35 2.17.4 1.24.06 1.59.07 4.74.07s3.5-.01 4.74-.07c1.14-.05 1.76-.24 2.17-.4.55-.22.94-.47 1.35-.88.41-.41.66-.8.88-1.35.16-.41.35-1.03.4-2.17.06-1.24.07-1.59.07-4.74s-.01-3.5-.07-4.74c-.05-1.14-.24-1.76-.4-2.17a3.63 3.63 0 0 0-.88-1.35 3.63 3.63 0 0 0-1.35-.88c-.41-.16-1.03-.35-2.17-.4-1.24-.06-1.59-.07-4.74-.07Zm0 2.76a5.7 5.7 0 1 1 0 11.4 5.7 5.7 0 0 1 0-11.4Zm0 9.4a3.7 3.7 0 1 0 0-7.4 3.7 3.7 0 0 0 0 7.4Zm7.26-9.62a1.33 1.33 0 1 1-2.66 0 1.33 1.33 0 0 1 2.66 0Z" />
  </svg>
);

const TikTok = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
    <path d="M16.5 5.4c-.9-1-1.4-2.3-1.4-3.6h-3v13.1c0 1.5-1.2 2.7-2.7 2.7a2.7 2.7 0 0 1-2.7-2.7 2.7 2.7 0 0 1 3.5-2.6V6.7A5.85 5.85 0 0 0 3.4 12a5.85 5.85 0 0 0 5.9 5.8c3.3 0 5.9-2.6 5.9-5.8V8.6a8.6 8.6 0 0 0 5 1.6V7.2c-1.2 0-2.4-.6-3.6-1.8Z" />
  </svg>
);

const Youtube = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
    <path d="M23 12s0-3.2-.4-4.7a2.9 2.9 0 0 0-2-2C18.8 5 12 5 12 5s-6.8 0-8.6.3a2.9 2.9 0 0 0-2 2C1 8.8 1 12 1 12s0 3.2.4 4.7c.3 1 1 1.7 2 2C5.2 19 12 19 12 19s6.8 0 8.6-.3c1-.3 1.7-1 2-2C23 15.2 23 12 23 12ZM9.8 15.3V8.7l5.7 3.3-5.7 3.3Z" />
  </svg>
);

const WhatsApp = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
    <path d="M12 2a10 10 0 0 0-8.5 15.3L2 22l4.8-1.5A10 10 0 1 0 12 2Zm0 18a8 8 0 0 1-4.1-1.1l-.3-.2-2.9.9.9-2.8-.2-.3A8 8 0 1 1 12 20Zm4.4-5.9c-.2-.1-1.4-.7-1.6-.8-.2-.1-.4-.1-.5.1-.2.2-.6.8-.8 1-.1.1-.3.2-.5 0-.2-.1-1-.4-1.9-1.2-.7-.6-1.2-1.4-1.3-1.6-.1-.2 0-.4.1-.5l.4-.4.2-.4c.1-.1 0-.3 0-.4l-.7-1.7c-.2-.4-.4-.4-.5-.4h-.5c-.2 0-.4 0-.6.3s-.9.9-.9 2.1.9 2.5 1 2.6c.1.2 1.8 2.7 4.3 3.8.6.3 1.1.4 1.4.5.6.2 1.2.2 1.6.1.5-.1 1.4-.6 1.6-1.1.2-.6.2-1 .1-1.1 0-.2-.2-.2-.4-.3Z" />
  </svg>
);

const Telegram = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
    <path d="M9.04 15.8l-.4 5.57c.57 0 .82-.24 1.11-.53l2.66-2.55 5.52 4.02c1.01.56 1.73.27 2-.93L23.98 3.55a1.36 1.36 0 0 0-.46-1.34 1.53 1.53 0 0 0-1.46-.15L1.11 10.13c-1.24.49-1.23 1.17-.21 1.49l5.35 1.66L18.75 5.61c.51-.31.98-.14.6.2L9.04 15.8Z" />
  </svg>
);

const LinkedIn = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
    <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.02-3.03-1.85-3.03-1.85 0-2.14 1.45-2.14 2.94v5.66H9.36V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12ZM7.12 20.45H3.56V9h3.56v11.45Z" />
  </svg>
);

const Pinterest = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
    <path d="M12 2C6.48 2 2 6.48 2 12c0 4.24 2.63 7.85 6.34 9.32-.09-.79-.17-2.01.03-2.88.19-.79 1.22-5.03 1.22-5.03s-.31-.62-.31-1.54c0-1.44.84-2.52 1.88-2.52.89 0 1.32.67 1.32 1.46 0 .89-.57 2.23-.86 3.47-.24 1.03.52 1.88 1.55 1.88 1.85 0 3.28-1.95 3.28-4.77 0-2.49-1.79-4.24-4.35-4.24-2.96 0-4.7 2.22-4.7 4.52 0 .89.34 1.85.77 2.37.08.1.09.19.07.29-.07.31-.24.99-.27 1.13-.04.18-.14.22-.32.13-1.2-.56-1.95-2.31-1.95-3.72 0-3.03 2.2-5.81 6.35-5.81 3.33 0 5.92 2.37 5.92 5.55 0 3.31-2.09 5.98-4.99 5.98-.97 0-1.89-.5-2.2-1.1l-.6 2.28c-.22.83-.81 1.87-1.2 2.5.9.28 1.86.43 2.86.43 5.52 0 10-4.48 10-10S17.52 2 12 2Z" />
  </svg>
);

const GoogleBusiness = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z" />
  </svg>
);

const ICONS: Record<ChannelProvider, (p: IconProps) => JSX.Element> = {
  WHATSAPP: WhatsApp,
  FACEBOOK: Facebook,
  INSTAGRAM: Instagram,
  TIKTOK: TikTok,
  YOUTUBE: Youtube,
  TELEGRAM: Telegram,
  LINKEDIN: LinkedIn,
  PINTEREST: Pinterest,
  GOOGLE_BUSINESS: GoogleBusiness,
};

/** בונה URL ניתן-ללחיצה מערוץ. וואטסאפ נשמר כמספר טלפון גולמי, לא URL. */
function channelHref(channel: EnabledChannel): string {
  if (channel.provider === 'WHATSAPP') {
    return `https://wa.me/${channel.value.replace(/[^\d]/g, '')}`;
  }
  return channel.value;
}

/** קישורי ערוצי רשת חברתית/יצירת-קשר של המשתלה. מחזיר null אם אין אף ערוץ פעיל. */
export function SocialLinks({
  channels,
  className = '',
}: {
  channels: EnabledChannel[];
  className?: string;
}) {
  if (channels.length === 0) return null;

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {channels.map((channel) => {
        const Icon = ICONS[channel.provider];
        return (
          <a
            key={channel.provider}
            href={channelHref(channel)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={channel.label}
            className="text-gray-400 transition hover:text-brand-700"
          >
            <Icon className="h-5 w-5" />
          </a>
        );
      })}
    </div>
  );
}
