'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export interface CartItem {
  productId: string;
  /** וריאנט (§7.01). חסר בעגלות ישנות — השרת משייך לברירת המחדל */
  variantId?: string | null;
  title: string;
  price: number;
  image: string | null;
  slug: string;
  quantity: number;
}

export type SalesMode = 'DISABLED' | 'ONLINE' | 'QUOTE';

/** מזהה שורה בעגלה: מוצר + וריאנט. */
export function cartKey(i: Pick<CartItem, 'productId' | 'variantId'>): string {
  return `${i.productId}:${i.variantId ?? ''}`;
}

interface CartContextValue {
  items: CartItem[];
  count: number;
  subtotal: number;
  salesMode: SalesMode;
  add: (item: Omit<CartItem, 'quantity'>, quantity?: number) => void;
  setQuantity: (key: string, quantity: number) => void;
  remove: (key: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({
  tenant,
  salesMode = 'ONLINE',
  children,
}: {
  tenant: string;
  salesMode?: SalesMode;
  children: ReactNode;
}) {
  const storageKey = `cart:${tenant}`;
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // טעינת העגלה מ-localStorage אחרי ה-hydration בכוונה: השרת מרנדר עגלה ריקה, וקריאה
  // מוקדמת יותר הייתה יוצרת אי-התאמה בין ה-HTML של השרת לדפדפן. זה סנכרון ממערכת חיצונית.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      setItems(raw ? (JSON.parse(raw) as CartItem[]) : []);
    } catch {
      setItems([]);
    }
    setHydrated(true);
  }, [storageKey]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(items));
    } catch {
      /* storage unavailable - keep cart in memory only */
    }
  }, [items, hydrated, storageKey]);

  const value = useMemo<CartContextValue>(() => {
    const add: CartContextValue['add'] = (item, quantity = 1) => {
      setItems((prev) => {
        const key = cartKey(item);
        const existing = prev.find((i) => cartKey(i) === key);
        if (existing) {
          return prev.map((i) =>
            cartKey(i) === key
              ? { ...i, quantity: i.quantity + quantity }
              : i,
          );
        }
        return [...prev, { ...item, quantity }];
      });
    };

    const setQuantity: CartContextValue['setQuantity'] = (key, quantity) => {
      setItems((prev) =>
        quantity <= 0
          ? prev.filter((i) => cartKey(i) !== key)
          : prev.map((i) => (cartKey(i) === key ? { ...i, quantity } : i)),
      );
    };

    const remove: CartContextValue['remove'] = (key) =>
      setItems((prev) => prev.filter((i) => cartKey(i) !== key));

    const clear = () => setItems([]);

    return {
      items,
      count: items.reduce((sum, i) => sum + i.quantity, 0),
      subtotal: items.reduce((sum, i) => sum + i.price * i.quantity, 0),
      salesMode,
      add,
      setQuantity,
      remove,
      clear,
    };
  }, [items, salesMode]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within a CartProvider');
  return ctx;
}
