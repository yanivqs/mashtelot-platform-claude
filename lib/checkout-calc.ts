/**
 * לוגיקת המחיר/מלאי/קופון הטהורה של ה-checkout — ללא Prisma/Next, כדי שתהיה
 * ניתנת לבדיקה ישירה (unit tests) בלי תלות בזמן-ריצה של שרת. `createOrder`
 * (app/[tenant]/checkout/actions.ts) משתמש בפונקציות האלה ומוסיף עליהן את
 * שכבת ה-DB (טרנזקציה, נעילת מלאי אטומית, מיצוי קופון אטומי).
 */

export class CheckoutError extends Error {}

export interface CartLine {
  productId: string;
  quantity: number;
}

export interface ProductForCheckout {
  id: string;
  title: string;
  price: number;
  stockQuantity: number;
}

export interface ResolvedLineItem {
  nurseryProductId: string;
  productTitle: string;
  quantity: number;
  unitPrice: number;
}

/** ממיר שורות עגלה למוצרים שנפתרו, וזורק אם מוצר לא קיים או שאין מספיק מלאי. */
export function buildLineItems(
  cart: CartLine[],
  productsById: Map<string, ProductForCheckout>,
  opts: { isQuote: boolean },
): ResolvedLineItem[] {
  return cart.map((c) => {
    const product = productsById.get(c.productId);
    if (!product) throw new CheckoutError('אחד המוצרים בעגלה אינו זמין יותר');
    if (!opts.isQuote && product.stockQuantity < c.quantity) {
      throw new CheckoutError(`אין מספיק מלאי עבור "${product.title}"`);
    }
    return {
      nurseryProductId: product.id,
      productTitle: product.title,
      quantity: c.quantity,
      unitPrice: product.price,
    };
  });
}

export function calcSubtotal(lineItems: ResolvedLineItem[]): number {
  return lineItems.reduce((sum, li) => sum + li.unitPrice * li.quantity, 0);
}

export interface CouponForCheckout {
  isActive: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
}

/**
 * מוודא שקופון בתוקף (isActive + חלון תאריכים). אינה בודקת usageLimit —
 * זה נבדק אטומית מול ה-DB (updateMany מותנה) כדי למנוע מרוץ תנאים בין
 * שתי הזמנות שמנצלות את השימוש האחרון בו-זמנית.
 */
export function assertCouponValid(coupon: CouponForCheckout, now: Date = new Date()): void {
  if (!coupon.isActive) throw new CheckoutError('קוד קופון לא תקף');
  if (coupon.startsAt && coupon.startsAt > now) throw new CheckoutError('קוד קופון עדיין לא בתוקף');
  if (coupon.endsAt && coupon.endsAt < now) throw new CheckoutError('קוד קופון פג תוקף');
}

export function applyDiscount(subtotal: number, discountPct: number): number {
  return subtotal * (1 - discountPct / 100);
}
