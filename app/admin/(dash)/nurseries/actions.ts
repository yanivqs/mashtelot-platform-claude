'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireUser, hashPassword } from '@/lib/auth';

export interface NurseryFormState {
  ok?: boolean;
  error?: string;
}

const SUBDOMAIN_RE = /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/;

export async function createNursery(
  _prev: NurseryFormState,
  formData: FormData,
): Promise<NurseryFormState> {
  await requireUser(['SUPER_ADMIN']);

  const name = String(formData.get('name') || '').trim();
  const subdomain = String(formData.get('subdomain') || '').trim().toLowerCase();
  const ownerEmail = String(formData.get('ownerEmail') || '').trim().toLowerCase();
  const ownerPassword = String(formData.get('ownerPassword') || '');

  if (!name || !subdomain || !ownerEmail) {
    return { error: 'שם, תת-דומיין ואימייל בעלים הם שדות חובה' };
  }
  if (!SUBDOMAIN_RE.test(subdomain)) {
    return { error: 'תת-דומיין לא תקין (אותיות אנגלית קטנות, ספרות ומקפים)' };
  }

  const existing = await prisma.nursery.findUnique({ where: { subdomain } });
  if (existing) return { error: 'תת-הדומיין כבר תפוס' };

  const nursery = await prisma.nursery.create({
    data: { name, subdomain, ownerEmail },
  });

  if (ownerPassword) {
    if (ownerPassword.length < 8) {
      return { error: 'המשתלה נוצרה, אך הסיסמה קצרה מ-8 תווים - לא נוצר משתמש בעלים' };
    }
    const passwordHash = await hashPassword(ownerPassword);
    await prisma.user.upsert({
      where: { email: ownerEmail },
      update: { passwordHash, role: 'NURSERY_OWNER', nurseryId: nursery.id },
      create: {
        email: ownerEmail,
        passwordHash,
        role: 'NURSERY_OWNER',
        nurseryId: nursery.id,
      },
    });
  }

  revalidatePath('/admin/nurseries');
  return { ok: true };
}

export async function toggleNurseryActive(formData: FormData): Promise<void> {
  await requireUser(['SUPER_ADMIN']);
  const id = String(formData.get('id') || '');
  const nursery = await prisma.nursery.findUnique({ where: { id }, select: { isActive: true } });
  if (!nursery) return;
  await prisma.nursery.update({ where: { id }, data: { isActive: !nursery.isActive } });
  revalidatePath('/admin/nurseries');
}
