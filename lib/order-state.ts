/**
 * מכונות המצבים של הזמנה (C-P1-02, אפיון §9.04, R05-07, R05-08). טהור — ללא DB.
 *
 * שני צירים נפרדים:
 * - status — מסלול הטיפול בהזמנה (התקבלה → אושרה → בהכנה → מוכנה → נשלחה → נמסרה, או בוטלה)
 * - paymentStatus — לא שולם / שולם / הוחזר
 * ומצב המלאי (stockState) נגזר מהמעברים: שמירה ביצירה, הארכה/שמירה מחדש באישור,
 * הורדה בפועל כשהסחורה יוצאת (נשלחה/נמסרה), ושחרור/החזרה בביטול.
 */
import type { OrderStatus, PaymentStatus, StockState } from '@prisma/client';

/** חלון השמירה להזמנה שטרם אושרה (החלטת בעלים 2026-10-18: 48 שעות). */
export const RESERVATION_HOURS = 48;

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  QUOTE_REQUESTED: 'בקשת הצעת מחיר',
  RECEIVED: 'התקבלה',
  CONFIRMED: 'אושרה',
  PREPARING: 'בהכנה',
  READY: 'מוכנה',
  SHIPPED: 'נשלחה',
  DELIVERED: 'נמסרה',
  CANCELLED: 'בוטלה',
  // ערכים ישנים (לפני המיגרציה) — מוצגים בשם החדש המקביל
  PENDING: 'התקבלה',
  PAID: 'אושרה',
  PROCESSING: 'בהכנה',
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  UNPAID: 'לא שולם',
  PAID: 'שולם',
  REFUNDED: 'הוחזר',
};

/** ערך ישן → הערך החדש המקביל (ליתר ביטחון; המיגרציה כבר המירה את כל הנתונים). */
export function normalizeStatus(s: OrderStatus): OrderStatus {
  if (s === 'PENDING') return 'RECEIVED';
  if (s === 'PAID') return 'CONFIRMED';
  if (s === 'PROCESSING') return 'PREPARING';
  return s;
}

const TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  QUOTE_REQUESTED: ['CONFIRMED', 'CANCELLED'],
  RECEIVED: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PREPARING', 'READY', 'SHIPPED', 'CANCELLED'],
  PREPARING: ['READY', 'SHIPPED', 'CANCELLED'],
  READY: ['SHIPPED', 'DELIVERED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};

export function allowedNextStatuses(current: OrderStatus): OrderStatus[] {
  return TRANSITIONS[normalizeStatus(current)] ?? [];
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return allowedNextStatuses(from).includes(to);
}

const PAYMENT_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  UNPAID: ['PAID'],
  PAID: ['REFUNDED', 'UNPAID'],
  REFUNDED: [],
};

export function allowedNextPaymentStatuses(current: PaymentStatus): PaymentStatus[] {
  return PAYMENT_TRANSITIONS[current];
}

/**
 * פעולת המלאי שמעבר סטטוס מחייב, לפי מצב המלאי הנוכחי:
 * - extend  — שמירה קיימת הופכת לקבועה (ביטול פקיעה)
 * - reserve — שמירה חדשה (אחרי שפגה, או הצעת מחיר שאושרה)
 * - commit  — הורדה בפועל מה-on_hand ושחרור השמירה
 * - release — שחרור שמירה (ביטול)
 * - restore — החזרה ל-on_hand (ביטול הזמנה שהמלאי שלה כבר ירד — הזמנות מהמודל הקודם)
 * - none
 */
export type StockEffect = 'extend' | 'reserve' | 'commit' | 'release' | 'restore' | 'none';

export function stockEffectFor(to: OrderStatus, stock: StockState): StockEffect {
  if (to === 'CANCELLED') {
    if (stock === 'RESERVED') return 'release';
    if (stock === 'COMMITTED') return 'restore';
    return 'none';
  }
  if (to === 'CONFIRMED') {
    if (stock === 'RESERVED') return 'extend';
    if (stock === 'RELEASED' || stock === 'NONE') return 'reserve';
    return 'none';
  }
  if (to === 'SHIPPED' || to === 'DELIVERED') {
    if (stock === 'RESERVED') return 'commit';
    return 'none';
  }
  return 'none';
}

export function reservationExpiry(now: Date): Date {
  return new Date(now.getTime() + RESERVATION_HOURS * 60 * 60 * 1000);
}
