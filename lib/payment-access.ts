import 'server-only';
import { prisma } from '@/lib/prisma';
import { PAYMENT_METHOD_LABELS, type EnabledPaymentMethod } from '@/lib/payment-methods';

/** אמצעי התשלום הידניים הפעילים עבור משתלה, לתצוגה ב-checkout. */
export async function getEnabledPaymentMethods(nurseryId: string): Promise<EnabledPaymentMethod[]> {
  const rows = await prisma.nurseryPaymentMethod.findMany({
    where: { nurseryId, isEnabled: true },
    orderBy: { sortOrder: 'asc' },
  });
  return rows.map((r) => ({
    method: r.method,
    label: PAYMENT_METHOD_LABELS[r.method],
    instructions: r.instructions,
    destination: r.destination,
  }));
}
