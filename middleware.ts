import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const url = request.nextUrl;
  const hostname = request.headers.get('host') || '';

  // הגדרת דומיינים ראשיים (זיהוי סביבת פיתוח ופרודקשן)
  const currentHost =
    process.env.NODE_ENV === 'production'
      ? hostname.replace(`.mashtelot.com`, '') // החלף בדומיין הפרודקשן שלך
      : hostname.replace(`.localhost:3000`, '');

  // מניעת הפניה עבור קבצים סטטיים ונתיבי API פנימיים
  if (
    url.pathname.startsWith('/_next') ||
    url.pathname.startsWith('/api') ||
    url.pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // מקרה 1: גישה לדומיין הראשי (ראשי / Landing Page)
  if (hostname === 'localhost:3000' || hostname === 'mashtelot.com') {
    return NextResponse.next();
  }

  // מקרה 2: גישה לתת-דומיין או דומיין מותאם אישית של משתלה
  // שרשור מחדש לנתיב הפנימי [tenant]
  return NextResponse.rewrite(
    new URL(`/${currentHost}${url.pathname}`, request.url)
  );
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};