/**
 * לוגיקת המחיר/מלאי/קופון הטהורה של ה-checkout — ללא Prisma/Next, כדי שתהיה
 * ניתנת לבדיקה ישירה (unit tests) בלי תלות בזמן-ריצה של שרת. `createOrder`
 * (app/[tenant]/checkout/actions.ts) משתמש בפונקציות האלה ומוסיף עליהן את
 * שכבת ה-DB (טרנזקציה, נעילת מלאי אטומית, מיצוי קופון אטומי).
 */

export class CheckoutError extends Error {}

export interface CartLine {
  productId: string;
  /** וריאנט (§7.01); חסר = ברירת המחדל */
  variantId?: string | null;
  quantity: number;
  /** מפתח השורה במפה (מוצר+וריאנט); ברירת מחדל — lineKey(productId, variantId) */
  key?: string;
}

/** מפתח שורת עגלה: מוצר + וריאנט. */
export function lineKey(productId: string, variantId: string | null | undefined): string {
  return `${productId}:${variantId ?? ''}`;
}

export interface ProductForCheckout {
  id: string;
  variantId?: string | null;
  variantName?: string | null;
  title: string;
  price: number;
  stockQuantity: number;
}

export interface ResolvedLineItem {
  nurseryProductId: string;
  variantId: string | null;
  variantName: string | null;
  productTitle: string;
  quantity: number;
  unitPrice: number;
}

/**
 * ממיר שורות עגלה למוצרים שנפתרו, וזורק אם מוצר/וריאנט לא קיים או שאין מספיק מלאי.
 * `productsByKey` — לפי lineKey(מוצר, וריאנט); לתאימות, גם מפתח של מזהה מוצר בלבד מתקבל.
 */
export function buildLineItems(
  cart: CartLine[],
  productsByKey: Map<string, ProductForCheckout>,
  opts: { isQuote: boolean },
): ResolvedLineItem[] {
  return cart.map((c) => {
    const product = productsByKey.get(c.key ?? lineKey(c.productId, c.variantId)) ?? productsByKey.get(c.productId);
    if (!product) throw new CheckoutError('אחד המוצרים בעגלה אינו זמין יותר');
    if (!opts.isQuote && product.stockQuantity < c.quantity) {
      throw new CheckoutError(`אין מספיק מלאי עבור "${product.title}"`);
    }
    return {
      nurseryProductId: product.id,
      variantId: product.variantId ?? null,
      variantName: product.variantName ?? null,
      productTitle: product.title,
      quantity: c.quantity,
      unitPrice: product.price,
    };
  });
}

export function calcSubtotal<T extends { unitPrice: number; quantity: number }>(lineItems: T[]): number {
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

/** מינימום הזמנה לקופון (§12.01): סכום המוצרים לפני הנחה ומשלוח. */
export function assertCouponMinOrder(minOrderAmount: number | null, subtotal: number): void {
  if (minOrderAmount !== null && subtotal < minOrderAmount) {
    throw new CheckoutError(`הקופון תקף בהזמנה מעל ₪${minOrderAmount.toFixed(2)}`);
  }
}

export function applyDiscount(subtotal: number, discountPct: number): number {
  return subtotal * (1 - discountPct / 100);
}

export interface ShippingZoneForCheckout {
  shippingPrice: number;
  freeShippingThreshold: number | null;
}

/** עלות המשלוח לאזור נתון, בהתחשב בסף למשלוח חינם (0 אם הסכום הגיע לסף). */
export function resolveShippingCost(subtotal: number, zone: ShippingZoneForCheckout): number {
  if (zone.freeShippingThreshold !== null && subtotal >= zone.freeShippingThreshold) return 0;
  return zone.shippingPrice;
}

export type DeliveryChoice = 'PICKUP' | 'DELIVERY';

/** אופני הקבלה שהמשתלה מאפשרת (אם שניהם כבויים — איסוף עצמי, כדי שההזמנה תמיד אפשרית). */
export function availableDeliveryMethods(n: {
  pickupEnabled: boolean;
  deliveryEnabled: boolean;
}): DeliveryChoice[] {
  const out: DeliveryChoice[] = [];
  if (n.pickupEnabled) out.push('PICKUP');
  if (n.deliveryEnabled) out.push('DELIVERY');
  return out.length ? out : ['PICKUP'];
}

/**
 * אופן הקבלה הסופי: הבחירה של הלקוח אם מותרת; אם יש רק אפשרות אחת — היא;
 * אחרת שגיאה (הלקוח חייב לבחור).
 */
export function resolveDeliveryMethod(
  requested: string | undefined,
  allowed: DeliveryChoice[],
): DeliveryChoice {
  if (requested && (allowed as string[]).includes(requested)) return requested as DeliveryChoice;
  if (allowed.length === 1) return allowed[0];
  throw new CheckoutError('יש לבחור איסוף עצמי או משלוח');
}
