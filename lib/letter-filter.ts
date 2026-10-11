import 'server-only';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { HEBREW_LETTERS, OTHER_LETTER, firstLetter } from '@/lib/alphabet';

/** תנאי "מתחיל באות" לשדה טקסט ('#' = לא מתחיל באף אות עברית). */
function startsWith(letter: string): Prisma.StringFilter | null {
  return letter === OTHER_LETTER ? null : { startsWith: letter };
}

export function plantLetterWhere(letter: string | null): Prisma.PlantWhereInput {
  if (!letter) return {};
  const filter = startsWith(letter);
  return filter
    ? { hebrewName: filter }
    : { NOT: HEBREW_LETTERS.map((l) => ({ hebrewName: { startsWith: l } })) };
}

export function supplyLetterWhere(letter: string | null): Prisma.MasterSupplyWhereInput {
  if (!letter) return {};
  const filter = startsWith(letter);
  return filter
    ? { title: filter }
    : { NOT: HEBREW_LETTERS.map((l) => ({ title: { startsWith: l } })) };
}

/** האותיות שיש להן לפחות צמח אחד בקטלוג המרכזי. */
export async function plantLetters(): Promise<Set<string>> {
  const rows = await prisma.$queryRaw<Array<{ p: string | null }>>`
    SELECT DISTINCT LEFT(TRIM(hebrew_name), 3) AS p FROM plants`;
  return lettersOf(rows.map((r) => r.p));
}

/** האותיות שיש להן לפחות פריט ציוד אחד בקטלוג המרכזי. */
export async function supplyLetters(): Promise<Set<string>> {
  const rows = await prisma.masterSupply.findMany({ select: { title: true } });
  return lettersOf(rows.map((r) => r.title));
}

export function lettersOf(names: Array<string | null | undefined>): Set<string> {
  const set = new Set<string>();
  for (const n of names) {
    const l = firstLetter(n);
    if (l) set.add(l);
  }
  return set;
}
