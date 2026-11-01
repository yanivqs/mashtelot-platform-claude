import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getNurseryByTenant } from '@/lib/tenant';
import { AccessibilityStatement } from '@/components/accessibility-statement';

export const metadata: Metadata = {
  title: 'הצהרת נגישות',
  alternates: { canonical: '/accessibility' },
};

export default async function NurseryAccessibilityPage(props: { params: Promise<{ tenant: string }> }) {
  const { tenant } = await props.params;
  const nursery = await getNurseryByTenant(tenant);
  if (!nursery) notFound();
  return (
    <AccessibilityStatement
      name={nursery.name}
      phone={nursery.phoneNumber}
      email={nursery.contactEmail || nursery.ownerEmail}
      physicalNote
    />
  );
}
