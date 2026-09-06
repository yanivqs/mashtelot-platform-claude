import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// דומיין הבסיס של הפלטפורמה (ללא פרוטוקול). לדוגמה: mashtelot.com
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

  // גישה לדומיין הראשי -> Landing page (app/page.tsx)
  if (host === ROOT_DOMAIN || host === `www.${ROOT_DOMAIN}`) {
    return NextResponse.next();
  }

  let tenant: string;
  if (host.endsWith(`.${ROOT_DOMAIN}`)) {
    // תת-דומיין של הפלטפורמה: galim.mashtelot.com -> "galim"
    tenant = host.slice(0, -1 * (ROOT_DOMAIN.length + 1)).replace(/^www\./, '');
  } else {
    // דומיין מותאם אישית: www.galim-nursery.co.il -> "galim-nursery.co.il"
    tenant = host.replace(/^www\./, '');
  }

  if (!tenant) {
    return NextResponse.next();
  }

  // שרשור מחדש לנתיב הפנימי של הטננט, שמירת ה-URL המקורי בדפדפן
  return NextResponse.rewrite(
    new URL(`/${encodeURIComponent(tenant)}${url.pathname}`, request.url),
  );
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
