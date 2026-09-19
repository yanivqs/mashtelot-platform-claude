/**
 * רישום אמצעי התשלום הידניים של הפלטפורמה (ללא תלות בשרת — בטוח לייבוא ברכיבי לקוח).
 * שיוך/הגדרה פר-משתלה נשמר בטבלת `nursery_payment_methods` ונקרא דרך lib/payment-access.ts.
 */
import type { PaymentMethod } from '@prisma/client';

export const PAYMENT_METHODS: PaymentMethod[] = ['BIT', 'PAYBOX', 'BANK_TRANSFER'];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  BIT: 'ביט',
  PAYBOX: 'פייבוקס',
  BANK_TRANSFER: 'העברה בנקאית',
};

export interface EnabledPaymentMethod {
  method: PaymentMethod;
  label: string;
  instructions: string | null;
  destination: string | null;
}
