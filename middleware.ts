import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { resolveHost } from '@/lib/tenant-host';

// דומיין הבסיס של הפלטפורמה (ללא פרוטוקול). לדוגמה: mashtelot.net
const ROOT_DOMAIN = process.env.ROOT_DOMAIN || 'localhost:3000';

export function middleware(request: NextRequest) {
  const url = request.nextUrl;
  const host = (request.headers.get('host') || '').toLowerCase();

  // דילוג על נכסים סטטיים, נתיבי API ופורטל הניהול (משותף, לא תלוי-טננט)
  if (
    url.pathname.startsWith('/_next') ||
    url.pathname.startsWith('/api') ||
    url.pathname.startsWith('/admin') ||
    url.pathname === '/favicon.ico' ||
    url.pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  const target = resolveHost(host, ROOT_DOMAIN);
  if (target.kind === 'none') return NextResponse.next();

  if (target.kind === 'root') {
    // הדומיין הראשי: רק דף הנחיתה. נתיב אחר (למשל /demo-nursery/catalog) היה מגיש את החנות
    // גם תחת הדומיין הראשי — תוכן כפול (C-P1-05, אפיון §14.04) — ולכן מוחזר 404.
    if (url.pathname === '/') return NextResponse.next();
    const notFound = url.clone();
    notFound.pathname = '/__no_tenant__';
    return NextResponse.rewrite(notFound);
  }

  const tenant = target.tenant;

  // שרשור מחדש לנתיב הפנימי של הטננט, שמירת ה-URL המקורי בדפדפן.
  // משכפלים את ה-URL המלא כדי לשמור על ה-query string (דפדוף, חיפוש, סינון)
  const rewritten = url.clone();
  rewritten.pathname = `/${encodeURIComponent(tenant)}${url.pathname}`;
  return NextResponse.rewrite(rewritten);
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
