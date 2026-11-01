'use client';

import { useEffect } from 'react';

/** מעדכן את גובה סרגל ההודעות במשתנה CSS: בנייד הטקסט נשבר לכמה שורות, והכותרת נדבקת מתחתיו. */
export function AnnouncementHeight() {
  useEffect(() => {
    const bar = document.querySelector<HTMLElement>('[data-testid="announcement-bar"]');
    if (!bar) return;
    const root = document.documentElement;
    const sync = () => root.style.setProperty('--announce-h', `${bar.offsetHeight}px`);
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(bar);
    return () => {
      observer.disconnect();
      root.style.removeProperty('--announce-h');
    };
  }, []);
  return null;
}
