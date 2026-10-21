import type { LoyaltyKind } from '@prisma/client';

export const LOYALTY_KIND_LABELS: Record<LoyaltyKind, string> = {
  EARN: 'צבירה מהזמנה',
  REDEEM: 'מימוש בהזמנה',
  REVERSE_EARN: 'ביטול צבירה (הזמנה בוטלה)',
  REFUND_REDEEM: 'החזרת נקודות (הזמנה בוטלה)',
  ADJUST: 'התאמה ידנית',
};
