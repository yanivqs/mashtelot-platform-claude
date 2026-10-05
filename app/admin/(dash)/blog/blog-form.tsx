'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { RichTextEditor } from '@/components/admin/rich-text-editor';
import { ImageUpload } from '@/components/admin/image-upload';
import { saveBlogPost, deleteBlogPost, type BlogFormState } from './actions';

export interface BlogFormValues {
  id: string | null;
  title: string;
  slug: string;
  excerpt: string;
  contentHtml: string;
  coverImageUrl: string | null;
  isPublished: boolean;
  seoMetaTitle: string | null;
  seoMetaDescription: string | null;
}

const initial: BlogFormState = {};
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

export function BlogForm({ post }: { post: BlogFormValues }) {
  const [state, formAction] = useFormState(saveBlogPost, initial);

  return (
    <>
      <form action={formAction} className="grid gap-4 sm:grid-cols-2">
        {post.id && <input type="hidden" name="id" value={post.id} />}

        <label className="text-sm">
          <span className="mb-1 block font-medium text-gray-700">כותרת</span>
          <input name="title" defaultValue={post.title} required className={field} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-gray-700">מזהה כתובת (slug)</span>
          <input name="slug" defaultValue={post.slug} required dir="ltr" placeholder="spring-tips" className={field} />
        </label>

        <div className="sm:col-span-2">
          <ImageUpload name="coverImageUrl" defaultValue={post.coverImageUrl} label="תמונת שער" folder="misc" />
        </div>

        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block font-medium text-gray-700">תקציר (מוצג ברשימת הבלוג)</span>
          <textarea name="excerpt" rows={2} defaultValue={post.excerpt} className={field} />
        </label>

        <div className="text-sm sm:col-span-2">
          <span className="mb-1 block font-medium text-gray-700">תוכן</span>
          <RichTextEditor name="contentHtml" defaultValue={post.contentHtml} />
        </div>

        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block font-medium text-gray-700">כותרת SEO (meta title)</span>
          <input name="seoMetaTitle" defaultValue={post.seoMetaTitle ?? ''} className={field} />
        </label>
        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block font-medium text-gray-700">תיאור SEO (meta description)</span>
          <textarea name="seoMetaDescription" rows={2} defaultValue={post.seoMetaDescription ?? ''} className={field} />
        </label>

        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" name="isPublished" defaultChecked={post.isPublished} className="h-4 w-4 rounded border-gray-300" />
          <span className="font-medium text-gray-700">פורסם (גלוי לקוראים בחנות)</span>
        </label>

        <div className="flex items-center gap-3 sm:col-span-2">
          <SaveButton />
          {state.error && <span className="text-sm text-red-600">{state.error}</span>}
        </div>
      </form>

      {post.id && (
        <form action={deleteBlogPost} className="mt-4 border-t border-gray-200 pt-4">
          <input type="hidden" name="id" value={post.id} />
          <button className="text-sm text-red-600 hover:text-red-800">מחיקת הפוסט</button>
        </form>
      )}
    </>
  );
}
