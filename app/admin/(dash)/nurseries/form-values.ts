import type { Nursery } from '@prisma/client';
import { getNurseryTheme, openingHoursToText } from '@/lib/theme';
import type { NurseryFormValues } from './profile-form';

/** ממפה רשומת משתלה מה-DB לערכי הטופס המשותף. */
export function nurseryToFormValues(n: Nursery): NurseryFormValues {
  const theme = getNurseryTheme(n);
  return {
    id: n.id,
    name: n.name,
    subdomain: n.subdomain,
    customDomain: n.customDomain,
    ownerEmail: n.ownerEmail,
    logoUrl: n.logoUrl,
    phoneNumber: n.phoneNumber,
    whatsappNumber: n.whatsappNumber,
    contactEmail: n.contactEmail,
    aboutText: n.aboutText,
    addressLine: n.addressLine,
    city: n.city,
    mapLink: n.mapLink,
    facebookUrl: n.facebookUrl,
    instagramUrl: n.instagramUrl,
    tiktokUrl: n.tiktokUrl,
    youtubeUrl: n.youtubeUrl,
    primaryColor: n.primaryColor,
    accentColor: theme.colors.accent,
    openingHoursText: openingHoursToText(n.openingHours),
    hero: theme.hero,
    stickyHeader: theme.stickyHeader,
  };
}
