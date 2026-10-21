'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { nurseryActionScope } from '@/lib/nursery-scope';
import { recordAudit } from '@/lib/audit';
import { validateLoyaltyConfig } from '@/lib/loyalty';

export interface LoyaltyState {
  ok?: boolean;
  error?: string;
  values?: { pointsPerShekel: string; pointValue: string; maxRedeemPct: string };
}

export async function saveLoyaltySettings(_prev: LoyaltyState, fd: FormData): Promise<LoyaltyState> {
  const s = await nurseryActionScope({ all: ['loyalty'] });
  if (!s.ok) return { error: s.error };
  const values = {
    pointsPerShekel: String(fd.get('pointsPerShekel') ?? ''),
    pointValue: String(fd.get('pointValue') || '0'),
    maxRedeemPct: String(fd.get('maxRedeemPct') ?? ''),
  };
  const v = validateLoyaltyConfig(values);
  if (!v.ok) return { error: v.error, values };
  await prisma.loyaltySettings.upsert({ where: { nurseryId: s.nurseryId }, create: { nurseryId: s.nurseryId, ...v.value }, update: v.value });
  await recordAudit({ nurseryId: s.nurseryId, actorEmail: s.user.email, action: 'loyalty.settings_updated', entityType: 'Nursery', entityId: s.nurseryId, metadata: { ...v.value } });
  revalidatePath('/admin/loyalty');
  return { ok: true };
}
