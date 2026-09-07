import 'server-only';
import { getNurseryModuleMap } from '@/lib/module-access';

export type SalesMode = 'DISABLED' | 'ONLINE' | 'QUOTE';

/**
 * מצב המכירה של משתלה:
 * - DISABLED: מודול `sales` לא משויך → קטלוג בלבד, ללא עגלה/הזמנה.
 * - QUOTE: מקבל בקשות להצעת מחיר (ללא תשלום, ללא ניכוי מלאי).
 * - ONLINE: הזמנה אונליין רגילה.
 */
export async function getSalesMode(nurseryId: string): Promise<SalesMode> {
  const map = await getNurseryModuleMap(nurseryId);
  const sales = map.get('sales');
  if (!sales?.enabled) return 'DISABLED';
  return sales.config.mode === 'QUOTE' ? 'QUOTE' : 'ONLINE';
}
