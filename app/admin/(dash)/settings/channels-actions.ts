'use server';

import { revalidatePath } from 'next/cache';
import { auditAsCurrentUser } from '@/lib/audit-actor';
import { prisma } from '@/lib/prisma';
import { requireNurseryAction } from '@/lib/nursery-scope';
import { CHANNEL_PROVIDERS } from '@/lib/channels';

/** הקשר המשתלה של המשתמש המחובר בלבד + אכיפת המודול (C-P1-01). */
async function resolveNurseryId(): Promise<string> {
  return (await requireNurseryAction({ all: ['social'] })).nurseryId;
}

export interface SaveChannelsState {
  ok?: boolean;
  error?: string;
}

export async function saveChannels(
  _prev: SaveChannelsState,
  formData: FormData,
): Promise<SaveChannelsState> {
  const nurseryId = await resolveNurseryId();

  try {
    await prisma.$transaction(
      CHANNEL_PROVIDERS.map((provider) => {
        const value = String(formData.get(`${provider}_value`) || '').trim();
        const isEnabled = formData.get(`${provider}_enabled`) === 'on' && value.length > 0;
        return prisma.nurseryChannel.upsert({
          where: { nurseryId_provider: { nurseryId, provider } },
          create: { nurseryId, provider, value: value || '', isEnabled },
          update: { value: value || '', isEnabled },
        });
      }),
    );
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'שמירת הערוצים נכשלה' };
  }
  await auditAsCurrentUser({ nurseryId, action: 'channels.updated', entityType: 'Nursery', entityId: nurseryId });

  revalidatePath('/admin/settings');
  revalidatePath('/[tenant]', 'layout');
  return { ok: true };
}
