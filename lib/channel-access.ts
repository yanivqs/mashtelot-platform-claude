import 'server-only';
import { prisma } from '@/lib/prisma';
import { CHANNEL_LABELS, type EnabledChannel } from '@/lib/channels';

/** ערוצי הרשת החברתית/יצירת-קשר הפעילים של משתלה, ממוינים לתצוגה. */
export async function getEnabledChannels(nurseryId: string): Promise<EnabledChannel[]> {
  const rows = await prisma.nurseryChannel.findMany({
    where: { nurseryId, isEnabled: true },
    orderBy: { sortOrder: 'asc' },
  });
  return rows.map((r) => ({
    provider: r.provider,
    label: CHANNEL_LABELS[r.provider],
    value: r.value,
    isFeatured: r.isFeatured,
  }));
}
