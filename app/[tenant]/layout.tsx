import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getNurseryByTenant } from '@/lib/tenant';
import { tenantOrigin } from '@/lib/seo';
import { CartProvider } from '@/components/cart/cart-provider';
import { SiteHeader } from '@/components/storefront/site-header';
import { SiteFooter } from '@/components/storefront/site-footer';

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

  const brand = nursery.primaryColor || '#16a34a';

  return (
    <CartProvider tenant={params.tenant}>
      <div
        dir="rtl"
        className="flex min-h-screen flex-col bg-white"
        style={{ '--brand': brand } as React.CSSProperties}
      >
        <SiteHeader nursery={nursery} basePath="" />
        <main className="flex-1">{children}</main>
        <SiteFooter nursery={nursery} />
      </div>
    </CartProvider>
  );
}
