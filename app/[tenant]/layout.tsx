import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getNurseryByTenant, getSuspendedNursery } from '@/lib/tenant';
import { getActivePromotion } from '@/lib/marketing';
import { getNurseryTheme } from '@/lib/theme';
import { themeStyleVars } from '@/lib/theme-vars';
import { AnnouncementBar } from '@/components/storefront/announcement-bar';
import { isModuleEnabled } from '@/lib/module-access';
import { getSalesMode } from '@/lib/sales';
import { getNavPages, hasPublicBlog } from '@/lib/pages';
import { tenantOrigin, localBusinessJsonLd, jsonLdHtml } from '@/lib/seo';
import { getStoreShareImage } from '@/lib/share-image';
import { getEnabledChannels } from '@/lib/channel-access';
import { getCategoryNav } from '@/lib/catalog';
import { CartProvider } from '@/components/cart/cart-provider';
import { SiteHeader } from '@/components/storefront/site-header';
import { SiteFooter } from '@/components/storefront/site-footer';
import { PromoPopup } from '@/components/storefront/promo-popup';
import { BottomNav } from '@/components/storefront/bottom-nav';

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ tenant: string }>;
}

export async function generateMetadata(props: LayoutProps): Promise<Metadata> {
  const params = await props.params;
  const nursery = await getNurseryByTenant(params.tenant);
  if (!nursery) {
    // §2.03: חנות מושעית — לא באינדקס
    const closed = await getSuspendedNursery(params.tenant);
    return closed ? { title: `${closed.name} — סגורה זמנית`, robots: { index: false, follow: false } } : { title: 'משתלה לא נמצאה' };
  }

  const origin = tenantOrigin(nursery);
  const shareImage = await getStoreShareImage(nursery);
  return {
    metadataBase: new URL(origin),
    title: {
      default: `${nursery.name} | חנות מקוונת`,
      template: `%s | ${nursery.name}`,
    },
    description: `קטלוג הצמחים והציוד של ${nursery.name}. הזמנה אונליין, איסוף עצמי ומשלוחים.`,
    alternates: { canonical: '/' },
    openGraph: {
      type: 'website',
      siteName: nursery.name,
      locale: 'he_IL',
      ...(shareImage ? { images: [{ url: shareImage, alt: nursery.name }] } : {}),
    },
  };
}

export default async function TenantLayout(props: LayoutProps) {
  const params = await props.params;

  const {
    children
  } = props;

  const nursery = await getNurseryByTenant(params.tenant);
  if (!nursery) {
    // §2.03: מושעית — "סגורה זמנית" עם פרטי קשר (במקום כל דפי החנות); טיוטה/ארכיון — 404
    const closed = await getSuspendedNursery(params.tenant);
    if (!closed) notFound();
    return (
      <div dir="rtl" className="flex min-h-screen items-center justify-center bg-gray-50 px-6">
        <div className="max-w-md rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm">
          {closed.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={closed.logoUrl} alt={closed.name} className="mx-auto mb-4 h-12 w-auto" />
          )}
          <h1 className="text-2xl font-bold text-gray-900">{closed.name}</h1>
          <p className="mt-2 text-gray-600">החנות המקוונת סגורה זמנית.</p>
          {(closed.phoneNumber || closed.addressLine || closed.city) && (
            <div className="mt-4 space-y-1 text-sm text-gray-700">
              {closed.phoneNumber && (
                <p>
                  טלפון:{' '}
                  <a href={`tel:${closed.phoneNumber}`} dir="ltr" className="font-medium hover:underline">
                    {closed.phoneNumber}
                  </a>
                </p>
              )}
              {(closed.addressLine || closed.city) && <p>{[closed.addressLine, closed.city].filter(Boolean).join(', ')}</p>}
            </div>
          )}
        </div>
      </div>
    );
  }

  const promotion = await getActivePromotion(nursery.id);
  const theme = getNurseryTheme(nursery);
  const showSocial = await isModuleEnabled(nursery.id, 'social');
  // R06-03: קישור לחשבון — קבוע (בלי לקרוא עוגיות, כדי לא לבטל את המטמון של דפי החנות)
  const showAccount = await isModuleEnabled(nursery.id, 'customer_accounts');
  const channels = showSocial ? await getEnabledChannels(nursery.id) : [];
  const navPages = await getNavPages(nursery.id);
  const showBlog = await hasPublicBlog(nursery.id);
  const salesMode = await getSalesMode(nursery.id);
  const categories = await getCategoryNav(nursery.id);
  const jsonLd = localBusinessJsonLd(nursery);

  return (
    <CartProvider tenant={params.tenant} salesMode={salesMode}>
      <div
        dir="rtl"
        data-store-root
        className="flex min-h-screen flex-col bg-surface"
        style={themeStyleVars(theme) as React.CSSProperties}
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdHtml(jsonLd) }}
        />
        <a
          href="#main"
          className="sr-only rounded-lg bg-white px-4 py-2 text-sm font-medium text-gray-900 shadow-lg focus:not-sr-only focus:fixed focus:right-3 focus:top-3 focus:z-[100]"
        >
          דילוג לתוכן
        </a>
        <AnnouncementBar announcement={theme.announcement} basePath="" />
        <SiteHeader
          nursery={nursery}
          mobileStyle={theme.headerStyle}
          belowAnnouncement={theme.announcement.enabled}
          basePath=""
          sticky={theme.stickyHeader}
          navPages={navPages}
          categories={categories}
          showBlog={showBlog}
          showAccount={showAccount}
        />
        <main id="main" tabIndex={-1} className="flex-1 outline-none">
          {children}
        </main>
        <SiteFooter nursery={nursery} channels={channels} />
        {theme.headerStyle === 'float' ? (
          // מקום לסרגל הצף כדי שלא יסתיר את תחתית הדף
          <div className="h-16 md:hidden" aria-hidden />
        ) : theme.headerStyle === 'classic' ? (
          <BottomNav basePath="" />
        ) : null}
        {promotion?.popupText && (
          <PromoPopup id={promotion.id} title={promotion.title} text={promotion.popupText} />
        )}
      </div>
    </CartProvider>
  );
}
