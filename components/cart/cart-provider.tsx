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
  title: string;
  price: number;
  image: string | null;
  slug: string;
  quantity: number;
}

export type SalesMode = 'DISABLED' | 'ONLINE' | 'QUOTE';

interface CartContextValue {
  items: CartItem[];
  count: number;
  subtotal: number;
  salesMode: SalesMode;
  add: (item: Omit<CartItem, 'quantity'>, quantity?: number) => void;
  setQuantity: (productId: string, quantity: number) => void;
  remove: (productId: string) => void;
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

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      setItems(raw ? (JSON.parse(raw) as CartItem[]) : []);
    } catch {
      setItems([]);
    }
    setHydrated(true);
  }, [storageKey]);

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
        const existing = prev.find((i) => i.productId === item.productId);
        if (existing) {
          return prev.map((i) =>
            i.productId === item.productId
              ? { ...i, quantity: i.quantity + quantity }
              : i,
          );
        }
        return [...prev, { ...item, quantity }];
      });
    };

    const setQuantity: CartContextValue['setQuantity'] = (productId, quantity) => {
      setItems((prev) =>
        quantity <= 0
          ? prev.filter((i) => i.productId !== productId)
          : prev.map((i) => (i.productId === productId ? { ...i, quantity } : i)),
      );
    };

    const remove: CartContextValue['remove'] = (productId) =>
      setItems((prev) => prev.filter((i) => i.productId !== productId));

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
