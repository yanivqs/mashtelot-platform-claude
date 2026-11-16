import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getNurseryByTenant } from '@/lib/tenant';
import { getEnabledModuleKeys } from '@/lib/module-access';
import { PrivacyPolicy } from '@/components/privacy-policy';

export const revalidate = 3600;

// בלי הפונקציה הזו Next מרנדר את הדף בכל בקשה ומתעלם מ-revalidate.
export async function generateStaticParams() {
  return [];
}

export async function generateMetadata(props: { params: Promise<{ tenant: string }> }): Promise<Metadata> {
  const { tenant } = await props.params;
  const nursery = await getNurseryByTenant(tenant);
  if (!nursery) return {};
  return {
    title: 'מדיניות פרטיות',
    description: `איזה מידע ${nursery.name} אוספת באתר, למה, למי הוא מועבר ואילו זכויות יש לכם.`,
    alternates: { canonical: '/privacy' },
  };
}

export default async function NurseryPrivacyPage(props: { params: Promise<{ tenant: string }> }) {
  const { tenant } = await props.params;
  const nursery = await getNurseryByTenant(tenant);
  if (!nursery) notFound();
  const modules = await getEnabledModuleKeys(nursery.id);
  return (
    <PrivacyPolicy
      name={nursery.name}
      email={nursery.contactEmail || nursery.ownerEmail}
      phone={nursery.phoneNumber}
      address={[nursery.addressLine, nursery.city].filter(Boolean).join(', ') || null}
      customerAccounts={modules.has('customer_accounts')}
      loyalty={modules.has('loyalty')}
      newsletter={modules.has('newsletter')}
      delivery={nursery.deliveryEnabled}
    />
  );
}
