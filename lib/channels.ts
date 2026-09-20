/**
 * רישום ערוצי הרשתות החברתיות/יצירת-קשר של הפלטפורמה (ללא תלות בשרת — בטוח
 * לייבוא ברכיבי לקוח). שיוך/הגדרה פר-משתלה נשמר בטבלת `nursery_channels`
 * ונקרא דרך lib/channel-access.ts.
 */
import type { ChannelProvider } from '@prisma/client';

export const CHANNEL_PROVIDERS: ChannelProvider[] = [
  'WHATSAPP',
  'FACEBOOK',
  'INSTAGRAM',
  'TIKTOK',
  'YOUTUBE',
  'TELEGRAM',
  'LINKEDIN',
  'PINTEREST',
  'GOOGLE_BUSINESS',
];

export const CHANNEL_LABELS: Record<ChannelProvider, string> = {
  WHATSAPP: 'וואטסאפ',
  FACEBOOK: 'פייסבוק',
  INSTAGRAM: 'אינסטגרם',
  TIKTOK: 'טיקטוק',
  YOUTUBE: 'יוטיוב',
  TELEGRAM: 'טלגרם',
  LINKEDIN: 'לינקדאין',
  PINTEREST: 'פינטרסט',
  GOOGLE_BUSINESS: 'Google Business',
};

/** וואטסאפ נשמר כמספר טלפון גולמי (לא URL) — כמו היום. שאר הערוצים הם URL. */
export const CHANNEL_VALUE_PLACEHOLDERS: Partial<Record<ChannelProvider, string>> = {
  WHATSAPP: '05XXXXXXXX',
  FACEBOOK: 'https://facebook.com/...',
  INSTAGRAM: 'https://instagram.com/...',
  TIKTOK: 'https://tiktok.com/@...',
  YOUTUBE: 'https://youtube.com/@...',
  TELEGRAM: 'https://t.me/...',
  LINKEDIN: 'https://linkedin.com/company/...',
  PINTEREST: 'https://pinterest.com/...',
  GOOGLE_BUSINESS: 'https://g.page/...',
};

export interface EnabledChannel {
  provider: ChannelProvider;
  label: string;
  value: string;
  isFeatured: boolean;
}
