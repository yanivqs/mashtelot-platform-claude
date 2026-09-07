'use client';

import { useState, useCallback } from 'react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
  Bold,
  Italic,
  Strikethrough,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Link2,
  Undo2,
  Redo2,
} from 'lucide-react';

interface Props {
  /** שם השדה הנסתר שיישלח עם הטופס (HTML) */
  name: string;
  defaultValue?: string;
}

function Btn({
  onClick,
  active,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`rounded p-1.5 text-gray-600 transition hover:bg-gray-100 disabled:opacity-40 ${
        active ? 'bg-brand-50 text-brand-700' : ''
      }`}
    >
      {children}
    </button>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const setLink = useCallback(() => {
    const prev = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('כתובת הקישור:', prev ?? 'https://');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }, [editor]);

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-gray-200 p-1.5">
      <Btn label="מודגש" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold className="h-4 w-4" />
      </Btn>
      <Btn label="נטוי" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic className="h-4 w-4" />
      </Btn>
      <Btn label="קו חוצה" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}>
        <Strikethrough className="h-4 w-4" />
      </Btn>
      <span className="mx-1 h-5 w-px bg-gray-200" />
      <Btn label="כותרת 2" active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
        <Heading2 className="h-4 w-4" />
      </Btn>
      <Btn label="כותרת 3" active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
        <Heading3 className="h-4 w-4" />
      </Btn>
      <Btn label="רשימה" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <List className="h-4 w-4" />
      </Btn>
      <Btn label="רשימה ממוספרת" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <ListOrdered className="h-4 w-4" />
      </Btn>
      <Btn label="ציטוט" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        <Quote className="h-4 w-4" />
      </Btn>
      <Btn label="קישור" active={editor.isActive('link')} onClick={setLink}>
        <Link2 className="h-4 w-4" />
      </Btn>
      <span className="mx-1 h-5 w-px bg-gray-200" />
      <Btn label="בטל" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}>
        <Undo2 className="h-4 w-4" />
      </Btn>
      <Btn label="בצע שוב" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}>
        <Redo2 className="h-4 w-4" />
      </Btn>
    </div>
  );
}

export function RichTextEditor({ name, defaultValue = '' }: Props) {
  const [html, setHtml] = useState(defaultValue);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        link: { openOnClick: false, HTMLAttributes: { rel: 'noopener noreferrer nofollow' } },
      }),
    ],
    content: defaultValue,
    editorProps: {
      attributes: {
        class:
          'min-h-[240px] px-3 py-3 outline-none [&_h2]:mb-2 [&_h2]:mt-4 [&_h2]:text-xl [&_h2]:font-bold [&_h3]:mb-1 [&_h3]:mt-3 [&_h3]:text-lg [&_h3]:font-bold [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pr-6 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pr-6 [&_blockquote]:border-r-2 [&_blockquote]:border-gray-300 [&_blockquote]:pr-3 [&_blockquote]:text-gray-600 [&_a]:text-brand-700 [&_a]:underline',
      },
    },
    onUpdate: ({ editor }) => setHtml(editor.getHTML()),
  });

  return (
    <div>
      <input type="hidden" name={name} value={html} />
      <div className="overflow-hidden rounded-lg border border-gray-200">
        {editor && <Toolbar editor={editor} />}
        <EditorContent editor={editor} dir="rtl" className="text-sm text-gray-800" />
      </div>
    </div>
  );
}
