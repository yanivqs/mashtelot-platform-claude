import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getNurseryModuleMap } from '@/lib/module-access';
import { getLiveLayout } from '@/lib/page-builder';
import { HOME_KEY } from '@/lib/page-builder-admin';
import { PageBuilderEditor } from '@/components/admin/page-builder/editor';
import { loadEditorProps } from '../../../page-builder/load';
import { setManagedHomeAction } from './actions';

export const dynamic = 'force-dynamic';

/** עיצוב דף הבית של משתלה בידי הסופר-אדמין, גם בלי שהמודול משויך לה. */
export default async function NurseryHomeDesignPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  await requireUser(['SUPER_ADMIN']);
  const nursery = await prisma.nursery.findUnique({ where: { id }, select: { id: true, name: true } });
  if (!nursery) notFound();

  const mod = (await getNurseryModuleMap(id)).get('page_builder');
  const managed = mod?.config.platformManaged === true;
  const ownerCanEdit = mod?.enabled === true;
  const editorProps = await loadEditorProps(id, { kind: 'home' }, '/', true);
  const showing = Boolean(await getLiveLayout(id, HOME_KEY));

  return (
    <div>
      <Link href={`/admin/nurseries/${id}`} className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
        <ArrowRight className="h-4 w-4" /> חזרה למשתלה
      </Link>
      <h1 className="text-2xl font-bold">עיצוב דף הבית: {nursery.name}</h1>

      <section className="mb-6 mt-4 space-y-3 rounded-xl border border-gray-200 bg-white p-4 text-sm" data-testid="managed-home">
        <p className="font-medium" data-testid="managed-home-status">
          {showing ? 'החנות מציגה עכשיו את דף הבית מהבלוקים.' : 'החנות מציגה עכשיו את דף הבית הרגיל.'}
        </p>
        <p className="text-gray-600">
          {ownerCanEdit
            ? 'המודול "עיצוב דף הבית" משויך למשתלה, ולכן בעל המשתלה רואה ועורך את אותו עיצוב.'
            : 'המודול "עיצוב דף הבית" לא משויך למשתלה, ולכן בעל המשתלה לא יכול לערוך את העיצוב.'}
        </p>
        {!ownerCanEdit && (
          <form action={setManagedHomeAction.bind(null, id, !managed)}>
            <button type="submit" className="rounded-lg bg-brand-700 px-4 py-2 font-medium text-white hover:bg-brand-800">
              {managed ? 'הפסקת הצגת העיצוב שלי בחנות' : 'הצגת העיצוב שלי בחנות'}
            </button>
          </form>
        )}
        {!ownerCanEdit && managed && !showing && <p className="text-amber-800">העיצוב יוצג בחנות אחרי שתפרסם גרסה.</p>}
      </section>

      <PageBuilderEditor {...editorProps} />
    </div>
  );
}
