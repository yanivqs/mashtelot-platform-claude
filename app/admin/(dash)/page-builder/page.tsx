import { requireNurseryPage } from '@/lib/nursery-scope';
import { PageBuilderEditor } from '@/components/admin/page-builder/editor';
import { loadEditorProps } from './load';

export const dynamic = 'force-dynamic';

/** R03: עיצוב דף הבית מבלוקים (בעלים ועובד). */
export default async function HomeBuilderPage() {
  const { nurseryId } = await requireNurseryPage({ all: ['page_builder'], area: 'general' });
  const props = await loadEditorProps(nurseryId, { kind: 'home' }, '/');

  return (
    <div>
      <h1 className="text-2xl font-bold">עיצוב דף הבית</h1>
      <p className="mb-6 text-sm text-gray-500">
        בונים את הדף מבלוקים, בודקים בתצוגה המקדימה ומפרסמים. עד הפרסום הראשון החנות מציגה את דף הבית הרגיל.
      </p>
      <PageBuilderEditor {...props} />
    </div>
  );
}
