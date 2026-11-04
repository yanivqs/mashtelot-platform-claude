import type { Metadata } from 'next';
import { AccessibilityStatement } from '@/components/accessibility-statement';
import { AccessibilityWidget } from '@/components/accessibility/accessibility-widget';
import { A11Y_BOOT_SCRIPT } from '@/lib/a11y-settings';

export const metadata: Metadata = {
  title: 'הצהרת נגישות | פלטפורמת משתלות',
  alternates: { canonical: '/accessibility' },
};

export default function PlatformAccessibilityPage() {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: A11Y_BOOT_SCRIPT }} />
      <AccessibilityWidget statementHref="/accessibility" />
      <AccessibilityStatement name="פלטפורמת המשתלות" email="hello@mashtelot.net" />
    </>
  );
}
