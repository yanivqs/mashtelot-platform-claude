import type { Metadata } from 'next';
import Link from 'next/link';
import { LayoutDashboard, Package, PlusSquare, ShoppingBag, Sprout, Store, LogOut } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { logout } from './actions';

export const metadata: Metadata = {
  title: 'פורטל ניהול',
  robots: { index: false, follow: false },
};

const ownerNav = [
  { href: '/admin', label: 'סקירה', icon: LayoutDashboard },
  { href: '/admin/products', label: 'המלאי שלי', icon: Package },
  { href: '/admin/products/browse', label: 'הוספת מוצרים', icon: PlusSquare },
  { href: '/admin/orders', label: 'הזמנות', icon: ShoppingBag },
];

const adminNav = [
  { href: '/admin/catalog', label: 'קטלוג בוטני', icon: Sprout },
  { href: '/admin/nurseries', label: 'משתלות', icon: Store },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const isSuper = user.role === 'SUPER_ADMIN';

  return (
    <div dir="rtl" className="flex min-h-screen bg-gray-50 text-gray-900">
      <aside className="flex w-60 shrink-0 flex-col border-l border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-5 py-4">
          <p className="text-sm font-bold">{isSuper ? 'ניהול פלטפורמה' : user.nursery?.name ?? 'המשתלה שלי'}</p>
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
