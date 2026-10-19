/**
 * רישום אמצעי התשלום הידניים של הפלטפורמה (ללא תלות בשרת — בטוח לייבוא ברכיבי לקוח).
 * שיוך/הגדרה פר-משתלה נשמר בטבלת `nursery_payment_methods` ונקרא דרך lib/payment-access.ts.
 * R05-06 / §10.03: Bit, PayBox, PayPal, העברה בנקאית, תשלום באיסוף, תשלום לשליח.
 */
import type { PaymentMethod } from '@prisma/client';
import type { DeliveryChoice } from '@/lib/checkout-calc';

export const PAYMENT_METHODS: PaymentMethod[] = [
  'BIT',
  'PAYBOX',
  'PAYPAL',
  'BANK_TRANSFER',
  'PAY_ON_PICKUP',
  'PAY_ON_DELIVERY',
];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  BIT: 'ביט',
  PAYBOX: 'פייבוקס',
  PAYPAL: 'PayPal',
  BANK_TRANSFER: 'העברה בנקאית',
  PAY_ON_PICKUP: 'תשלום באיסוף',
  PAY_ON_DELIVERY: 'תשלום לשליח',
};

/** תווית שדה "יעד" בהגדרות; null = לאמצעי אין יעד (תשלום במקום). */
export const PAYMENT_DESTINATION_LABELS: Record<PaymentMethod, string | null> = {
  BIT: 'מספר טלפון לביט',
  PAYBOX: 'מספר טלפון / קישור פייבוקס',
  PAYPAL: 'קישור paypal.me',
  BANK_TRANSFER: 'פרטי חשבון (בנק, סניף, חשבון / IBAN)',
  PAY_ON_PICKUP: null,
  PAY_ON_DELIVERY: null,
};

/** אמצעים שמוגבלים לאופן קבלה מסוים (Q3-א). */
const ONLY_FOR: Partial<Record<PaymentMethod, DeliveryChoice>> = {
  PAY_ON_PICKUP: 'PICKUP',
  PAY_ON_DELIVERY: 'DELIVERY',
};

export function isPaymentMethod(v: unknown): v is PaymentMethod {
  return typeof v === 'string' && (PAYMENT_METHODS as string[]).includes(v);
}

/** האם האמצעי זמין לאופן הקבלה שנבחר (ללא בחירה — רק אמצעים שאינם מוגבלים). */
export function isMethodAllowedFor(method: PaymentMethod, delivery: DeliveryChoice | '' | null): boolean {
  const only = ONLY_FOR[method];
  return !only || only === delivery;
}

/** אמצעי תשלום במקום — אין העברה מראש, ולכן אין אסמכתא. */
export function isPayOnSite(method: PaymentMethod): boolean {
  return method === 'PAY_ON_PICKUP' || method === 'PAY_ON_DELIVERY';
}

/**
 * אימות יעד בשמירת ההגדרות. מחזיר הודעת שגיאה או null.
 * PayPal: רק קישור https ל-paypal.me / paypal.com — מוצג ללקוח כקישור, ולכן לא מקבלים כתובת שרירותית.
 */
export function validatePaymentDestination(method: PaymentMethod, destination: string | null): string | null {
  if (!destination) return null;
  if (method === 'PAYPAL') {
    let url: URL;
    try {
      url = new URL(destination);
    } catch {
      return 'קישור PayPal חייב להיות כתובת מלאה, למשל https://paypal.me/your-name';
    }
    const host = url.hostname.toLowerCase();
    const okHost = ['paypal.me', 'www.paypal.me', 'paypal.com', 'www.paypal.com'].includes(host);
    if (url.protocol !== 'https:' || !okHost) {
      return 'קישור PayPal חייב להתחיל ב-https://paypal.me/ או https://www.paypal.com/';
    }
  }
  return null;
}

export interface EnabledPaymentMethod {
  method: PaymentMethod;
  label: string;
  instructions: string | null;
  destination: string | null;
}
