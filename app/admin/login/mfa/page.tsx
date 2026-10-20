import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import { readMfaChallenge } from '@/lib/auth';
import { MfaCodeForm } from './code-form';

export const dynamic = 'force-dynamic';

/** שלב שני בהתחברות — רק עם אתגר תקף (סיסמה נכונה ב-5 הדקות האחרונות). */
export default async function MfaLoginPage() {
  const user = await readMfaChallenge();
  if (!user) redirect('/admin/login');

  return (
    <div dir="rtl" className="flex min-h-screen items-center justify-center bg-gray-50 px-6">
      <div className="w-full max-w-sm rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
        <div className="mb-2 flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-brand-600" />
          <h1 className="text-lg font-bold text-gray-900">אימות דו-שלבי</h1>
        </div>
        <p className="mb-5 text-sm text-gray-500">
          הזינו את הקוד בן 6 הספרות מאפליקציית האימות. אין גישה לטלפון? אפשר להזין קוד שחזור.
        </p>
        <MfaCodeForm />
        <Link href="/admin/login" className="mt-4 block text-center text-xs text-gray-500 hover:underline">
          חזרה להתחברות
        </Link>
      </div>
    </div>
  );
}
