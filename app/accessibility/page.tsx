import type { Metadata } from 'next';
import { AccessibilityStatement } from '@/components/accessibility-statement';

export const metadata: Metadata = {
  title: 'הצהרת נגישות | פלטפורמת משתלות',
  alternates: { canonical: '/accessibility' },
};

export default function PlatformAccessibilityPage() {
  return <AccessibilityStatement name="פלטפורמת המשתלות" email="hello@mashtelot.net" />;
}
