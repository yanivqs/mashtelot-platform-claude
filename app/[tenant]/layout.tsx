import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getNurseryByTenant } from '@/lib/tenant';
import { getActivePromotion } from '@/lib/marketing';
import { getNurseryTheme } from '@/lib/theme';
import { isModuleEnabled } from '@/lib/module-access';
import { getNavPages } from '@/lib/pages';
import { tenantOrigin } from '@/lib/seo';
import { CartProvider } from '@/components/cart/cart-provider';
import { SiteHeader } from '@/components/storefront/site-header';
import { SiteFooter } from '@/components/storefront/site-footer';
import { PromoPopup } from '@/components/storefront/promo-popup';

interface LayoutProps {
  children: React.ReactNode;
  params: { tenant: string };
}

export async function generateMetadata({ params }: LayoutProps): Promise<Metadata> {
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

export default async function TenantLayout({ children, params }: LayoutProps) {
  const nursery = await getNurseryByTenant(params.tenant);
  if (!nursery) notFound();

  const promotion = await getActivePromotion(nursery.id);
  const theme = getNurseryTheme(nursery);
  const showSocial = await isModuleEnabled(nursery.id, 'social');
  const navPages = await getNavPages(nursery.id);

  return (
    <CartProvider tenant={params.tenant}>
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
        <SiteHeader
          nursery={nursery}
          basePath=""
          sticky={theme.stickyHeader}
          navPages={navPages}
        />
        <main className="flex-1">{children}</main>
        <SiteFooter nursery={nursery} showSocial={showSocial} />
        {promotion?.popupText && (
          <PromoPopup id={promotion.id} title={promotion.title} text={promotion.popupText} />
        )}
      </div>
    </CartProvider>
  );
}
