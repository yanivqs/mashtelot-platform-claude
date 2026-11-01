'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { getNurseryByTenant } from '@/lib/tenant';
import { isModuleEnabled } from '@/lib/module-access';
import { getCustomer } from '@/lib/customer-session';
import { getProductById } from '@/lib/catalog';
import { resolveProductContent } from '@/lib/seo';
import { priceSummary } from '@/lib/variants';
import { productSlug } from '@/lib/utils';
import { addAddress, deleteAddress, isFavorite, reorderLines, setDefaultAddress, toggleFavorite, type ReorderLine } from '@/lib/customer-portal';

/** חנות + מודול חשבונות + הלקוח המחובר (או null). */
async function session(tenant: string) {
  const nursery = await getNurseryByTenant(String(tenant || ''));
  if (!nursery || !(await isModuleEnabled(nursery.id, 'customer_accounts'))) return null;
  return { nursery, customer: await getCustomer(nursery.id) };
}

// ---------- מועדפים ----------

export async function favoriteStatus(tenant: string, productId: string): Promise<{ enabled: boolean; loggedIn: boolean; favorite: boolean }> {
  const s = await session(tenant);
  if (!s) return { enabled: false, loggedIn: false, favorite: false };
  if (!s.customer) return { enabled: true, loggedIn: false, favorite: false };
  return { enabled: true, loggedIn: true, favorite: await isFavorite(prisma, s.customer.id, String(productId)) };
}

export async function toggleFavoriteAction(tenant: string, productId: string): Promise<{ ok: boolean; favorite?: boolean; error?: string }> {
  const s = await session(tenant);
  if (!s?.customer) return { ok: false, error: 'יש להתחבר' };
  const r = await toggleFavorite(prisma, s.nursery.id, s.customer.id, String(productId));
  revalidatePath('/[tenant]/account', 'page');
  return r.ok ? { ok: true, favorite: r.favorite } : { ok: false, error: r.error };
}

// ---------- מוצרים לתצוגה (מועדפים / נצפו לאחרונה) ----------

export interface ProductSummary {
  id: string;
  title: string;
  slug: string;
  image: string | null;
  price: number;
  fromPrice: boolean;
}

/** מוצרים פעילים של המשתלה הזו בלבד, בסדר שהתקבל (מזהים לא מוכרים — מדולגים). */
export async function productSummaries(tenant: string, ids: string[]): Promise<ProductSummary[]> {
  const nursery = await getNurseryByTenant(String(tenant || ''));
  if (!nursery || !Array.isArray(ids)) return [];
  const unique = [...new Set(ids.filter((x) => typeof x === 'string'))].slice(0, 12);
  const products = await Promise.all(unique.map((id) => getProductById(nursery.id, id)));
  return products
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    .map((p) => {
      const { title, image } = resolveProductContent(p);
      const s = priceSummary(p.variants, p);
      return { id: p.id, title, slug: productSlug(p.id, title, p.slug), image, price: s.min, fromPrice: s.min !== s.max };
    });
}

// ---------- "הזמן שוב" (מודול מועדון לקוחות) ----------

export async function reorderAction(tenant: string, orderId: string): Promise<{ ok: boolean; lines?: (ReorderLine & { slug: string; image: string | null })[]; skipped?: string[]; error?: string }> {
  const s = await session(tenant);
  if (!s?.customer) return { ok: false, error: 'יש להתחבר' };
  if (!(await isModuleEnabled(s.nursery.id, 'loyalty'))) return { ok: false, error: 'האפשרות אינה פעילה בחנות זו' };
  const r = await reorderLines(prisma, s.nursery.id, s.customer.id, String(orderId));
  if (!r.ok) return { ok: false, error: r.error };
  const summaries = await productSummaries(tenant, r.lines.map((l) => l.productId));
  const byId = new Map(summaries.map((p) => [p.id, p]));
  return {
    ok: true,
    lines: r.lines.map((l) => ({ ...l, slug: byId.get(l.productId)?.slug ?? l.productId, image: byId.get(l.productId)?.image ?? null })),
    skipped: r.skipped,
  };
}

// ---------- כתובות ----------

export interface AddressState {
  ok?: boolean;
  error?: string;
  values?: Record<string, string>;
}

export async function addAddressAction(_prev: AddressState, fd: FormData): Promise<AddressState> {
  const s = await session(String(fd.get('tenant') || ''));
  if (!s?.customer) return { error: 'יש להתחבר מחדש' };
  const values = Object.fromEntries(['label', 'city', 'street', 'postcode'].map((k) => [k, String(fd.get(k) || '')]));
  const r = await addAddress(prisma, s.customer.id, { ...values, city: values.city!, street: values.street!, isDefault: fd.get('isDefault') === 'on' });
  if (!r.ok) return { error: r.error, values };
  revalidatePath('/[tenant]/account', 'page');
  return { ok: true };
}

export async function addressOpAction(fd: FormData): Promise<void> {
  const s = await session(String(fd.get('tenant') || ''));
  if (!s?.customer) return;
  const id = String(fd.get('id') || '');
  if (fd.get('op') === 'delete') await deleteAddress(prisma, s.customer.id, id);
  else if (fd.get('op') === 'default') await setDefaultAddress(prisma, s.customer.id, id);
  revalidatePath('/[tenant]/account', 'page');
}
