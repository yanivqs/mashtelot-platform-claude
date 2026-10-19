import 'server-only';
import { cache } from 'react';
import { prisma } from '@/lib/prisma';
import { buildSynonymIndex, type SynonymIndex } from '@/lib/search';

/** מילון הנרדפות הגלובלי (R04-03), פעם אחת לבקשה. */
export const getSynonymIndex = cache(async (): Promise<SynonymIndex> => {
  const groups = await prisma.searchSynonymGroup.findMany({ select: { terms: true } });
  return buildSynonymIndex(groups.map((g) => g.terms));
});
