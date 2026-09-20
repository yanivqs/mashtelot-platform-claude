'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { CHANNEL_PROVIDERS } from '@/lib/channels';

async function resolveNurseryId(): Promise<string> {
  const user = await requireUser(['NURSERY_OWNER', 'SUPER_ADMIN']);
  if (user.nurseryId) return user.nurseryId;
  if (user.role === 'SUPER_ADMIN') {
    const first = await prisma.nursery.findFirst({ orderBy: { createdAt: 'asc' } });
    if (first) return first.id;
  }
  throw new Error('אין משתלה משויכת');
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

  revalidatePath('/admin/settings');
  return { ok: true };
}
