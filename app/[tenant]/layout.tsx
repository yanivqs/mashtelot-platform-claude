import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getNurseryByTenant } from '@/lib/tenant';
import { getActivePromotion } from '@/lib/marketing';
import { getNurseryTheme } from '@/lib/theme';
import { isModuleEnabled } from '@/lib/module-access';
import { getSalesMode } from '@/lib/sales';
import { getNavPages, hasPublicBlog } from '@/lib/pages';
import { tenantOrigin, localBusinessJsonLd } from '@/lib/seo';
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
  if (!nursery) return { title: 'משתלה לא נמצאה' };

  const origin = tenantOrigin(nursery);
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
      url: origin,
    },
  };
}

export default async function TenantLayout(props: LayoutProps) {
  const params = await props.params;

  const {
    children
  } = props;

  const nursery = await getNurseryByTenant(params.tenant);
  if (!nursery) notFound();

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
        className="flex min-h-screen flex-col bg-white"
        style={
          {
            '--brand': theme.colors.primary,
            '--accent': theme.colors.accent,
          } as React.CSSProperties
        }
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <SiteHeader
          nursery={nursery}
          basePath=""
          sticky={theme.stickyHeader}
          navPages={navPages}
          categories={categories}
          showBlog={showBlog}
          showAccount={showAccount}
        />
        <main className="flex-1">{children}</main>
        <SiteFooter nursery={nursery} channels={channels} />
        <BottomNav basePath="" />
        {promotion?.popupText && (
          <PromoPopup id={promotion.id} title={promotion.title} text={promotion.popupText} />
        )}
      </div>
    </CartProvider>
  );
}
