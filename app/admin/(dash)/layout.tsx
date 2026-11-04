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
  Images,
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
  LayoutTemplate,
  History,
  Sparkles,
  Wallet,
  type LucideIcon,
  Accessibility,
} from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { getEnabledModuleKeys } from '@/lib/module-access';
import { tenantOrigin } from '@/lib/seo';
import { prisma } from '@/lib/prisma';
import { pendingUpdateCount } from '@/lib/catalog-sync-admin';
import { ROLE_LABELS, roleAllowsArea } from '@/lib/nursery-access';
import { getAccountStatus } from '@/lib/nursery-account';
import { formatAccountDate } from '@/lib/nursery-billing';
import type { Role } from '@prisma/client';
import { logout } from './actions';
import { AdminShell } from '@/components/admin/admin-shell';

export const metadata: Metadata = {
  title: 'פורטל ניהול',
  robots: { index: false, follow: false },
};

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const adminNav: NavItem[] = [
  { href: '/admin/catalog', label: 'קטלוג בוטני', icon: Sprout },
  { href: '/admin/nurseries', label: 'משתלות', icon: Store },
  { href: '/admin/accounts', label: 'חשבונות משתלות', icon: Wallet },
  { href: '/admin/print-orders', label: 'בית דפוס', icon: Printer },
  { href: '/admin/print-jobs', label: 'עבודות קודמות', icon: History },
  { href: '/admin/print-templates', label: 'תבניות דפוס', icon: FileText },
  { href: '/admin/print-specs', label: 'אישורי מפרט', icon: ClipboardCheck },
  { href: '/admin/print-artwork', label: 'גרפיקה והגהות', icon: ImageIcon },
  { href: '/admin/system', label: 'מיילים ומערכת', icon: Mail },
  { href: '/admin/search-synonyms', label: 'מילים נרדפות בחיפוש', icon: SearchCode },
  { href: '/admin/security', label: 'יומן התחברויות', icon: ShieldCheck },
  { href: '/admin/activity', label: 'יומן פעולות', icon: History },
  { href: '/admin/ai-usage', label: 'שימוש ב-AI', icon: Sparkles },
];

/** מסכי תוכן (R06: כותב תוכן רואה רק אותם). */
const CONTENT_HREFS = new Set(['/admin/pages', '/admin/blog']);

/** ניווט משתלה: מערכת הבסיס בסדר הקבוע, אחריה התוספות שהופעלו. מסונן לפי התפקיד (R06-01). */
async function buildOwnerNav(nurseryId: string | null, role: Role): Promise<NavItem[]> {
  const overview: NavItem = { href: '/admin', label: 'סקירה', icon: LayoutDashboard };
  if (!nurseryId) return [overview];
  const enabled = await getEnabledModuleKeys(nurseryId);
  const pending = await pendingUpdateCount(prisma, nurseryId);
  const isOwner = roleAllowsArea(role, 'owner');

  const nav: NavItem[] = [
    overview,
    { href: '/admin/products', label: 'המלאי שלי', icon: Package },
    { href: '/admin/products/browse', label: 'שיוך מוצרים', icon: PlusSquare },
    { href: '/admin/products/categories', label: 'הקטגוריות שלי', icon: Tags },
    { href: '/admin/orders', label: 'הזמנות', icon: ShoppingBag },
    { href: '/admin/redirects', label: 'הפניות SEO', icon: Signpost },
    { href: '/admin/settings', label: 'הגדרות משתלה', icon: Settings },
    { href: '/admin/print-shop', label: 'בית דפוס', icon: Printer },
  ];
  if (isOwner) nav.push({ href: '/admin/activity', label: 'יומן פעילות', icon: History });
  // §6: עדכונים ממתינים מהקטלוג המרכזי (ללא הודעות יזומות — מונה בתפריט בלבד, Q3-א)
  nav.push({ href: '/admin/catalog-updates', label: pending > 0 ? `עדכונים מהקטלוג (${pending})` : 'עדכונים מהקטלוג', icon: RefreshCw });
  nav.push({ href: '/admin/products/images', label: 'תיקיית תמונות', icon: Images });
  const a11yOpen = await prisma.accessibilityReport.count({ where: { nurseryId, status: { not: 'RESOLVED' } } });
  nav.push({ href: '/admin/accessibility', label: a11yOpen > 0 ? `נגישות (${a11yOpen})` : 'נגישות', icon: Accessibility });

  if (enabled.has('announcement') || enabled.has('coupons') || enabled.has('popups')) nav.push({ href: '/admin/marketing', label: 'שיווק', icon: Megaphone });
  if (enabled.has('newsletter')) nav.push({ href: '/admin/newsletter', label: 'תפוצת דואר', icon: Mail });
  if (enabled.has('static_pages')) nav.push({ href: '/admin/pages', label: 'עמודים', icon: FileText });
  if (enabled.has('blog')) nav.push({ href: '/admin/blog', label: 'בלוג', icon: Newspaper });
  if (enabled.has('shipping')) nav.push({ href: '/admin/shipping', label: 'משלוחים', icon: Truck });
  if (enabled.has('crm')) nav.push({ href: '/admin/customers', label: 'לקוחות', icon: Users });
  if (enabled.has('loyalty')) nav.push({ href: '/admin/loyalty', label: 'מועדון לקוחות', icon: Gift });
  if (enabled.has('page_builder')) nav.push({ href: '/admin/page-builder', label: 'עיצוב דף הבית', icon: LayoutTemplate });
  if (enabled.has('team') && isOwner) nav.push({ href: '/admin/team', label: 'צוות', icon: Users });

  if (role === 'NURSERY_WRITER') return nav.filter((i) => i.href === '/admin' || CONTENT_HREFS.has(i.href));
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
  const account = !isSuper && user.nurseryId ? await getAccountStatus(user.nurseryId) : null;
  const blocked = account?.state === 'BLOCKED';
  if (!isSuper && !blocked) {
    const nursery = user.nursery; // לעולם לא "המשתלה הראשונה" (C-P1-01)
    ownerNav = await buildOwnerNav(nursery?.id ?? null, user.role);
    storeUrl = nursery ? tenantOrigin(nursery) : null;
  }

  const title = isSuper ? 'ניהול פלטפורמה' : user.nursery?.name ?? 'המשתלה שלי';
  const sidebar = (
      <>
        <div className="border-b border-gray-100 px-5 py-4">
          <p className="text-sm font-bold">{title}</p>
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
        {(isSuper || user.role === 'NURSERY_OWNER') && !blocked && (
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
      </>
  );

  return (
    <AdminShell title={title} sidebar={sidebar}>
      {account?.state === 'WARNING' && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="status" data-testid="account-warning">
          {account.reason === 'EXPIRED' ? 'תוקף החשבון מסתיים' : 'מועד החיוב'} ב-{formatAccountDate(account.dueDate)}. אם לא יוסדר, הגישה לניהול תיחסם ב-{formatAccountDate(account.blocksOn)}. לפרטים פנו למנהל הפלטפורמה.
        </div>
      )}
      {children}
    </AdminShell>
  );
}
