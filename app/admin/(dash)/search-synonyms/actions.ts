'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { recordAudit } from '@/lib/audit';
import { normalizeText, parseSynonymGroup } from '@/lib/search';

export interface SynonymFormState {
  ok?: boolean;
  error?: string;
  /** הקלט שנשלח — React 19 מאפס את הטופס אחרי Action, וכך הוא נשמר בשגיאה (UX-01) */
  value?: string;
}

const MAX_TERMS = 20;
const MAX_TERM_LENGTH = 60;

function validate(raw: string): { terms: string[] } | { error: string } {
  const terms = parseSynonymGroup(raw);
  if (terms.length < 2) return { error: 'יש להזין לפחות שני מונחים, מופרדים בפסיק' };
  if (terms.length > MAX_TERMS) return { error: `עד ${MAX_TERMS} מונחים בקבוצה` };
  if (terms.some((t) => t.length > MAX_TERM_LENGTH)) return { error: `כל מונח עד ${MAX_TERM_LENGTH} תווים` };
  if (new Set(terms.map(normalizeText)).size < 2) return { error: 'המונחים זהים אחרי נרמול (אותיות סופיות/ניקוד)' };
  return { terms };
}

export async function addSynonymGroup(_prev: SynonymFormState, formData: FormData): Promise<SynonymFormState> {
  const user = await requireUser(['SUPER_ADMIN']);
  const raw = String(formData.get('terms') || '');
  const v = validate(raw);
  if ('error' in v) return { error: v.error, value: raw };

  const group = await prisma.searchSynonymGroup.create({ data: { terms: v.terms } });
  await recordAudit({
    actorEmail: user.email,
    action: 'search.synonyms_added',
    entityType: 'SearchSynonymGroup',
    entityId: group.id,
    metadata: { terms: v.terms },
  });
  revalidatePath('/admin/search-synonyms');
  return { ok: true };
}

export async function updateSynonymGroup(_prev: SynonymFormState, formData: FormData): Promise<SynonymFormState> {
  const user = await requireUser(['SUPER_ADMIN']);
  const id = String(formData.get('id') || '');
  const raw = String(formData.get('terms') || '');
  const v = validate(raw);
  if ('error' in v) return { error: v.error, value: raw };

  const res = await prisma.searchSynonymGroup.updateMany({ where: { id }, data: { terms: v.terms } });
  if (res.count !== 1) return { error: 'הקבוצה לא נמצאה', value: raw };
  await recordAudit({
    actorEmail: user.email,
    action: 'search.synonyms_updated',
    entityType: 'SearchSynonymGroup',
    entityId: id,
    metadata: { terms: v.terms },
  });
  revalidatePath('/admin/search-synonyms');
  return { ok: true, value: v.terms.join(', ') };
}

export async function deleteSynonymGroup(formData: FormData): Promise<void> {
  const user = await requireUser(['SUPER_ADMIN']);
  const id = String(formData.get('id') || '');
  const group = await prisma.searchSynonymGroup.findUnique({ where: { id } });
  if (!group) return;
  await prisma.searchSynonymGroup.delete({ where: { id } });
  await recordAudit({
    actorEmail: user.email,
    action: 'search.synonyms_deleted',
    entityType: 'SearchSynonymGroup',
    entityId: id,
    metadata: { terms: group.terms },
  });
  revalidatePath('/admin/search-synonyms');
}
