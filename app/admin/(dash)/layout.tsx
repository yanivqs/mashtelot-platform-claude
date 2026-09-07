import type { Metadata } from 'next';
import Link from 'next/link';
import {
  LayoutDashboard,
  Package,
  PlusSquare,
  ShoppingBag,
  Megaphone,
  Printer,
  Sprout,
  Store,
  Settings,
  FileText,
  Newspaper,
  LogOut,
  type LucideIcon,
} from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getEnabledModuleKeys } from '@/lib/module-access';
import { MODULES } from '@/lib/modules';
import { logout } from './actions';

export const metadata: Metadata = {
  title: 'פורטל ניהול',
  robots: { index: false, follow: false },
};

const ICONS: Record<string, LucideIcon> = {
  LayoutDashboard,
  Package,
  PlusSquare,
  ShoppingBag,
  Megaphone,
  Printer,
  Settings,
  FileText,
  Newspaper,
};

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const adminNav: NavItem[] = [
  { href: '/admin/catalog', label: 'קטלוג בוטני', icon: Sprout },
  { href: '/admin/nurseries', label: 'משתלות', icon: Store },
  { href: '/admin/print-orders', label: 'הזמנות דפוס', icon: Printer },
];

/** ניווט בעל משתלה — נבנה מתוך המודולים המשויכים בלבד. */
async function buildOwnerNav(nurseryId: string | null): Promise<NavItem[]> {
  const nav: NavItem[] = [{ href: '/admin', label: 'סקירה', icon: LayoutDashboard }];
  const enabled = nurseryId ? await getEnabledModuleKeys(nurseryId) : new Set<string>();

  const hasProducts = enabled.has('plant_catalog') || enabled.has('supplies');
  if (hasProducts) {
    nav.push({ href: '/admin/products', label: 'המלאי שלי', icon: Package });
    nav.push({ href: '/admin/products/browse', label: 'הוספת מוצרים', icon: PlusSquare });
  }

  for (const mod of MODULES) {
    if (mod.key === 'plant_catalog') continue; // כבר טופל למעלה
    if (!enabled.has(mod.key) || !mod.ownerNav) continue;
    for (const item of mod.ownerNav) {
      nav.push({ href: item.href, label: item.label, icon: ICONS[item.icon] ?? Package });
    }
  }

  nav.push({ href: '/admin/settings', label: 'הגדרות המשתלה', icon: Settings });
  return nav;
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const isSuper = user.role === 'SUPER_ADMIN';

  let ownerNav: NavItem[] = [];
  if (!isSuper) {
    const nurseryId =
      user.nurseryId ??
      (await prisma.nursery.findFirst({ orderBy: { createdAt: 'asc' } }))?.id ??
      null;
    ownerNav = await buildOwnerNav(nurseryId);
  }

  return (
    <div dir="rtl" className="flex min-h-screen bg-gray-50 text-gray-900">
      <aside className="flex w-60 shrink-0 flex-col border-l border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-5 py-4">
          <p className="text-sm font-bold">
            {isSuper ? 'ניהול פלטפורמה' : user.nursery?.name ?? 'המשתלה שלי'}
          </p>
          <p className="mt-0.5 truncate text-xs text-gray-500">{user.email}</p>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {!isSuper &&
            ownerNav.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}

          {isSuper && (
            <>
              <Link
                href="/admin"
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                <LayoutDashboard className="h-4 w-4" />
                סקירה
              </Link>
              {adminNav.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              ))}
            </>
          )}
        </nav>

        <form action={logout} className="border-t border-gray-100 p-3">
          <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100">
            <LogOut className="h-4 w-4" />
            התנתקות
          </button>
        </form>
      </aside>

      <main className="flex-1 overflow-x-hidden p-8">{children}</main>
    </div>
  );
}
