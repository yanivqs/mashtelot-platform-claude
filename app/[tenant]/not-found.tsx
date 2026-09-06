import Link from 'next/link';

export default function TenantNotFound() {
  return (
    <div dir="rtl" className="mx-auto flex max-w-lg flex-col items-center px-6 py-24 text-center">
      <span className="text-5xl" aria-hidden>
        🌵
      </span>
      <h1 className="mt-6 text-2xl font-bold text-gray-900">הדף לא נמצא</h1>
      <p className="mt-2 text-gray-500">
        ייתכן שהמשתלה אינה קיימת, אינה פעילה, או שהכתובת שגויה.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-lg bg-brand-600 px-6 py-3 font-medium text-white hover:bg-brand-700"
      >
        חזרה לדף הבית
      </Link>
    </div>
  );
}
