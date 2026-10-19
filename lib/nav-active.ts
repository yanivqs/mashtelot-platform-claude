/** האם קישור ניווט פעיל בנתיב הנוכחי. דף הבית פעיל רק בהתאמה מדויקת; אחרים — גם בתתי-נתיבים. */
export function isNavActive(pathname: string, href: string, home: string): boolean {
  if (href === home) return pathname === home;
  return pathname === href || pathname.startsWith(`${href}/`);
}
