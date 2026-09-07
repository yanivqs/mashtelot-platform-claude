'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { RichTextEditor } from '@/components/admin/rich-text-editor';
import { savePage, deletePage, type PageFormState } from './actions';

export interface PageFormValues {
  id: string | null;
  title: string;
  slug: string;
  contentHtml: string;
  isPublished: boolean;
  showInNav: boolean;
  sortOrder: number;
  seoMetaTitle: string | null;
  seoMetaDescription: string | null;
}

const initial: PageFormState = {};
const field =
  'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-500';

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
      disabled={pending}
    >
      {pending ? 'שומר...' : 'שמירה'}
    </button>
  );
}

export function PageForm({ page }: { page: PageFormValues }) {
  const [state, formAction] = useFormState(savePage, initial);

  return (
    <>
      <form action={formAction} className="grid gap-4 sm:grid-cols-2">
        {page.id && <input type="hidden" name="id" value={page.id} />}

        <label className="text-sm">
          <span className="mb-1 block font-medium text-gray-700">כותרת</span>
          <input name="title" defaultValue={page.title} required className={field} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-gray-700">מזהה כתובת (slug)</span>
          <input
            name="slug"
            defaultValue={page.slug}
            required
            dir="ltr"
            placeholder="about"
            className={field}
          />
        </label>

        <div className="text-sm sm:col-span-2">
          <span className="mb-1 block font-medium text-gray-700">תוכן</span>
          <RichTextEditor name="contentHtml" defaultValue={page.contentHtml} />
        </div>

        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block font-medium text-gray-700">כותרת SEO (meta title)</span>
          <input name="seoMetaTitle" defaultValue={page.seoMetaTitle ?? ''} className={field} />
        </label>
        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block font-medium text-gray-700">תיאור SEO (meta description)</span>
          <textarea
            name="seoMetaDescription"
            rows={2}
            defaultValue={page.seoMetaDescription ?? ''}
            className={field}
          />
        </label>

        <label className="text-sm">
          <span className="mb-1 block font-medium text-gray-700">סדר בתפריט</span>
          <input
            name="sortOrder"
            type="number"
            defaultValue={page.sortOrder}
            className={field}
          />
        </label>
        <div className="flex items-end gap-6 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="isPublished"
              defaultChecked={page.isPublished}
              className="h-4 w-4 rounded border-gray-300"
            />
            <span className="font-medium text-gray-700">מפורסם</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="showInNav"
              defaultChecked={page.showInNav}
              className="h-4 w-4 rounded border-gray-300"
            />
            <span className="font-medium text-gray-700">הצג בתפריט החנות</span>
          </label>
        </div>

        <div className="flex items-center gap-3 sm:col-span-2">
          <SaveButton />
          {state.error && <span className="text-sm text-red-600">{state.error}</span>}
        </div>
      </form>

      {page.id && (
        <form action={deletePage} className="mt-4 border-t border-gray-100 pt-4">
          <input type="hidden" name="id" value={page.id} />
          <button className="text-sm text-red-600 hover:text-red-800">מחיקת העמוד</button>
        </form>
      )}
    </>
  );
}
