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
  Truck,
  Tags,
  Mail,
  ExternalLink,
  KeyRound,
  ShieldCheck,
  SearchCode,
  ClipboardCheck,
  Image as ImageIcon,
  Signpost,
  RefreshCw,
  Users,
  Gift,
  History,
  type LucideIcon,
} from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { getEnabledModuleKeys } from '@/lib/module-access';
import { MODULES } from '@/lib/modules';
import { tenantOrigin } from '@/lib/seo';
import { prisma } from '@/lib/prisma';
import { pendingUpdateCount } from '@/lib/catalog-sync-admin';
import { ROLE_LABELS, roleAllowsArea } from '@/lib/nursery-access';
import type { Role } from '@prisma/client';
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
  Truck,
  Tags,
  Users,
  Gift,
};

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const adminNav: NavItem[] = [
  { href: '/admin/catalog', label: 'קטלוג בוטני', icon: Sprout },
  { href: '/admin/nurseries', label: 'משתלות', icon: Store },
  { href: '/admin/print-orders', label: 'בית דפוס', icon: Printer },
  { href: '/admin/print-templates', label: 'תבניות דפוס', icon: FileText },
  { href: '/admin/print-specs', label: 'אישורי מפרט', icon: ClipboardCheck },
  { href: '/admin/print-artwork', label: 'גרפיקה והגהות', icon: ImageIcon },
  { href: '/admin/system', label: 'מיילים ומערכת', icon: Mail },
  { href: '/admin/search-synonyms', label: 'מילים נרדפות בחיפוש', icon: SearchCode },
  { href: '/admin/security', label: 'יומן התחברויות', icon: ShieldCheck },
  { href: '/admin/activity', label: 'יומן פעולות', icon: History },
];

/** מסכי תוכן (R06: כותב תוכן רואה רק אותם). */
const CONTENT_HREFS = new Set(['/admin/pages', '/admin/blog']);

/** ניווט משתלה — נבנה מתוך המודולים המשויכים, ומסונן לפי התפקיד (R06-01). */
async function buildOwnerNav(nurseryId: string | null, role: Role): Promise<NavItem[]> {
  const nav = await buildFullNurseryNav(nurseryId);
  if (role === 'NURSERY_WRITER') return nav.filter((i) => i.href === '/admin' || CONTENT_HREFS.has(i.href));
  if (roleAllowsArea(role, 'owner')) {
    nav.splice(nav.length - 1, 0, { href: '/admin/team', label: 'צוות', icon: Users }, { href: '/admin/activity', label: 'יומן פעולות', icon: History });
  }
  return nav;
}

async function buildFullNurseryNav(nurseryId: string | null): Promise<NavItem[]> {
  const nav: NavItem[] = [{ href: '/admin', label: 'סקירה', icon: LayoutDashboard }];
  const enabled = nurseryId ? await getEnabledModuleKeys(nurseryId) : new Set<string>();

  const hasProducts = enabled.has('plant_catalog') || enabled.has('supplies');
  if (hasProducts) {
    nav.push({ href: '/admin/products', label: 'המלאי שלי', icon: Package });
    nav.push({ href: '/admin/products/browse', label: 'שיוך מוצרים', icon: PlusSquare });
    nav.push({ href: '/admin/products/categories', label: 'הקטגוריות שלי', icon: Tags });
    // §6: עדכונים ממתינים מהקטלוג המרכזי (ללא הודעות יזומות — מונה בתפריט בלבד, Q3-א)
    const pending = nurseryId ? await pendingUpdateCount(prisma, nurseryId) : 0;
    nav.push({
      href: '/admin/catalog-updates',
      label: pending > 0 ? `עדכונים מהקטלוג (${pending})` : 'עדכונים מהקטלוג',
      icon: RefreshCw,
    });
  }

  for (const mod of MODULES) {
    if (mod.key === 'plant_catalog') continue; // כבר טופל למעלה
    if (!enabled.has(mod.key) || !mod.ownerNav) continue;
    for (const item of mod.ownerNav) {
      nav.push({ href: item.href, label: item.label, icon: ICONS[item.icon] ?? Package });
    }
  }

  nav.push({ href: '/admin/redirects', label: 'הפניות (SEO)', icon: Signpost });
  nav.push({ href: '/admin/settings', label: 'הגדרות המשתלה', icon: Settings });
  return nav;
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const isSuper = user.role === 'SUPER_ADMIN';
  // PT-04: בקשות מפרט שממתינות לאישור בית הדפוס
  const pendingSpecs = isSuper ? await prisma.printSavedRevision.count({ where: { status: 'SUBMITTED' } }) : 0;
  // PT-05: קבצי גרפיקה שממתינים להגהה
  const pendingArtwork = isSuper ? await prisma.printArtworkVersion.count({ where: { status: 'UPLOADED' } }) : 0;
  const counts: Record<string, number> = { '/admin/print-specs': pendingSpecs, '/admin/print-artwork': pendingArtwork };
  const superNav = adminNav.map((item) =>
    counts[item.href] ? { ...item, label: `${item.label} (${counts[item.href]})` } : item,
  );

  let ownerNav: NavItem[] = [];
  let storeUrl: string | null = null;
  if (!isSuper) {
    const nursery = user.nursery; // לעולם לא "המשתלה הראשונה" (C-P1-01)
    ownerNav = await buildOwnerNav(nursery?.id ?? null, user.role);
    storeUrl = nursery ? tenantOrigin(nursery) : null;
  }

  return (
    <div dir="rtl" className="flex min-h-screen bg-gray-50 text-gray-900">
      <aside className="flex w-60 shrink-0 flex-col border-l border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-5 py-4">
          <p className="text-sm font-bold">
            {isSuper ? 'ניהול פלטפורמה' : user.nursery?.name ?? 'המשתלה שלי'}
          </p>
          <p className="mt-0.5 truncate text-xs text-gray-500">{user.email}</p>
          {ROLE_LABELS[user.role] && user.role !== 'NURSERY_OWNER' && (
            <p className="mt-0.5 text-xs text-gray-400">{ROLE_LABELS[user.role]}</p>
          )}
          {storeUrl && (
            <a
              href={storeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 flex items-center justify-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-medium text-brand-800 hover:bg-brand-100"
            >
              <ExternalLink className="h-4 w-4" />
              צפייה בחנות שלי
            </a>
          )}
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
              {superNav.map(({ href, label, icon: Icon }) => (
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

        {/* R06: לעובדים אין "החשבון שלי" — הסיסמה מנוהלת בידי בעל המשתלה */}
        {(isSuper || user.role === 'NURSERY_OWNER') && (
        <div className="border-t border-gray-100 p-3 pb-0">
          <Link
            href="/admin/account"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
          >
            <KeyRound className="h-4 w-4" />
            החשבון שלי
          </Link>
        </div>
        )}
        <form action={logout} className="p-3">
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
