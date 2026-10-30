/** אייקון Waze פשוט (בועה עם עיניים וחיוך) — lucide לא כולל מותגים. */
export function WazeIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5.5 17.5C3.6 16.4 2.5 14.3 2.5 12 2.5 6.8 6.8 3 12 3s9.5 3.8 9.5 9c0 3.9-2.9 6.7-6.5 7.3" />
      <path d="M10.5 19.6c-1.3.1-2.6-.2-3.6-.9" />
      <circle cx="8.5" cy="20" r="1.6" />
      <circle cx="16.5" cy="20" r="1.6" />
      <circle cx="9.5" cy="10" r=".6" fill="currentColor" />
      <circle cx="14.5" cy="10" r=".6" fill="currentColor" />
      <path d="M9.5 13.5c1.4 1.2 3.6 1.2 5 0" />
    </svg>
  );
}
